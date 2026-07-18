import type {
  GenerationKind,
  GeneratorId,
  LineId,
  LoadId,
  MegaWatts,
  NodeId,
  PerUnit,
  ZoneId,
} from '@app-types';

import type { Generator, GridNode, GridTopology, Load, PowerLine, Zone } from '../model/grid';

// ---------------------------------------------------------------------------
// Meridian Bay — the procedural electrical topology of the simulation city.
// 20 buses (nodes), 30 transmission lines, 8 generators, 18 loads, 6 zones.
// All values are physically plausible for a 230 kV regional transmission system.
//
// Zone map:
//   DT  = Downtown (high-density commercial + hospital)
//   IN  = Industrial district
//   RN  = Residential North
//   RS  = Residential South
//   AP  = Airport
//   HB  = Harbor (heavy industry + water treatment)
//   GN  = Generation North (solar farm + wind farm)
//   GS  = Generation South (gas plant + baseload)
//
// The topology is deterministic — no seed required. Scenarios mutate electrical
// conditions (weather, dispatch) on top of this fixed wiring diagram.
// ---------------------------------------------------------------------------

const id = (s: string): NodeId => s as NodeId;
const zid = (s: string): ZoneId => s as ZoneId;
const gid = (s: string): GeneratorId => s as GeneratorId;
const lid = (s: string): LineId => s as LineId;
const loadId = (s: string): LoadId => s as LoadId;
const mw = (v: number): MegaWatts => v as MegaWatts;
const pu = (v: number): PerUnit => v as PerUnit;
const gkind = (k: string): GenerationKind => k as GenerationKind;

// ---------------------------------------------------------------------------
// Zones
// ---------------------------------------------------------------------------
const ZONES: readonly Zone[] = [
  { id: zid('DT'), name: 'Downtown' },
  { id: zid('IN'), name: 'Industrial' },
  { id: zid('RN'), name: 'Residential North' },
  { id: zid('RS'), name: 'Residential South' },
  { id: zid('AP'), name: 'Airport' },
  { id: zid('HB'), name: 'Harbor' },
];

// ---------------------------------------------------------------------------
// Buses (nodes) — 20 buses
// ---------------------------------------------------------------------------
const NODES: readonly GridNode[] = [
  // Downtown cluster (5 buses)
  { id: id('DT1'), zone: zid('DT') },
  { id: id('DT2'), zone: zid('DT') },
  { id: id('DT3'), zone: zid('DT') }, // Hospital bus — critical
  { id: id('DT4'), zone: zid('DT') },
  { id: id('DT5'), zone: zid('DT') },
  // Industrial cluster (3 buses)
  { id: id('IN1'), zone: zid('IN') },
  { id: id('IN2'), zone: zid('IN') },
  { id: id('IN3'), zone: zid('IN') },
  // Residential North cluster (3 buses)
  { id: id('RN1'), zone: zid('RN') },
  { id: id('RN2'), zone: zid('RN') },
  { id: id('RN3'), zone: zid('RN') },
  // Residential South cluster (3 buses)
  { id: id('RS1'), zone: zid('RS') },
  { id: id('RS2'), zone: zid('RS') },
  { id: id('RS3'), zone: zid('RS') },
  // Airport (2 buses)
  { id: id('AP1'), zone: zid('AP') },
  { id: id('AP2'), zone: zid('AP') }, // Emergency services — critical
  // Harbor (2 buses)
  { id: id('HB1'), zone: zid('HB') },
  { id: id('HB2'), zone: zid('HB') }, // Water treatment — critical
  // Generation interconnects (2 buses)
  { id: id('GN1'), zone: zid('RN') }, // Solar + wind farm bus
  { id: id('GS1'), zone: zid('IN') }, // Baseload + gas bus
];

// ---------------------------------------------------------------------------
// Generators — 8 units
// ---------------------------------------------------------------------------
const GENERATORS: readonly Generator[] = [
  // Baseload coal/nuclear south — 400 MW, cannot ramp
  { id: gid('G-BASE-S'), node: id('GS1'), kind: gkind('Baseload'), capacity: mw(400) },
  // Gas peaker south — 150 MW, fast ramp
  { id: gid('G-PEAK-S'), node: id('GS1'), kind: gkind('Peaker'), capacity: mw(150) },
  // Gas peaker industrial — 80 MW
  { id: gid('G-PEAK-IN'), node: id('IN1'), kind: gkind('Peaker'), capacity: mw(80) },
  // Solar farm north — 120 MW (weather-derated)
  { id: gid('G-SOLAR'), node: id('GN1'), kind: gkind('Solar'), capacity: mw(120) },
  // Wind farm north — 90 MW (weather-derated)
  { id: gid('G-WIND'), node: id('GN1'), kind: gkind('Wind'), capacity: mw(90) },
  // Battery storage downtown — 50 MW discharge
  { id: gid('G-BATT-DT'), node: id('DT1'), kind: gkind('Storage'), capacity: mw(50) },
  // Import interconnect harbor — 200 MW
  { id: gid('G-IMPORT'), node: id('HB1'), kind: gkind('Import'), capacity: mw(200) },
  // Small gas harbor — 60 MW (black-start capable)
  { id: gid('G-GAS-HB'), node: id('HB1'), kind: gkind('Peaker'), capacity: mw(60) },
];

// ---------------------------------------------------------------------------
// Loads — 18 blocks
// ---------------------------------------------------------------------------
const LOADS: readonly Load[] = [
  // Downtown commercial + office
  { id: loadId('LD-DT-COM'), node: id('DT1'), zone: zid('DT'), nominalDemand: mw(80), critical: false },
  // Downtown hospital (CRITICAL — never shed)
  { id: loadId('LD-DT-HOSP'), node: id('DT3'), zone: zid('DT'), nominalDemand: mw(20), critical: true },
  // Downtown retail
  { id: loadId('LD-DT-RET'), node: id('DT2'), zone: zid('DT'), nominalDemand: mw(40), critical: false },
  // Downtown mixed use
  { id: loadId('LD-DT-MIX'), node: id('DT4'), zone: zid('DT'), nominalDemand: mw(35), critical: false },
  // Industrial heavy (foundry, manufacturing)
  { id: loadId('LD-IN-HVY'), node: id('IN2'), zone: zid('IN'), nominalDemand: mw(150), critical: false },
  // Industrial light
  { id: loadId('LD-IN-LGT'), node: id('IN3'), zone: zid('IN'), nominalDemand: mw(60), critical: false },
  // Residential North A
  { id: loadId('LD-RN-A'), node: id('RN1'), zone: zid('RN'), nominalDemand: mw(55), critical: false },
  // Residential North B
  { id: loadId('LD-RN-B'), node: id('RN2'), zone: zid('RN'), nominalDemand: mw(50), critical: false },
  // Residential North C
  { id: loadId('LD-RN-C'), node: id('RN3'), zone: zid('RN'), nominalDemand: mw(45), critical: false },
  // Residential South A
  { id: loadId('LD-RS-A'), node: id('RS1'), zone: zid('RS'), nominalDemand: mw(65), critical: false },
  // Residential South B
  { id: loadId('LD-RS-B'), node: id('RS2'), zone: zid('RS'), nominalDemand: mw(60), critical: false },
  // Residential South C
  { id: loadId('LD-RS-C'), node: id('RS3'), zone: zid('RS'), nominalDemand: mw(55), critical: false },
  // Airport terminal
  { id: loadId('LD-AP-TERM'), node: id('AP1'), zone: zid('AP'), nominalDemand: mw(30), critical: false },
  // Emergency services / ATC (CRITICAL)
  { id: loadId('LD-AP-EMRG'), node: id('AP2'), zone: zid('AP'), nominalDemand: mw(15), critical: true },
  // Harbor industrial
  { id: loadId('LD-HB-IND'), node: id('HB1'), zone: zid('HB'), nominalDemand: mw(70), critical: false },
  // Water treatment plant (CRITICAL)
  { id: loadId('LD-HB-WATR'), node: id('HB2'), zone: zid('HB'), nominalDemand: mw(25), critical: true },
  // Harbor shipping
  { id: loadId('LD-HB-SHIP'), node: id('HB2'), zone: zid('HB'), nominalDemand: mw(35), critical: false },
  // Solar farm self-use
  { id: loadId('LD-GN-AUX'), node: id('GN1'), zone: zid('RN'), nominalDemand: mw(5), critical: false },
];

// Total nominal load: ~895 MW
// Total generation capacity: ~1150 MW (with reserve margin ~28%)

// ---------------------------------------------------------------------------
// Transmission lines — 30 lines @ 230 kV
// Reactance in per-unit (100 MVA base). Capacity = thermal rating MW.
// x = 0.05..0.15 pu for short lines, 0.15..0.30 pu for longer lines.
// ---------------------------------------------------------------------------
const LINES: readonly PowerLine[] = [
  // ---- Downtown internal ring ----
  { id: lid('DT1-DT2'), from: id('DT1'), to: id('DT2'), capacity: mw(300), reactance: pu(0.05) },
  { id: lid('DT2-DT3'), from: id('DT2'), to: id('DT3'), capacity: mw(250), reactance: pu(0.06) },
  { id: lid('DT3-DT4'), from: id('DT3'), to: id('DT4'), capacity: mw(250), reactance: pu(0.06) },
  { id: lid('DT4-DT5'), from: id('DT4'), to: id('DT5'), capacity: mw(200), reactance: pu(0.07) },
  { id: lid('DT5-DT1'), from: id('DT5'), to: id('DT1'), capacity: mw(200), reactance: pu(0.07) },

  // ---- Industrial connections ----
  { id: lid('IN1-IN2'), from: id('IN1'), to: id('IN2'), capacity: mw(350), reactance: pu(0.04) },
  { id: lid('IN2-IN3'), from: id('IN2'), to: id('IN3'), capacity: mw(280), reactance: pu(0.05) },
  { id: lid('GS1-IN1'), from: id('GS1'), to: id('IN1'), capacity: mw(400), reactance: pu(0.08) },

  // ---- Residential North ----
  { id: lid('RN1-RN2'), from: id('RN1'), to: id('RN2'), capacity: mw(180), reactance: pu(0.08) },
  { id: lid('RN2-RN3'), from: id('RN2'), to: id('RN3'), capacity: mw(150), reactance: pu(0.09) },
  { id: lid('GN1-RN1'), from: id('GN1'), to: id('RN1'), capacity: mw(220), reactance: pu(0.10) },

  // ---- Residential South ----
  { id: lid('RS1-RS2'), from: id('RS1'), to: id('RS2'), capacity: mw(180), reactance: pu(0.08) },
  { id: lid('RS2-RS3'), from: id('RS2'), to: id('RS3'), capacity: mw(150), reactance: pu(0.09) },

  // ---- Airport ----
  { id: lid('AP1-AP2'), from: id('AP1'), to: id('AP2'), capacity: mw(120), reactance: pu(0.06) },

  // ---- Harbor ----
  { id: lid('HB1-HB2'), from: id('HB1'), to: id('HB2'), capacity: mw(200), reactance: pu(0.05) },

  // ---- Inter-zone transmission backbone ----
  { id: lid('DT1-IN1'), from: id('DT1'), to: id('IN1'), capacity: mw(350), reactance: pu(0.10) },
  { id: lid('DT1-RN1'), from: id('DT1'), to: id('RN1'), capacity: mw(280), reactance: pu(0.12) },
  { id: lid('DT2-RS1'), from: id('DT2'), to: id('RS1'), capacity: mw(280), reactance: pu(0.11) },
  { id: lid('DT5-AP1'), from: id('DT5'), to: id('AP1'), capacity: mw(200), reactance: pu(0.13) },
  { id: lid('DT4-HB1'), from: id('DT4'), to: id('HB1'), capacity: mw(250), reactance: pu(0.14) },
  { id: lid('IN1-HB1'), from: id('IN1'), to: id('HB1'), capacity: mw(300), reactance: pu(0.09) },
  { id: lid('IN2-RS1'), from: id('IN2'), to: id('RS1'), capacity: mw(220), reactance: pu(0.11) },
  { id: lid('RN1-RS1'), from: id('RN1'), to: id('RS1'), capacity: mw(200), reactance: pu(0.12) }, // N-S residential tie
  { id: lid('RN3-IN1'), from: id('RN3'), to: id('IN1'), capacity: mw(180), reactance: pu(0.13) },
  { id: lid('RS3-HB1'), from: id('RS3'), to: id('HB1'), capacity: mw(200), reactance: pu(0.12) },
  { id: lid('AP2-RS3'), from: id('AP2'), to: id('RS3'), capacity: mw(150), reactance: pu(0.14) },
  { id: lid('GN1-DT1'), from: id('GN1'), to: id('DT1'), capacity: mw(250), reactance: pu(0.15) }, // Renewable export
  { id: lid('GS1-DT1'), from: id('GS1'), to: id('DT1'), capacity: mw(400), reactance: pu(0.09) }, // Main infeed
  { id: lid('GS1-RS1'), from: id('GS1'), to: id('RS1'), capacity: mw(300), reactance: pu(0.11) }, // South infeed
  { id: lid('HB2-AP1'), from: id('HB2'), to: id('AP1'), capacity: mw(150), reactance: pu(0.15) }, // Harbor-airport tie
];

// ---------------------------------------------------------------------------
// Public topology export
// ---------------------------------------------------------------------------

/** The static Meridian Bay grid topology. Deterministic — no seed required. */
export const MERIDIAN_BAY_TOPOLOGY: GridTopology = {
  nodes: NODES,
  lines: LINES,
  generators: GENERATORS,
  loads: LOADS,
  zones: ZONES,
};

/** Total nominal generation capacity (MW). */
export const MERIDIAN_BAY_TOTAL_CAPACITY_MW: MegaWatts = mw(
  GENERATORS.reduce((sum, g) => sum + g.capacity, 0),
);

/** Total nominal load (MW). */
export const MERIDIAN_BAY_TOTAL_LOAD_MW: MegaWatts = mw(
  LOADS.reduce((sum, l) => sum + l.nominalDemand, 0),
);

/** Critical load IDs (never shed). */
export const MERIDIAN_BAY_CRITICAL_LOADS: readonly LoadId[] = LOADS.filter(
  (l) => l.critical,
).map((l) => l.id);
