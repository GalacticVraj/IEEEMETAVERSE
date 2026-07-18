/**
 * city-layout.tsx — Places all buildings, infrastructure, and green elements
 * across the Meridian Bay city map. This is the "dressing" layer on top of
 * the grid topology — it makes the simulation look like a real city.
 */
import {
  Hospital, School, CorporateTower, EvStation,
  HouseHigh, HouseLow, SolarFarm, Tree, Park, Pond, Road,
} from './city-buildings';

/**
 * Full city layout component — drop into the Canvas alongside grid markers.
 */
export function CityLayout(): JSX.Element {
  return (
    <group name="city-layout">
      {/* === DOWNTOWN (DT) — Corporate cluster === */}
      <CorporateTower position={[-10, 0, 75]} height={22} />
      <CorporateTower position={[10, 0, 75]} height={18} />
      <CorporateTower position={[0, 0, 60]} height={25} />
      <CorporateTower position={[-15, 0, 60]} height={16} />
      <CorporateTower position={[15, 0, 60]} height={20} />

      {/* === HOSPITAL — near downtown === */}
      <Hospital position={[30, 0, 68]} />

      {/* === SCHOOLS — scattered near residential === */}
      <School position={[-50, 0, 25]} />
      <School position={[-30, 0, -50]} />

      {/* === EV STATIONS — near commercial + residential === */}
      <EvStation position={[-5, 0, 50]} />
      <EvStation position={[55, 0, 25]} />
      <EvStation position={[-40, 0, -25]} />

      {/* === RESIDENTIAL NORTH (RN) — high-income houses === */}
      <HouseHigh position={[-60, 0, 40]} />
      <HouseHigh position={[-52, 0, 40]} />
      <HouseHigh position={[-68, 0, 20]} />
      <HouseHigh position={[-60, 0, 20]} />
      <HouseHigh position={[-58, 0, 0]} />
      <HouseHigh position={[-50, 0, 0]} />
      <HouseHigh position={[-62, 0, -8]} />

      {/* === RESIDENTIAL SOUTH (RS) — low-income houses === */}
      <HouseLow position={[-38, 0, -35]} />
      <HouseLow position={[-32, 0, -35]} />
      <HouseLow position={[-44, 0, -35]} />
      <HouseLow position={[-53, 0, -55]} />
      <HouseLow position={[-47, 0, -55]} />
      <HouseLow position={[-53, 0, -62]} />
      <HouseLow position={[-38, 0, -70]} />
      <HouseLow position={[-32, 0, -70]} />
      <HouseLow position={[-44, 0, -70]} />

      {/* === INDUSTRIAL (IN) — factories already rendered by grid-scene === */}

      {/* === SOLAR FARM — at generation source === */}
      <SolarFarm position={[-80, 0, 75]} />

      {/* === GREEN INFRASTRUCTURE === */}
      {/* Central park / greenway */}
      <Park position={[0, 0, 40]} size={[16, 10]} />
      {/* Pond near residential */}
      <Pond position={[-45, 0, 10]} />

      {/* Scattered trees throughout the city */}
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
      {/* Downtown spine */}
      <Road from={[-20, 75]} to={[25, 75]} width={3} />
      <Road from={[0, 75]} to={[0, 40]} width={3} />
      {/* Downtown to Industrial */}
      <Road from={[20, 65]} to={[60, 35]} width={2.5} />
      {/* Downtown to Residential North */}
      <Road from={[-15, 65]} to={[-50, 35]} width={2.5} />
      {/* Residential ring road */}
      <Road from={[-55, 35]} to={[-55, -5]} width={2} />
      <Road from={[-55, -5]} to={[-35, -40]} width={2} />
      {/* Industrial connector */}
      <Road from={[65, 35]} to={[75, 15]} width={2} />
      <Road from={[75, 15]} to={[65, -5]} width={2} />
      {/* Cross-town south */}
      <Road from={[-35, -45]} to={[10, -50]} width={2.5} />
      <Road from={[10, -50]} to={[50, -45]} width={2.5} />
    </group>
  );
}
