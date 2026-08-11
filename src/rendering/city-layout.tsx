/**
 * city-layout.tsx — Places all buildings, infrastructure, substations, renewables,
 * and streetlights across the Meridian Bay city map.
 *
 * Responsive in real time to live operator decisions and simulation states with
 * high visual contrast:
 * - Commercial load shedding (DT corporate towers & complexes visibly dim to dark windows)
 * - Residential load shedding (RN & RS estates dim)
 * - Industrial shutdown (IN factories deactivate)
 * - Hospital priority (Hospital stays brightly lit with emergency priority aura while surrounding DT dims)
 * - Generator fault state (Flicker & trip warning)
 * - Battery storage activation (BESS LED pulse)
 * - Solar production increase (Solar array output glow)
 * - Blackout cascades (Progressive wave of light failure)
 * - Grid recovery (Progressive restoration of city lights)
 */
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import type { ReactNode } from 'react';

import { useAppFlowStore, useGridStore, useUiStore } from '@state';

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

/**
 * DimGroup — drives high-contrast emissive lighting based on night arc, zone blackout state,
 * and live operator load shedding decisions (commercial, residential, industrial).
 */
function DimGroup({
  dimmed,
  loadShedFactor = 1,
  flicker = false,
  children,
}: {
  dimmed: boolean;
  loadShedFactor?: number;
  flicker?: boolean;
  children: ReactNode;
}): JSX.Element {
  const ref = useRef<THREE.Group>(null);
  const factorRef = useRef(1);
  const saved = useRef(
    new Map<THREE.MeshStandardMaterial, { emissiveIntensity: number; color: THREE.Color }>(),
  );

  useFrame((_, delta) => {
    const group = ref.current;
    if (group === null) return;
    const glow = windowGlow(nightFactor(useGridStore.getState().tick));
    // High contrast factor: 0.05 when dimmed/blackout, 0.25 when load shed, 1.0 normal
    const targetFactor = dimmed ? 0.05 : loadShedFactor < 1.0 ? 0.25 * loadShedFactor : 1.0;
    
    // Smooth transition
    factorRef.current += (targetFactor - factorRef.current) * Math.min(1, delta * 4.5);

    const flickerMultiplier = flicker ? 0.2 + Math.random() * 0.8 : 1.0;

    group.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const material of materials) {
        if (!(material instanceof THREE.MeshStandardMaterial)) continue;
        let original = saved.current.get(material);
        if (original === undefined) {
          original = {
            emissiveIntensity: material.emissiveIntensity,
            color: material.color.clone(),
          };
          saved.current.set(material, original);
        }

        const targetEmissive = (dimmed || loadShedFactor < 0.5)
          ? 0.02
          : original.emissiveIntensity * glow * loadShedFactor * flickerMultiplier;
        material.emissiveIntensity += (targetEmissive - material.emissiveIntensity) * Math.min(1, delta * 5.0);
        material.color.copy(original.color).multiplyScalar(factorRef.current);
      }
    });
  });

  return <group ref={ref}>{children}</group>;
}

/**
 * Full city layout component — drop into the Canvas alongside grid markers.
 */
export function CityLayout(): JSX.Element {
  const selectAsset = useUiStore((s) => s.selectAsset);
  const zones = useGridStore((s) => s.zones);
  const generators = useGridStore((s) => s.generators);
  const decisionLog = useAppFlowStore((s) => s.decisionLog);

  const dark = new Set(
    zones.filter((z) => z.state === 'Blackout').map((z) => z.zone as string),
  );

  // Live decision responses from operator decision log
  const commercialShed = decisionLog.some((d) => d.action.type.includes('commercial'));
  const residentialShed = decisionLog.some((d) => d.action.type.includes('residential'));
  const industrialShed = decisionLog.some((d) => d.action.type.includes('industrial'));
  const hospitalPriority = decisionLog.some((d) => d.action.type.includes('hospital') || d.action.type.includes('priority'));
  const batteryActive = decisionLog.some((d) => d.action.type.includes('battery') || d.action.type.includes('bess'));
  const solarActive = decisionLog.some((d) => d.action.type.includes('solar') || d.action.type.includes('renewable'));

  // Thermal Generator state
  const thermalGen = generators.find((g) => g.id === 'G_THERMAL_1');
  const isThermalTripped = thermalGen?.tripped ?? false;

  const select = (id: string) => (e: { stopPropagation(): void }) => {
    e.stopPropagation();
    selectAsset({ kind: 'building', id });
  };

  return (
    <group name="city-layout">
      {/* === DOWNTOWN (DT) — Corporate & Commercial District === */}
      <DimGroup dimmed={dark.has('DT')} loadShedFactor={commercialShed ? 0.2 : 1.0}>
        <CorporateTower position={at('DT-Corp1')} height={24} rotation={0.1} onClick={select('DT-Corp1')} />
        <CorporateTower position={at('DT-Corp2')} height={19} rotation={-0.1} onClick={select('DT-Corp2')} />
        <CorporateTower position={at('DT-Corp3')} height={28} rotation={0.05} onClick={select('DT-Corp3')} />
        <CorporateTower position={at('DT-Corp4')} height={17} rotation={-0.15} onClick={select('DT-Corp4')} />
        <CorporateTower position={at('DT-Corp5')} height={22} rotation={0.2} onClick={select('DT-Corp5')} />
        <CorporateTower position={at('DT-Corp6')} height={18} rotation={-0.05} onClick={select('DT-Corp6')} />
        <CorporateTower position={at('DT-Corp7')} height={21} rotation={0.12} onClick={select('DT-Corp7')} />
        <CommercialComplex position={at('DT-Mall1')} onClick={select('DT-Mall1')} />
        <Courthouse position={at('DT-Gov1')} onClick={select('DT-Gov1')} />
      </DimGroup>

      {/* Downtown Substation */}
      <Substation position={at('SUB-DT')} isOverloaded={dark.has('DT')} onClick={select('SUB-DT')} />

      {/* Hospital — Priority Infrastructure (Remains brightly illuminated) */}
      <Hospital
        position={at('DT-Hosp')}
        isPrioritized={hospitalPriority}
        onClick={select('DT-Hosp')}
      />

      {/* === INDUSTRIAL DISTRICT (IN) === */}
      <DimGroup dimmed={dark.has('IN')} loadShedFactor={industrialShed ? 0.1 : 1.0}>
        <IndustrialFactory position={at('IN-Fact1')} isActive={!industrialShed && !dark.has('IN')} onClick={select('IN-Fact1')} />
        <IndustrialFactory position={at('IN-Fact2')} isActive={!industrialShed && !dark.has('IN')} onClick={select('IN-Fact2')} />
        <IndustrialFactory position={at('IN-Fact3')} isActive={!industrialShed && !dark.has('IN')} onClick={select('IN-Fact3')} />
      </DimGroup>
      <Substation position={at('SUB-IN')} isOverloaded={dark.has('IN')} onClick={select('SUB-IN')} />
      <ThermalGenerator position={at('GEN-Thermal1')} isTripped={isThermalTripped} onClick={select('GEN-Thermal1')} />

      {/* === RESIDENTIAL NORTH (RN) — High Income Estates & Apartments === */}
      <DimGroup dimmed={dark.has('RN')} loadShedFactor={residentialShed ? 0.4 : 1.0}>
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
      <Substation position={at('SUB-RN')} isOverloaded={dark.has('RN')} onClick={select('SUB-RN')} />

      {/* === RESIDENTIAL SOUTH (RS) — Community Estates & Apartments === */}
      <DimGroup dimmed={dark.has('RS')} loadShedFactor={residentialShed ? 0.4 : 1.0}>
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
      <Substation position={at('SUB-RS')} isOverloaded={dark.has('RS')} onClick={select('SUB-RS')} />

      {/* === RENEWABLE ENERGY & BATTERY STORAGE ZONE === */}
      <SolarFarm position={at('RN-Solar')} isActive={solarActive || !dark.has('RN')} onClick={select('RN-Solar')} />
      <BatteryStorage position={at('BESS-1')} isActive={batteryActive} onClick={select('BESS-1')} />
      <BatteryStorage position={at('BESS-2')} isActive={batteryActive} onClick={select('BESS-2')} />
      <WindTurbine position={at('GEN-Wind1')} speed={2.0} onClick={select('GEN-Wind1')} />
      <WindTurbine position={at('GEN-Wind2')} speed={1.8} onClick={select('GEN-Wind2')} />

      {/* === AIRPORT INFRASTRUCTURE (AP) === */}
      <DimGroup dimmed={dark.has('AP')}>
        <EvStation position={at('AP-EV3')} onClick={select('AP-EV3')} />
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
      <StreetLight position={[-10, 0, 78]} intensity={dark.has('DT') ? 0.05 : commercialShed ? 0.25 : 1.0} />
      <StreetLight position={[10, 0, 78]} intensity={dark.has('DT') ? 0.05 : commercialShed ? 0.25 : 1.0} />
      <StreetLight position={[-45, 0, 35]} intensity={dark.has('RN') ? 0.05 : residentialShed ? 0.35 : 1.0} />
      <StreetLight position={[-30, 0, -38]} intensity={dark.has('RS') ? 0.05 : residentialShed ? 0.35 : 1.0} />
      <StreetLight position={[60, 0, 32]} intensity={dark.has('IN') ? 0.05 : industrialShed ? 0.15 : 1.0} />

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
