/**
 * city-layout.tsx — Places all buildings, infrastructure, and green elements
 * across the Meridian Bay city map. This is the "dressing" layer on top of
 * the grid topology — it makes the simulation look like a real city.
 *
 * RENDERER PURITY: this layer only (a) reads projections and (b) reports
 * selection to the ui-store. It never resolves engine services and never
 * emits simulation events.
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { ReactNode } from 'react';

import { useGridStore, useUiStore } from '@state';

import { BUILDING_POSITIONS } from './camera/city-positions';
import {
  Hospital, School, CorporateTower, Courthouse, EvStation,
  HouseHigh, HouseLow, SolarFarm, Tree, Park, Pond, Road,
} from './city-buildings';

/** World position for a building id from the shared table. */
const at = (id: string): [number, number, number] => {
  const p = BUILDING_POSITIONS[id] ?? [0, 0];
  return [p[0], 0, p[1]];
};

/**
 * Wraps a building subtree and visually de-energizes it when its zone is in
 * blackout: emissives to zero, base colors darkened. Restores on re-power.
 */
function DimGroup({ dimmed, children }: { dimmed: boolean; children: ReactNode }): JSX.Element {
  const ref = useRef<THREE.Group>(null);
  const saved = useRef(
    new Map<THREE.MeshStandardMaterial, { emissiveIntensity: number; color: THREE.Color }>(),
  );

  useEffect(() => {
    const group = ref.current;
    if (group === null) return;
    group.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const material of materials) {
        if (!(material instanceof THREE.MeshStandardMaterial)) continue;
        if (dimmed) {
          if (!saved.current.has(material)) {
            saved.current.set(material, {
              emissiveIntensity: material.emissiveIntensity,
              color: material.color.clone(),
            });
          }
          material.emissiveIntensity = 0;
          material.color.copy(saved.current.get(material)!.color).multiplyScalar(0.3);
        } else {
          const original = saved.current.get(material);
          if (original) {
            material.emissiveIntensity = original.emissiveIntensity;
            material.color.copy(original.color);
          }
        }
      }
    });
  }, [dimmed]);

  return <group ref={ref}>{children}</group>;
}

/**
 * Full city layout component — drop into the Canvas alongside grid markers.
 */
export function CityLayout(): JSX.Element {
  const selectAsset = useUiStore((s) => s.selectAsset);
  const zones = useGridStore((s) => s.zones);

  const dark = new Set(
    zones.filter((z) => z.state === 'Blackout').map((z) => z.zone as string),
  );

  const select = (id: string) => (e: { stopPropagation(): void }) => {
    e.stopPropagation();
    selectAsset({ kind: 'building', id });
  };

  return (
    <group name="city-layout">
      {/* === DOWNTOWN (DT) — Corporate cluster === */}
      <DimGroup dimmed={dark.has('DT')}>
        <CorporateTower position={at('DT-Corp1')} height={22} onClick={select('DT-Corp1')} />
        <CorporateTower position={at('DT-Corp2')} height={18} onClick={select('DT-Corp2')} />
        <CorporateTower position={at('DT-Corp3')} height={25} onClick={select('DT-Corp3')} />
        <CorporateTower position={at('DT-Corp4')} height={16} onClick={select('DT-Corp4')} />
        <CorporateTower position={at('DT-Corp5')} height={20} onClick={select('DT-Corp5')} />
        <Hospital position={at('DT-Hosp')} onClick={select('DT-Hosp')} />
        <Courthouse position={at('DT-Gov1')} onClick={select('DT-Gov1')} />
      </DimGroup>

      {/* === RESIDENTIAL NORTH (RN) === */}
      <DimGroup dimmed={dark.has('RN')}>
        <School position={at('RN-Sch1')} onClick={select('RN-Sch1')} />
        <EvStation position={at('RN-EV1')} onClick={select('RN-EV1')} />
        <HouseHigh position={at('RN-House1')} onClick={select('RN-House1')} />
        <HouseHigh position={at('RN-House2')} onClick={select('RN-House2')} />
        <HouseHigh position={at('RN-House3')} onClick={select('RN-House3')} />
        <HouseHigh position={at('RN-House4')} onClick={select('RN-House4')} />
        <HouseHigh position={at('RN-House5')} onClick={select('RN-House5')} />
        <HouseHigh position={at('RN-House6')} onClick={select('RN-House6')} />
        <HouseHigh position={at('RN-House7')} onClick={select('RN-House7')} />
        <SolarFarm position={at('RN-Solar')} onClick={select('RN-Solar')} />
      </DimGroup>

      {/* === RESIDENTIAL SOUTH (RS) === */}
      <DimGroup dimmed={dark.has('RS')}>
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
      </DimGroup>

      {/* === AIRPORT (AP) === */}
      <DimGroup dimmed={dark.has('AP')}>
        <EvStation position={at('AP-EV3')} onClick={select('AP-EV3')} />
      </DimGroup>

      {/* === GREEN INFRASTRUCTURE (not powered — never dimmed) === */}
      <Park position={[0, 0, 40]} size={[16, 10]} />
      <Pond position={[-45, 0, 10]} />

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
      <Tree position={[70, 0, 50]} scale={0.6} />
      <Tree position={[-75, 0, 30]} scale={0.9} />

      {/* === ROADS connecting zones === */}
      <Road from={[-20, 75]} to={[25, 75]} width={3} />
      <Road from={[0, 75]} to={[0, 40]} width={3} />
      <Road from={[20, 65]} to={[60, 35]} width={2.5} />
      <Road from={[-15, 65]} to={[-50, 35]} width={2.5} />
      <Road from={[-55, 35]} to={[-55, -5]} width={2} />
      <Road from={[-55, -5]} to={[-35, -40]} width={2} />
      <Road from={[65, 35]} to={[75, 15]} width={2} />
      <Road from={[75, 15]} to={[65, -5]} width={2} />
      <Road from={[-35, -45]} to={[10, -50]} width={2.5} />
      <Road from={[10, -50]} to={[50, -45]} width={2.5} />
    </group>
  );
}
