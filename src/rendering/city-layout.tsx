/**
 * city-layout.tsx — Places all buildings, infrastructure, substations, renewables,
 * and streetlights across the Meridian Bay city map.
 *
 * Every reactive behaviour below is derived from live simulation state by
 * `city-response.ts` — never from the operator's decision history. That matters:
 * the decision log only ever grows, so anything keyed off it latched on
 * permanently and could not depict restoration.
 *
 * - District brightness tracks served ÷ nominal demand, so shedding dims the
 *   district and restoration brings it back
 * - Blackout darkens a district outright
 * - Hospital priority aura lights while downtown is degraded or dark
 * - Thermal plant trip drives the industrial flicker and its own fault ring
 * - BESS pulse follows real storage output; solar glow follows real solar
 *   output, so the array goes dark at night
 * - Wind rotor speed scales with real wind output
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { ReactNode } from 'react';

import { useGridStore, useUiStore } from '@state';

import { cityResponseSignature, deriveCityResponse, zoneNominalDemand } from './city-response';
import { nightFactor, windowGlow } from './time-of-day';
import { BUILDING_POSITIONS } from './camera/city-positions';
import {
  Hospital,
  School,
  CorporateTower,
  CommercialComplex,
  Courthouse,
  EvStation,
  HouseHigh,
  HouseLow,
  HighDensityApartment,
  Substation,
  BatteryStorage,
  ThermalGenerator,
  WindTurbine,
  IndustrialFactory,
  SolarFarm,
  StreetLight,
  TransmissionPylon,
  Tree,
  Park,
  Pond,
  Road,
} from './city-buildings';

/** World position for a building id from the shared table. */
const at = (id: string): [number, number, number] => {
  const p = BUILDING_POSITIONS[id] ?? [0, 0];
  return [p[0], 0, p[1]];
};

/** One material plus the pristine values it started with. */
interface TrackedMaterial {
  readonly material: THREE.MeshStandardMaterial;
  readonly emissiveIntensity: number;
  readonly color: THREE.Color;
}

/**
 * Deterministic electrical stutter. The previous implementation drew a fresh
 * `Math.random()` every frame, which at 60 fps reads as a strobe rather than a
 * failing circuit — and put non-seeded randomness into the render path. This
 * holds each sample for ~1/14 s so the flicker has visible steps.
 */
function flickerAt(seconds: number): number {
  const step = Math.floor(seconds * FLICKER_HZ);
  const hashed = Math.sin(step * 127.1) * 43758.5453;
  return FLICKER_FLOOR + (hashed - Math.floor(hashed)) * (1 - FLICKER_FLOOR);
}

const FLICKER_HZ = 14;
const FLICKER_FLOOR = 0.45;
/** Emissive level for a district that has lost its supply entirely. */
const DARK_EMISSIVE = 0.02;
/** Rotor speed at zero output — a parked turbine still drifts a little. */
const IDLE_SPIN = 0.25;
/** Additional rotor speed at full rated output. */
const SPIN_GAIN = 3.0;

function DimGroup({
  dimmed,
  loadFactor = 1,
  flicker = false,
  children,
}: {
  dimmed: boolean;
  loadFactor?: number;
  flicker?: boolean;
  children: ReactNode;
}): JSX.Element {
  const ref = useRef<THREE.Group>(null);
  const factorRef = useRef(1);
  // Collected once on the first frame. Re-walking the subtree every frame for
  // six districts was the single largest per-frame CPU cost in the scene.
  const tracked = useRef<TrackedMaterial[] | null>(null);

  useFrame(({ clock }, delta) => {
    const group = ref.current;
    if (group === null) return;

    if (tracked.current === null) {
      const collected: TrackedMaterial[] = [];
      group.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh)) return;
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const material of materials) {
          if (!(material instanceof THREE.MeshStandardMaterial)) continue;
          collected.push({
            material,
            emissiveIntensity: material.emissiveIntensity,
            color: material.color.clone(),
          });
        }
      });
      tracked.current = collected;
    }

    const glow = windowGlow(nightFactor(useGridStore.getState().tick));
    const targetFactor = dimmed ? 0.05 : loadFactor < 1 ? 0.25 + 0.75 * loadFactor : 1;
    factorRef.current += (targetFactor - factorRef.current) * Math.min(1, delta * 4.5);

    const flickerMultiplier = flicker ? flickerAt(clock.elapsedTime) : 1;
    const emissiveLerp = Math.min(1, delta * 5);

    for (const entry of tracked.current) {
      const targetEmissive = dimmed
        ? DARK_EMISSIVE
        : entry.emissiveIntensity * glow * loadFactor * flickerMultiplier;
      entry.material.emissiveIntensity +=
        (targetEmissive - entry.material.emissiveIntensity) * emissiveLerp;
      entry.material.color.copy(entry.color).multiplyScalar(factorRef.current);
    }
  });

  return <group ref={ref}>{children}</group>;
}

/**
 * Full city layout component — drop into the Canvas alongside grid markers.
 */
export function CityLayout(): JSX.Element {
  const selectAsset = useUiStore((s) => s.selectAsset);

  // Selecting a quantised signature rather than the `zones`/`generators` arrays
  // keeps this tree from reconciling on all ten ticks a second — the arrays get
  // fresh identities every tick even when the picture is unchanged.
  const signature = useGridStore((s) => cityResponseSignature(s.zones, s.generators));
  const nominal = useMemo(() => zoneNominalDemand(), []);
  const response = useMemo(() => {
    const { zones, generators } = useGridStore.getState();
    return deriveCityResponse(zones, generators, nominal);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- signature IS the state digest
  }, [signature, nominal]);

  const { darkZones: dark, zoneLoadFactor, assetOutputFactor, trippedAssets } = response;
  const loadOf = (zoneId: string): number => zoneLoadFactor[zoneId] ?? 1;
  const outputOf = (assetId: string): number => assetOutputFactor[assetId] ?? 0;

  const select = (id: string) => (e: { stopPropagation(): void }) => {
    e.stopPropagation();
    selectAsset({ kind: 'building', id });
  };

  return (
    <group name="city-layout">
      {/* === DOWNTOWN (DT) — Corporate & Commercial District === */}
      <DimGroup dimmed={dark.has('DT')} loadFactor={loadOf('DT')}>
        <CorporateTower
          position={at('DT-Corp1')}
          height={24}
          rotation={0.1}
          onClick={select('DT-Corp1')}
        />
        <CorporateTower
          position={at('DT-Corp2')}
          height={19}
          rotation={-0.1}
          onClick={select('DT-Corp2')}
        />
        <CorporateTower
          position={at('DT-Corp3')}
          height={28}
          rotation={0.05}
          onClick={select('DT-Corp3')}
        />
        <CorporateTower
          position={at('DT-Corp4')}
          height={17}
          rotation={-0.15}
          onClick={select('DT-Corp4')}
        />
        <CorporateTower
          position={at('DT-Corp5')}
          height={22}
          rotation={0.2}
          onClick={select('DT-Corp5')}
        />
        <CorporateTower
          position={at('DT-Corp6')}
          height={18}
          rotation={-0.05}
          onClick={select('DT-Corp6')}
        />
        <CorporateTower
          position={at('DT-Corp7')}
          height={21}
          rotation={0.12}
          onClick={select('DT-Corp7')}
        />
        <CommercialComplex position={at('DT-Mall1')} onClick={select('DT-Mall1')} />
        <Courthouse position={at('DT-Gov1')} onClick={select('DT-Gov1')} />
      </DimGroup>

      {/* Downtown Substation */}
      <Substation
        position={at('SUB-DT')}
        isOverloaded={dark.has('DT')}
        onClick={select('SUB-DT')}
      />

      {/* Hospital — Priority Infrastructure (Remains brightly illuminated) */}
      <Hospital
        position={at('DT-Hosp')}
        isPrioritized={response.hospitalPrioritized}
        onClick={select('DT-Hosp')}
      />

      {/* === INDUSTRIAL DISTRICT (IN) === */}
      <DimGroup
        dimmed={dark.has('IN')}
        loadFactor={loadOf('IN')}
        flicker={trippedAssets.has('GEN-Thermal1')}
      >
        <IndustrialFactory
          position={at('IN-Fac1')}
          isActive={loadOf('IN') > 0.5 && !dark.has('IN')}
          onClick={select('IN-Fac1')}
        />
        <IndustrialFactory
          position={at('IN-Fac2')}
          isActive={loadOf('IN') > 0.5 && !dark.has('IN')}
          onClick={select('IN-Fac2')}
        />
        <IndustrialFactory
          position={at('IN-Fac3')}
          isActive={loadOf('IN') > 0.5 && !dark.has('IN')}
          onClick={select('IN-Fac3')}
        />
      </DimGroup>
      <Substation
        position={at('SUB-IN')}
        isOverloaded={dark.has('IN')}
        onClick={select('SUB-IN')}
      />
      <ThermalGenerator
        position={at('GEN-Thermal1')}
        isTripped={trippedAssets.has('GEN-Thermal1')}
        onClick={select('GEN-Thermal1')}
      />

      {/* === RESIDENTIAL NORTH (RN) — High Income Estates & Apartments === */}
      <DimGroup dimmed={dark.has('RN')} loadFactor={loadOf('RN')}>
        <School position={at('RN-Sch1')} onClick={select('RN-Sch1')} />
        <EvStation position={at('RN-EV1')} onClick={select('RN-EV1')} />
        <HouseHigh position={at('RN-House1')} onClick={select('RN-House1')} />
        <HouseHigh position={at('RN-House2')} onClick={select('RN-House2')} />
        <HouseHigh position={at('RN-House3')} onClick={select('RN-House3')} />
        <HouseHigh position={at('RN-House4')} onClick={select('RN-House4')} />
        <HouseHigh position={at('RN-House5')} onClick={select('RN-House5')} />
        <HouseHigh position={at('RN-House6')} onClick={select('RN-House6')} />
        <HouseHigh position={at('RN-House7')} onClick={select('RN-House7')} />
        <HighDensityApartment position={at('RN-Apt1')} onClick={select('RN-Apt1')} />
        <HighDensityApartment position={at('RN-Apt2')} onClick={select('RN-Apt2')} />
      </DimGroup>
      <Substation
        position={at('SUB-RN')}
        isOverloaded={dark.has('RN')}
        onClick={select('SUB-RN')}
      />

      {/* === RESIDENTIAL SOUTH (RS) — Community Estates & Apartments === */}
      <DimGroup dimmed={dark.has('RS')} loadFactor={loadOf('RS')}>
        <School position={at('RS-Sch2')} onClick={select('RS-Sch2')} />
        <EvStation position={at('RS-EV2')} onClick={select('RS-EV2')} />
        <HouseLow position={at('RS-House1')} onClick={select('RS-House1')} />
        <HouseLow position={at('RS-House2')} onClick={select('RS-House2')} />
        <HouseLow position={at('RS-House3')} onClick={select('RS-House3')} />
        <HouseLow position={at('RS-House4')} onClick={select('RS-House4')} />
        <HouseLow position={at('RS-House5')} onClick={select('RS-House5')} />
        <HouseLow position={at('RS-House6')} onClick={select('RS-House6')} />
        <HouseLow position={at('RS-House7')} onClick={select('RS-House7')} />
        <HouseLow position={at('RS-House8')} onClick={select('RS-House8')} />
        <HouseLow position={at('RS-House9')} onClick={select('RS-House9')} />
        <HighDensityApartment position={at('RS-Apt1')} onClick={select('RS-Apt1')} />
        <HighDensityApartment position={at('RS-Apt2')} onClick={select('RS-Apt2')} />
      </DimGroup>
      <Substation
        position={at('SUB-RS')}
        isOverloaded={dark.has('RS')}
        onClick={select('SUB-RS')}
      />

      {/* === RENEWABLE ENERGY & BATTERY STORAGE ZONE === */}
      <SolarFarm
        position={at('RN-Solar')}
        isActive={outputOf('RN-Solar') > 0.02}
        onClick={select('RN-Solar')}
      />
      <BatteryStorage
        position={at('BESS-1')}
        isActive={outputOf('BESS-1') > 0.02}
        onClick={select('BESS-1')}
      />
      <BatteryStorage
        position={at('BESS-2')}
        isActive={outputOf('BESS-2') > 0.02}
        onClick={select('BESS-2')}
      />
      <WindTurbine
        position={at('GEN-Wind1')}
        speed={IDLE_SPIN + outputOf('GEN-Wind1') * SPIN_GAIN}
        onClick={select('GEN-Wind1')}
      />
      <WindTurbine
        position={at('GEN-Wind2')}
        speed={IDLE_SPIN + outputOf('GEN-Wind2') * SPIN_GAIN}
        onClick={select('GEN-Wind2')}
      />

      {/* === AIRPORT INFRASTRUCTURE (AP) === */}
      <DimGroup dimmed={dark.has('AP')} loadFactor={loadOf('AP')}>
        <EvStation position={at('AP-EV3')} onClick={select('AP-EV3')} />
        <CommercialComplex position={at('AP-Term')} onClick={select('AP-Term')} />
      </DimGroup>

      {/* === HARBOR (HB) === The scripted heatwave beat trips harbor
          generation; without geometry here the run's loudest moment happened
          off-camera. */}
      <DimGroup dimmed={dark.has('HB')} loadFactor={loadOf('HB')}>
        <IndustrialFactory
          position={at('HB-Fac')}
          isActive={loadOf('HB') > 0.5 && !dark.has('HB')}
          onClick={select('HB-Fac')}
        />
      </DimGroup>

      {/* === GREEN INFRASTRUCTURE & PARKS === */}
      <Park position={[0, 0, 38]} size={[22, 14]} />
      <Pond position={[-45, 0, 10]} />

      {/* Trees framing districts */}
      <Tree position={[-20, 0, 55]} scale={1.0} />
      <Tree position={[25, 0, 55]} scale={0.9} />
      <Tree position={[-30, 0, 30]} scale={0.8} />
      <Tree position={[40, 0, 45]} scale={1.1} />
      <Tree position={[-70, 0, 50]} scale={0.7} />
      <Tree position={[50, 0, -10]} scale={0.9} />
      <Tree position={[-20, 0, -20]} scale={0.8} />
      <Tree position={[30, 0, -30]} scale={1.0} />
      <Tree position={[-60, 0, -40]} scale={0.7} />
      <Tree position={[0, 0, -40]} scale={0.85} />
      <Tree position={[70, 0, 50]} scale={0.65} />
      <Tree position={[-75, 0, 30]} scale={0.9} />

      {/* Transmission Pylons */}
      <TransmissionPylon position={[-35, 0, 65]} />
      <TransmissionPylon position={[40, 0, 65]} />
      <TransmissionPylon position={[70, 0, 45]} />

      {/* Streetlights along primary transport corridors */}
      <StreetLight position={[-10, 0, 78]} intensity={dark.has('DT') ? 0.05 : loadOf('DT')} />
      <StreetLight position={[10, 0, 78]} intensity={dark.has('DT') ? 0.05 : loadOf('DT')} />
      <StreetLight position={[-45, 0, 35]} intensity={dark.has('RN') ? 0.05 : loadOf('RN')} />
      <StreetLight position={[-30, 0, -38]} intensity={dark.has('RS') ? 0.05 : loadOf('RS')} />
      <StreetLight position={[60, 0, 32]} intensity={dark.has('IN') ? 0.05 : loadOf('IN')} />

      {/* === ROADS connecting zones === */}
      <Road from={[-25, 75]} to={[25, 75]} width={3.5} />
      <Road from={[0, 75]} to={[0, 38]} width={3.5} />
      <Road from={[20, 65]} to={[65, 35]} width={3} />
      <Road from={[-15, 65]} to={[-50, 35]} width={3} />
      <Road from={[-55, 35]} to={[-55, -5]} width={2.5} />
      <Road from={[-55, -5]} to={[-35, -40]} width={2.5} />
      <Road from={[65, 35]} to={[75, 15]} width={2.5} />
      <Road from={[75, 15]} to={[65, -5]} width={2.5} />
      <Road from={[-35, -45]} to={[10, -50]} width={3} />
      <Road from={[10, -50]} to={[50, -45]} width={3} />
    </group>
  );
}
