/**
 * telemetry-trust-store.ts — projection of the scenario-owned trust flag.
 *
 * `src/scenarios` compiles with no DOM and no React in scope (see
 * `tsconfig.engine.json`), so the flag itself lives there as a plain
 * observable. This is the thin projection that lets the console read it the
 * same way it reads every other piece of authoritative state: subscribe,
 * never compute.
 */
import { onTelemetryTrustChange, telemetryTrust } from '@scenarios';
import type { TelemetryTrust } from '@scenarios';
import { create } from 'zustand';

export const useTelemetryTrustStore = create<TelemetryTrust>()(() => telemetryTrust());

/** Bind the projection to the scenario-owned flag. Returns a detach. */
export function bindTelemetryTrust(): () => void {
  useTelemetryTrustStore.setState(telemetryTrust());
  return onTelemetryTrustChange((trust) => {
    useTelemetryTrustStore.setState(trust);
  });
}
