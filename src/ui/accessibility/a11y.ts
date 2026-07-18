import { LineState, ZoneState } from '@app-types';

/**
 * Accessibility helpers. Grid status must be conveyed by ICON + LABEL, not color
 * alone (color-blind safe, per the non-functional requirements). These maps are
 * the single source for the redundant text/icon encoding used across the HUD.
 */
export interface StatusPresentation {
  readonly label: string;
  /** A text/glyph token rendered alongside color (never color-only). */
  readonly icon: string;
}

export const ZONE_STATE_PRESENTATION: Readonly<Record<ZoneState, StatusPresentation>> = {
  [ZoneState.Powered]: { label: 'Powered', icon: '▲' },
  [ZoneState.Degraded]: { label: 'Degraded', icon: '◆' },
  [ZoneState.Blackout]: { label: 'Blackout', icon: '✕' },
};

export const LINE_STATE_PRESENTATION: Readonly<Record<LineState, StatusPresentation>> = {
  [LineState.Nominal]: { label: 'Nominal', icon: '━' },
  [LineState.Overloaded]: { label: 'Overloaded', icon: '◮' },
  [LineState.Tripping]: { label: 'Tripping', icon: '⚡' },
  [LineState.Tripped]: { label: 'Tripped', icon: '⊘' },
  [LineState.Cooling]: { label: 'Cooling', icon: '❄' },
};

export const zonePresentation = (state: ZoneState): StatusPresentation =>
  ZONE_STATE_PRESENTATION[state];

export const linePresentation = (state: LineState): StatusPresentation =>
  LINE_STATE_PRESENTATION[state];
