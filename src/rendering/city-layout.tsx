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

import {
  Hospital, School, CorporateTower, Courthouse, EvStation,
  HouseHigh, HouseLow, SolarFarm, Tree, Park, Pond, Road,
} from './city-buildings';

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
        <CorporateTower position={[-10, 0, 75]} height={22} onClick={select('DT-Corp1')} />
        <CorporateTower position={[10, 0, 75]} height={18} onClick={select('DT-Corp2')} />
        <CorporateTower position={[0, 0, 60]} height={25} onClick={select('DT-Corp3')} />
        <CorporateTower position={[-15, 0, 60]} height={16} onClick={select('DT-Corp4')} />
        <CorporateTower position={[15, 0, 60]} height={20} onClick={select('DT-Corp5')} />
        <Hospital position={[30, 0, 68]} onClick={select('DT-Hosp')} />
        <Courthouse position={[15, 0, 45]} onClick={select('DT-Gov1')} />
      </DimGroup>

      {/* === RESIDENTIAL NORTH (RN) === */}
      <DimGroup dimmed={dark.has('RN')}>
        <School position={[-50, 0, 25]} onClick={select('RN-Sch1')} />
        <EvStation position={[-5, 0, 50]} onClick={select('RN-EV1')} />
        <HouseHigh position={[-60, 0, 40]} onClick={select('RN-House1')} />
        <HouseHigh position={[-52, 0, 40]} onClick={select('RN-House2')} />
        <HouseHigh position={[-68, 0, 20]} onClick={select('RN-House3')} />
        <HouseHigh position={[-60, 0, 20]} onClick={select('RN-House4')} />
        <HouseHigh position={[-58, 0, 0]} onClick={select('RN-House5')} />
        <HouseHigh position={[-50, 0, 0]} onClick={select('RN-House6')} />
        <HouseHigh position={[-62, 0, -8]} onClick={select('RN-House7')} />
        <SolarFarm position={[-80, 0, 75]} onClick={select('RN-Solar')} />
      </DimGroup>

      {/* === RESIDENTIAL SOUTH (RS) === */}
      <DimGroup dimmed={dark.has('RS')}>
        <School position={[-30, 0, -50]} onClick={select('RS-Sch2')} />
        <EvStation position={[55, 0, 25]} onClick={select('RS-EV2')} />
        <HouseLow position={[-38, 0, -35]} onClick={select('RS-House1')} />
        <HouseLow position={[-32, 0, -35]} onClick={select('RS-House2')} />
        <HouseLow position={[-44, 0, -35]} onClick={select('RS-House3')} />
        <HouseLow position={[-53, 0, -55]} onClick={select('RS-House4')} />
        <HouseLow position={[-47, 0, -55]} onClick={select('RS-House5')} />
        <HouseLow position={[-53, 0, -62]} onClick={select('RS-House6')} />
        <HouseLow position={[-38, 0, -70]} onClick={select('RS-House7')} />
        <HouseLow position={[-32, 0, -70]} onClick={select('RS-House8')} />
        <HouseLow position={[-44, 0, -70]} onClick={select('RS-House9')} />
      </DimGroup>

      {/* === AIRPORT (AP) === */}
      <DimGroup dimmed={dark.has('AP')}>
        <EvStation position={[-40, 0, -25]} onClick={select('AP-EV3')} />
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
