/**
 * city-layout.tsx — Places all buildings, infrastructure, and green elements
 * across the Meridian Bay city map. This is the "dressing" layer on top of
 * the grid topology — it makes the simulation look like a real city.
 */
import {
  Hospital, School, CorporateTower, Courthouse, EvStation,
  HouseHigh, HouseLow, SolarFarm, Tree, Park, Pond, Road,
} from './city-buildings';

import { useAppFlowStore } from '../state/app-flow-store';
import { useRuntime } from '../runtime-context';
import { LOAD_MODEL } from '../engine/loads/loads';
import { asDecisionId } from '@app-types';
import { useRef } from 'react';

/**
 * Full city layout component — drop into the Canvas alongside grid markers.
 */
export function CityLayout(): JSX.Element {
  const openInspectCard = useAppFlowStore((s) => s.openInspectCard);
  const mode = useAppFlowStore((s) => s.mode);
  const runtime = useRuntime();

  // Pointer timers for long press
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPress = useRef(false);

  const handlePointerDown = () => {
    isLongPress.current = false;
    pressTimer.current = setTimeout(() => {
      isLongPress.current = true;
    }, 500); // 500ms for long press
  };

  const handlePointerUp = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  const handleInspect = (id: string, name: string, type: any, flavorText: string, teachingNote: string, incomeTier?: 'high' | 'low', equityNote?: string) => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    const loads = runtime.container.resolve(LOAD_MODEL);
    const b = (loads as any).getBuildingAppliances().find((x: any) => x.buildingId === id);
    const appliances = b ? b.appliances : [];
    
    // Sum load
    const currentConsumptionKw = appliances.reduce((sum: number, a: any) => sum + (a.isOn ? a.wattage : 0), 0) / 1000;

    let priorityTier: 1 | 2 | 3 | 4 = 4;
    let priorityLabel = 'Flexible';
    if (type === 'hospital') {
      priorityTier = 1; priorityLabel = 'Critical';
    } else if (type === 'courthouse') {
      priorityTier = 2; priorityLabel = 'High';
    } else if (type === 'school' || type === 'corporate') {
      priorityTier = 3; priorityLabel = 'Medium';
    } else {
      priorityTier = 4; priorityLabel = 'Flexible';
    }

    const card: any = {
      name,
      type,
      currentConsumptionKw: Math.round(currentConsumptionKw * 1000), // convert back to kW for display if needed, or leave as kW
      status: 'normal',
      flavorText,
      teachingNote,
      appliances,
      priorityTier,
      priorityLabel,
    };
    if (incomeTier) card.incomeTier = incomeTier;
    if (equityNote) card.equityNote = equityNote;

    if (mode === 'ActiveCrisis' && !isLongPress.current) {
      // Short click in ActiveCrisis: Radial Decision Wheel
      runtime.kernel.events.emit('DecisionRequested', {
        decisionId: asDecisionId(`dec-click-${id}-${Date.now()}`),
        prompt: `Action required for ${name}:`,
        options: [
          `Shed AC in ${name}`,
          `Delay EV Charging at ${name}`,
          `Shed Entire Zone (${id})`,
          'Cancel'
        ],
      });
    } else {
      // Long press OR Explore mode: Open Appliance panel (Inspect Card)
      openInspectCard(id, card);
    }
  };

  // Shared pointer props for long-press detection on all buildings
  const pointerProps = { onPointerDown: handlePointerDown, onPointerUp: handlePointerUp };

  return (
    <group name="city-layout">
      {/* === DOWNTOWN (DT) — Corporate cluster === */}
      <CorporateTower position={[-10, 0, 75]} height={22} onClick={() => handleInspect('DT-Corp1', 'Alpha Tower', 'corporate', 'High-density commercial office.', 'Corporate HVAC dominates daytime load.')} {...pointerProps} />
      <CorporateTower position={[10, 0, 75]} height={18} onClick={() => handleInspect('DT-Corp2', 'Beta Tower', 'corporate', 'High-density commercial office.', 'Corporate HVAC dominates daytime load.')} {...pointerProps} />
      <CorporateTower position={[0, 0, 60]} height={25} onClick={() => handleInspect('DT-Corp3', 'Gamma Tower', 'corporate', 'High-density commercial office.', 'Corporate HVAC dominates daytime load.')} {...pointerProps} />
      <CorporateTower position={[-15, 0, 60]} height={16} onClick={() => handleInspect('DT-Corp4', 'Delta Tower', 'corporate', 'High-density commercial office.', 'Corporate HVAC dominates daytime load.')} {...pointerProps} />
      <CorporateTower position={[15, 0, 60]} height={20} onClick={() => handleInspect('DT-Corp5', 'Epsilon Tower', 'corporate', 'High-density commercial office.', 'Corporate HVAC dominates daytime load.')} {...pointerProps} />

      {/* === HOSPITAL — near downtown === */}
      <Hospital position={[30, 0, 68]} onClick={() => handleInspect('DT-Hosp', 'Meridian General', 'hospital', 'Critical infrastructure.', 'Hospitals must never be shed.')} />

      {/* === COURTHOUSE — government center === */}
      <Courthouse position={[15, 0, 45]} onClick={() => handleInspect('DT-Gov1', 'Meridian Courthouse', 'courthouse', 'Public services and administration.', 'Shed only as an absolute last resort.')} />

      {/* === SCHOOLS — scattered near residential === */}
      <School position={[-50, 0, 25]} onClick={() => handleInspect('RN-Sch1', 'North High', 'school', 'Community school.', 'Schools have moderate load.')} />
      <School position={[-30, 0, -50]} onClick={() => handleInspect('RS-Sch2', 'South Elementary', 'school', 'Community school.', 'Schools have moderate load.', 'low', 'Ensure equal educational access.')} />

      {/* === EV STATIONS — near commercial + residential === */}
      <EvStation position={[-5, 0, 50]} onClick={() => handleInspect('RN-EV1', 'North EV Station', 'ev_station', 'Public fast charging.', 'EV charging creates massive localized demand.')} />
      <EvStation position={[55, 0, 25]} onClick={() => handleInspect('RS-EV2', 'East EV Station', 'ev_station', 'Public fast charging.', 'EV charging creates massive localized demand.', 'low')} />
      <EvStation position={[-40, 0, -25]} onClick={() => handleInspect('AP-EV3', 'Airport EV Station', 'ev_station', 'Public fast charging.', 'EV charging creates massive localized demand.')} />

      {/* === RESIDENTIAL NORTH (RN) — high-income houses === */}
      <HouseHigh position={[-60, 0, 40]} onClick={() => handleInspect('RN-House1', 'North Estate', 'house_high', 'Wealthy suburb.', 'High AC and EV load.', 'high')} />
      <HouseHigh position={[-52, 0, 40]} onClick={() => handleInspect('RN-House2', 'North Estate', 'house_high', 'Wealthy suburb.', 'High AC and EV load.', 'high')} />
      <HouseHigh position={[-68, 0, 20]} onClick={() => handleInspect('RN-House3', 'North Estate', 'house_high', 'Wealthy suburb.', 'High AC and EV load.', 'high')} />
      <HouseHigh position={[-60, 0, 20]} onClick={() => handleInspect('RN-House4', 'North Estate', 'house_high', 'Wealthy suburb.', 'High AC and EV load.', 'high')} />
      <HouseHigh position={[-58, 0, 0]} onClick={() => handleInspect('RN-House5', 'North Estate', 'house_high', 'Wealthy suburb.', 'High AC and EV load.', 'high')} />
      <HouseHigh position={[-50, 0, 0]} onClick={() => handleInspect('RN-House6', 'North Estate', 'house_high', 'Wealthy suburb.', 'High AC and EV load.', 'high')} />
      <HouseHigh position={[-62, 0, -8]} onClick={() => handleInspect('RN-House7', 'North Estate', 'house_high', 'Wealthy suburb.', 'High AC and EV load.', 'high')} />

      {/* === RESIDENTIAL SOUTH (RS) — low-income houses === */}
      <HouseLow position={[-38, 0, -35]} onClick={() => handleInspect('RS-House1', 'South Community', 'house_low', 'Working class neighborhood.', 'Lower base load, sensitive to shedding.', 'low', 'Shedding this zone disproportionately affects low-income families.')} />
      <HouseLow position={[-32, 0, -35]} onClick={() => handleInspect('RS-House2', 'South Community', 'house_low', 'Working class neighborhood.', 'Lower base load, sensitive to shedding.', 'low', 'Shedding this zone disproportionately affects low-income families.')} />
      <HouseLow position={[-44, 0, -35]} onClick={() => handleInspect('RS-House3', 'South Community', 'house_low', 'Working class neighborhood.', 'Lower base load, sensitive to shedding.', 'low', 'Shedding this zone disproportionately affects low-income families.')} />
      <HouseLow position={[-53, 0, -55]} onClick={() => handleInspect('RS-House4', 'South Community', 'house_low', 'Working class neighborhood.', 'Lower base load, sensitive to shedding.', 'low', 'Shedding this zone disproportionately affects low-income families.')} />
      <HouseLow position={[-47, 0, -55]} onClick={() => handleInspect('RS-House5', 'South Community', 'house_low', 'Working class neighborhood.', 'Lower base load, sensitive to shedding.', 'low', 'Shedding this zone disproportionately affects low-income families.')} />
      <HouseLow position={[-53, 0, -62]} onClick={() => handleInspect('RS-House6', 'South Community', 'house_low', 'Working class neighborhood.', 'Lower base load, sensitive to shedding.', 'low', 'Shedding this zone disproportionately affects low-income families.')} />
      <HouseLow position={[-38, 0, -70]} onClick={() => handleInspect('RS-House7', 'South Community', 'house_low', 'Working class neighborhood.', 'Lower base load, sensitive to shedding.', 'low', 'Shedding this zone disproportionately affects low-income families.')} />
      <HouseLow position={[-32, 0, -70]} onClick={() => handleInspect('RS-House8', 'South Community', 'house_low', 'Working class neighborhood.', 'Lower base load, sensitive to shedding.', 'low', 'Shedding this zone disproportionately affects low-income families.')} />
      <HouseLow position={[-44, 0, -70]} onClick={() => handleInspect('RS-House9', 'South Community', 'house_low', 'Working class neighborhood.', 'Lower base load, sensitive to shedding.', 'low', 'Shedding this zone disproportionately affects low-income families.')} />

      {/* === INDUSTRIAL (IN) — factories already rendered by grid-scene === */}

      {/* === SOLAR FARM — at generation source === */}
      <SolarFarm position={[-80, 0, 75]} onClick={() => handleInspect('RN-Solar', 'Solar Array', 'solar_farm', 'Utility scale solar.', 'Generation varies with weather.')} />

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
