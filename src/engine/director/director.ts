import type { Severity } from '@app-types';
import { createToken, notImplemented } from '@core';
import type { TickContext, Token } from '@core';

export interface DirectorDirective {
  readonly severity: Severity;
  /** Short operator-facing framing for the current beat. */
  readonly message: string;
}

/**
 * The Director paces the experience — the "game feel" brain of the SIMULATION
 * (not the renderer). It decides when to escalate, when to request a decision,
 * and how severe the current beat is, based purely on simulation state. Audio
 * and camera react to its directives; it never touches them directly.
 */
export interface IDirector {
  pace(context: TickContext): DirectorDirective;
}

export const DIRECTOR: Token<IDirector> = createToken('Director');

/**
 * Placeholder director.
 *
 * PHASE 7 will implement tension pacing: read grid stress (max loading, active
 * cascades, unserved load), shape a calm → rising → crisis → resolution arc,
 * and raise `DecisionRequested` at dramatically appropriate moments.
 */
export class PlaceholderDirector implements IDirector {
  public pace(context: TickContext): DirectorDirective {
    return notImplemented(
      'Director.pace',
      'Tension pacing from grid stress; drives decision requests and severity.',
      { context },
    );
  }
}
