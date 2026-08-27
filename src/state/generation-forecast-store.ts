/**
 * generation-forecast-store.ts — projection of the scenario-declared forecast.
 *
 * Same shape and same reason as `telemetry-trust-store`: the forecast is owned
 * by the scenario layer, which compiles with no DOM and no React in scope, so
 * this is the thin projection the console subscribes to.
 */
import { generationForecast, onGenerationForecastChange } from '@scenarios';
import type { GenerationForecast } from '@scenarios';
import { create } from 'zustand';

export interface GenerationForecastState {
  readonly forecast: GenerationForecast | null;
}

export const useGenerationForecastStore = create<GenerationForecastState>()(() => ({
  forecast: generationForecast(),
}));

/** Bind the projection to the scenario-owned forecast. Returns a detach. */
export function bindGenerationForecast(): () => void {
  useGenerationForecastStore.setState({ forecast: generationForecast() });
  return onGenerationForecastChange((forecast) => {
    useGenerationForecastStore.setState({ forecast });
  });
}
