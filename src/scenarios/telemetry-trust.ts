/**
 * telemetry-trust.ts — whether the console may vouch for its own instruments.
 *
 * The cyber-attack scenario's distinctive mechanic. During a SCADA intrusion
 * the operator still receives corridor telemetry, and it still displays — but
 * its provenance cannot be authenticated, so nothing built on it should be
 * acted on as fact.
 *
 * The critical design decision here is that this flag NEVER ALTERS A NUMBER.
 * The brief asked for "some displayed values are WRONG", and that was the one
 * thing this project must not do: the frozen doctrine makes the simulation the
 * single source of truth, and a renderer that lies about measured state is
 * exactly the failure the whole architecture exists to prevent. It would also
 * poison the after-action evidence, which measures decisions against the
 * telemetry the player saw.
 *
 * So the mechanic is inverted, and is better for it. The values stay true; the
 * console withdraws its ENDORSEMENT of them. That is both honest and closer to
 * the real problem — a control-room operator during an intrusion is not
 * reading fabricated numbers, they are reading numbers they cannot prove.
 *
 * Deliberately dependency-free: `src/scenarios` compiles under
 * `tsconfig.engine.json` with no DOM and no React in scope, so this cannot be
 * a Zustand store. `state/telemetry-trust-store` projects it for the UI.
 */

export interface TelemetryTrust {
  /** True while instrument provenance cannot be authenticated. */
  readonly compromised: boolean;
  /** Operator-facing explanation, or null when trust is intact. */
  readonly reason: string | null;
}

const INTACT: TelemetryTrust = { compromised: false, reason: null };

let current: TelemetryTrust = INTACT;
const listeners = new Set<(trust: TelemetryTrust) => void>();

export function telemetryTrust(): TelemetryTrust {
  return current;
}

/** Scenarios call this. Nothing else should. */
export function setTelemetryTrust(trust: TelemetryTrust): void {
  if (trust.compromised === current.compromised && trust.reason === current.reason) return;
  current = trust;
  for (const listener of listeners) listener(current);
}

/** Subscribe to changes. Returns an unsubscribe. */
export function onTelemetryTrustChange(listener: (trust: TelemetryTrust) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Reset to trusted. Called when a run ends or is torn down so a fresh scenario
 * never inherits the previous one's intrusion.
 */
export function resetTelemetryTrust(): void {
  setTelemetryTrust(INTACT);
}
