/**
 * learning-copy.ts — plain-language teaching copy for the mission-control UI.
 *
 * Pure functions + static tables ONLY. Inputs are live projection values; the
 * outputs are sentences. No simulation logic, no state, no fabricated numbers —
 * every figure shown is either topology data or a labeled estimate.
 */
import type { LineFlow, ZoneStatus } from '@engine';

// ---------------------------------------------------------------------------
// Zones
// ---------------------------------------------------------------------------

export interface ZoneInfo {
  readonly name: string;
  readonly role: string;
}

export const ZONE_INFO: Record<string, ZoneInfo> = {
  DT: { name: 'Downtown', role: 'Commercial core + Meridian General Hospital (critical)' },
  IN: { name: 'Industrial', role: 'Heavy manufacturing — largest single demand block' },
  RN: { name: 'Residential North', role: 'Suburban homes, school, EV charging, solar farm' },
  RS: { name: 'Residential South', role: 'Dense working-class neighborhoods and a school' },
  AP: { name: 'Airport', role: 'Terminal + air-traffic control (critical)' },
  HB: { name: 'Harbor', role: 'Port industry + water treatment plant (critical)' },
};

/** ≈800 households served per MW of residential demand. A labeled ESTIMATE. */
const HOUSEHOLDS_PER_MW = 800;

/** Rough households affected by an unserved-MW figure. Always present as "≈". */
export function estimateHouseholdsAffected(unservedMw: number): number {
  return Math.round(unservedMw * HOUSEHOLDS_PER_MW);
}

export function zoneDisplayName(zoneId: string): string {
  return ZONE_INFO[zoneId]?.name ?? zoneId;
}

// ---------------------------------------------------------------------------
// Transmission lines
// ---------------------------------------------------------------------------

export interface LineExplanation {
  readonly statusLabel: string;
  readonly statusTone: 'nominal' | 'caution' | 'warning' | 'critical' | 'offline';
  readonly cause: string;
  readonly impact: string;
  readonly action: string;
}

export function explainLine(
  flow: LineFlow | undefined,
  zonesTouched: readonly string[],
): LineExplanation {
  const zoneNames = zonesTouched.map(zoneDisplayName).join(' and ');
  if (flow === undefined) {
    return {
      statusLabel: 'NO DATA',
      statusTone: 'offline',
      cause: 'No live telemetry for this line yet — the simulation has not solved a flow for it.',
      impact: `Corridor serves ${zoneNames}.`,
      action: 'Start a scenario to energize the grid.',
    };
  }
  const pct = Math.round((flow.loading as number) * 100);
  if (flow.state === 'Tripped' || flow.state === 'Tripping') {
    return {
      statusLabel: flow.state === 'Tripped' ? 'TRIPPED' : 'TRIPPING',
      statusTone: 'critical',
      cause: 'Protection opened this line — sustained current above its thermal limit would have damaged the conductor.',
      impact: `Power that flowed here now reroutes through neighboring corridors. ${zoneNames} depend on this path.`,
      action: 'Reduce demand in the zones this corridor feeds; the line recloses automatically once it cools.',
    };
  }
  if (flow.state === 'Cooling') {
    return {
      statusLabel: 'RECLOSING',
      statusTone: 'caution',
      cause: 'The conductor cooled below its warning temperature, so its breaker is closing again.',
      impact: `Capacity between ${zoneNames} is being restored.`,
      action: 'Watch loading as flow returns — a heavy re-pickup can re-trip it.',
    };
  }
  if (pct >= 100) {
    return {
      statusLabel: 'OVERLOADED',
      statusTone: 'critical',
      cause: 'Electricity flow exceeds the thermal rating — the conductor is heating toward its protection limit.',
      impact: `If protection trips it, ${zoneNames} lose this corridor and neighbors absorb the flow.`,
      action: 'Shed or shift demand fed by this corridor NOW.',
    };
  }
  if (pct >= 80) {
    return {
      statusLabel: 'HIGH STRESS',
      statusTone: 'warning',
      cause: 'High demand is pushing flow close to the corridor limit.',
      impact: `Little headroom remains for ${zoneNames}; any nearby trip could overload it.`,
      action: 'Pre-emptively reduce flexible demand in the zones it feeds.',
    };
  }
  if (pct >= 60) {
    return {
      statusLabel: 'ELEVATED',
      statusTone: 'caution',
      cause: 'Loading is elevated but inside safe limits.',
      impact: `${zoneNames} corridor has moderate headroom.`,
      action: 'No action needed — keep it on your scan.',
    };
  }
  return {
    statusLabel: 'NOMINAL',
    statusTone: 'nominal',
    cause: 'Flow is comfortably within the thermal rating.',
    impact: `${zoneNames} corridor has ample headroom.`,
    action: 'No action needed.',
  };
}

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

export const GENERATOR_INFO: Record<string, { name: string; blurb: string }> = {
  'G-BASE-S': {
    name: 'Southbay Baseload Plant',
    blurb: 'The workhorse — steady 400 MW, but slow: it cannot ramp to follow swings.',
  },
  'G-PEAK-S': {
    name: 'South Gas Peaker',
    blurb: 'Fast-ramping gas turbine held in reserve for demand spikes.',
  },
  'G-PEAK-IN': {
    name: 'Industrial Gas Peaker',
    blurb: 'Local peaker inside the industrial district.',
  },
  'G-SOLAR': {
    name: 'Northfield Solar Farm',
    blurb: 'Clean daytime energy — output rises and falls with the sun and weather.',
  },
  'G-WIND': {
    name: 'Northfield Wind Farm',
    blurb: 'Wind output varies constantly; storms can force a protective shutdown.',
  },
  'G-BATT-DT': {
    name: 'Downtown Battery',
    blurb: 'Stored energy that can discharge instantly — perfect for short emergencies.',
  },
  'G-IMPORT': {
    name: 'Regional Import Tie',
    blurb: 'Power purchased from the neighboring grid over the harbor interconnect.',
  },
  'G-GAS-HB': {
    name: 'Harbor Gas Unit',
    blurb: 'Small but black-start capable — it can restart a dead grid.',
  },
};

export interface GeneratorExplanation {
  readonly name: string;
  readonly statusLabel: string;
  readonly statusTone: 'nominal' | 'caution' | 'critical' | 'offline';
  readonly cause: string;
  readonly impact: string;
  readonly action: string;
}

export function explainGenerator(
  id: string,
  outputMw: number | undefined,
  capacityMw: number,
  tripped: boolean,
): GeneratorExplanation {
  const info = GENERATOR_INFO[id] ?? { name: id, blurb: '' };
  if (tripped) {
    return {
      name: info.name,
      statusLabel: 'TRIPPED',
      statusTone: 'critical',
      cause: 'The unit disconnected — an internal fault or scenario event forced it offline.',
      impact: `${Math.round(capacityMw)} MW of capacity is gone; other units and imports must cover the gap or demand must fall.`,
      action: 'Reduce demand until the remaining fleet covers the load.',
    };
  }
  const out = outputMw ?? 0;
  const pct = capacityMw > 0 ? out / capacityMw : 0;
  if (pct >= 0.95) {
    return {
      name: info.name,
      statusLabel: 'AT LIMIT',
      statusTone: 'caution',
      cause: `${info.blurb} It is running at its maximum.`,
      impact: 'No spare capacity here — the next demand increase must come from elsewhere.',
      action: 'Free up reserve by trimming flexible demand.',
    };
  }
  return {
    name: info.name,
    statusLabel: out > 0 ? 'GENERATING' : 'STANDBY',
    statusTone: out > 0 ? 'nominal' : 'offline',
    cause: info.blurb,
    impact:
      out > 0
        ? `Supplying ${Math.round(out)} MW of the city's demand.`
        : 'Held in reserve — it can be dispatched when demand rises.',
    action: 'No action needed.',
  };
}

// ---------------------------------------------------------------------------
// Buses
// ---------------------------------------------------------------------------

export function explainBus(zoneId: string, zoneStatus: ZoneStatus | undefined): {
  cause: string;
  impact: string;
  action: string;
} {
  const name = zoneDisplayName(zoneId);
  if (zoneStatus?.state === 'Blackout') {
    return {
      cause: `Every energized path into ${name} was lost, so this bus is de-energized.`,
      impact: `${Math.round((zoneStatus.unservedLoad) ?? 0)} MW unserved — ≈${estimateHouseholdsAffected(
        (zoneStatus.unservedLoad) ?? 0,
      ).toLocaleString()} households (estimate).`,
      action: 'Restore a transmission path into the zone.',
    };
  }
  if (zoneStatus?.state === 'Degraded') {
    return {
      cause: `Part of ${name} lost its supply path; this substation area is running degraded.`,
      impact: 'Some feeders in the zone are unserved.',
      action: 'Check which corridor into the zone tripped.',
    };
  }
  return {
    cause: `This 230 kV bus is a junction point distributing power inside ${name}.`,
    impact: `${ZONE_INFO[zoneId]?.role ?? ''}`,
    action: 'No action needed.',
  };
}

// ---------------------------------------------------------------------------
// Buildings (city dressing — teaching notes keyed by building id)
// ---------------------------------------------------------------------------

export interface BuildingNote {
  readonly name: string;
  readonly role: string;
  readonly teachingNote: string;
  readonly priorityTier: 1 | 2 | 3 | 4;
  readonly priorityLabel: string;
  readonly equityNote?: string;
}

const note = (
  name: string,
  role: string,
  teachingNote: string,
  priorityTier: 1 | 2 | 3 | 4,
  priorityLabel: string,
  equityNote?: string,
): BuildingNote => ({
  name,
  role,
  teachingNote,
  priorityTier,
  priorityLabel,
  ...(equityNote !== undefined ? { equityNote } : {}),
});

export const BUILDING_NOTES: Record<string, BuildingNote> = {
  'DT-Hosp': note(
    'Meridian General',
    'Critical infrastructure',
    'Hospitals must never be shed — patients depend on continuous power.',
    1,
    'Critical',
  ),
  'DT-Gov1': note(
    'Meridian Courthouse',
    'Public services and administration',
    'Shed only as an absolute last resort.',
    2,
    'High',
  ),
  'RN-Sch1': note('North High', 'Community school', 'Schools have moderate, schedulable load.', 3, 'Medium'),
  'RS-Sch2': note(
    'South Elementary',
    'Community school',
    'Schools have moderate, schedulable load.',
    3,
    'Medium',
    'Ensure equal educational access across income tiers.',
  ),
  'RN-EV1': note(
    'North EV Station',
    'Public fast charging',
    'EV charging creates massive localized demand — an easy first thing to pause.',
    4,
    'Flexible',
  ),
  'RS-EV2': note(
    'East EV Station',
    'Public fast charging',
    'EV charging creates massive localized demand — an easy first thing to pause.',
    4,
    'Flexible',
  ),
  'AP-EV3': note(
    'Airport EV Station',
    'Public fast charging',
    'EV charging creates massive localized demand — an easy first thing to pause.',
    4,
    'Flexible',
  ),
  'RN-Solar': note(
    'Solar Array',
    'Utility-scale solar',
    'Generation varies with weather — clouds and storms cut its output.',
    3,
    'Medium',
  ),
};

const CORPORATE_NOTE = note(
  'Corporate Tower',
  'High-density commercial office',
  'Corporate HVAC dominates daytime load — dimming lighting and easing AC here relieves downtown corridors.',
  3,
  'Medium',
);
const HOUSE_HIGH_NOTE = note(
  'North Estate Home',
  'High-income suburb',
  'Large AC and EV load per household — big flexible demand.',
  4,
  'Flexible',
);
const HOUSE_LOW_NOTE = note(
  'South Community Home',
  'Working-class neighborhood',
  'Lower base load, but shedding here hits families hardest.',
  4,
  'Flexible',
  'Shedding this zone disproportionately affects low-income families.',
);

export function buildingNote(id: string): BuildingNote {
  const exact = BUILDING_NOTES[id];
  if (exact) return exact;
  if (id.startsWith('DT-Corp')) return { ...CORPORATE_NOTE, name: `${CORPORATE_NOTE.name} ${id.slice(-1)}` };
  if (id.startsWith('RN-House')) return HOUSE_HIGH_NOTE;
  if (id.startsWith('RS-House')) return HOUSE_LOW_NOTE;
  return note(id, 'City structure', 'Part of the Meridian Bay load base.', 4, 'Flexible');
}

/** Building id prefix → zone id (building ids are "<ZONE>-<Name>"). */
export function zoneOfBuilding(buildingId: string): string {
  const dash = buildingId.indexOf('-');
  return dash > 0 ? buildingId.slice(0, dash) : buildingId;
}

// ---------------------------------------------------------------------------
// Grid-health row meanings (one line each — every metric teaches something)
// ---------------------------------------------------------------------------

export const HEALTH_MEANINGS = {
  demand: 'What the city is asking for right now.',
  generation: 'What all plants are producing together.',
  balance: 'Supply minus demand — negative means the grid is strained.',
  frequency: '60 Hz means balanced; drift shows supply/demand mismatch.',
  renewables: 'Share of clean energy in the current mix.',
  corridorStress: 'Loading of the busiest transmission line.',
  zonesDark: 'Districts currently without power.',
} as const;

/** Tick → day-phase label (10 ticks/s, 1800-tick run mapped to one day arc). */
export function dayPhase(tick: number): string {
  const t = tick % 1800;
  if (t < 450) return 'Morning';
  if (t < 900) return 'Midday';
  if (t < 1350) return 'Afternoon';
  return 'Evening';
}

/** Simulation clock label: tick at 10 t/s → T+mm:ss. */
export function simClock(tick: number): string {
  const totalSeconds = Math.floor(tick / 10);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `T+${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
