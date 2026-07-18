/**
 * Domain enumerations expressed as `const` objects plus a derived union type.
 *
 * This pattern (over TypeScript `enum`) keeps values tree-shakeable, plays well
 * with `isolatedModules` / `verbatimModuleSyntax`, and gives both a runtime
 * value bag (`LineState.Tripped`) and a compile-time union (`LineState`).
 */

/** Lifecycle of a transmission line under thermal/protection stress. */
export const LineState = {
  Nominal: 'Nominal',
  Overloaded: 'Overloaded',
  Tripping: 'Tripping',
  Tripped: 'Tripped',
  Cooling: 'Cooling',
} as const;
export type LineState = (typeof LineState)[keyof typeof LineState];

/** Energisation state of a demand zone. */
export const ZoneState = {
  Powered: 'Powered',
  Degraded: 'Degraded',
  Blackout: 'Blackout',
} as const;
export type ZoneState = (typeof ZoneState)[keyof typeof ZoneState];

/** Category of generation resource. */
export const GenerationKind = {
  Baseload: 'Baseload',
  Peaker: 'Peaker',
  Solar: 'Solar',
  Wind: 'Wind',
  Storage: 'Storage',
  Import: 'Import',
} as const;
export type GenerationKind = (typeof GenerationKind)[keyof typeof GenerationKind];

/** Prevailing weather regime driving load and renewable output. */
export const WeatherKind = {
  Clear: 'Clear',
  Heatwave: 'Heatwave',
  Storm: 'Storm',
  Overcast: 'Overcast',
  Cold: 'Cold',
} as const;
export type WeatherKind = (typeof WeatherKind)[keyof typeof WeatherKind];

/** Generic escalating severity used by alerts, audio, and the director. */
export const Severity = {
  Info: 'Info',
  Caution: 'Caution',
  Warning: 'Warning',
  Critical: 'Critical',
} as const;
export type Severity = (typeof Severity)[keyof typeof Severity];

/** Why a line opened — attributes cause for analytics and learner scoring. */
export const LineTripCause = {
  Overload: 'Overload',
  Protection: 'Protection',
  Operator: 'Operator',
  Cascade: 'Cascade',
} as const;
export type LineTripCause = (typeof LineTripCause)[keyof typeof LineTripCause];

/** Terminal outcome of a run. */
export const GameOutcome = {
  Held: 'Held',
  PartialBlackout: 'PartialBlackout',
  SystemBlackout: 'SystemBlackout',
} as const;
export type GameOutcome = (typeof GameOutcome)[keyof typeof GameOutcome];
