/**
 * generation-forecast.ts — what the scenario PROMISED renewable output would be.
 *
 * The distinctive mechanic of the renewable-intermittency arc. A grid operator
 * does not schedule against what the weather is doing, they schedule against
 * what it was forecast to do; the gap between those two numbers is the entire
 * subject. So the forecast is published once, at setup, and never corrected —
 * a forecast that quietly tracks reality would hide the very thing being taught.
 *
 * This holds only the PROMISE. Actual output is read live from the generator
 * projection, so the panel compares a scenario-declared figure against
 * measured engine output and invents nothing.
 *
 * Dependency-free for the same reason as `telemetry-trust`: `src/scenarios`
 * compiles with no DOM and no React in scope.
 */

export interface GenerationForecast {
  /** Forecast solar availability as a fraction of clear-sky peak, 0..1. */
  readonly solarAtCeiling: number;
  /** Forecast wind availability as a fraction of rated, 0..1. */
  readonly windForecast: number;
  /** One line of operator-facing framing. */
  readonly note: string;
}

let current: GenerationForecast | null = null;
const listeners = new Set<(forecast: GenerationForecast | null) => void>();

export function generationForecast(): GenerationForecast | null {
  return current;
}

/** Scenarios call this in `setup()`. Nothing else should. */
export function setGenerationForecast(forecast: GenerationForecast): void {
  current = forecast;
  for (const listener of listeners) listener(current);
}

export function clearGenerationForecast(): void {
  if (current === null) return;
  current = null;
  for (const listener of listeners) listener(null);
}

/** Subscribe to changes. Returns an unsubscribe. */
export function onGenerationForecastChange(
  listener: (forecast: GenerationForecast | null) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
