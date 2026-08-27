/**
 * ForecastPanel — what was promised, against what arrived.
 *
 * The renewable-intermittency scenario's distinctive mechanic. A grid operator
 * schedules against a FORECAST, not against the weather; the gap between the
 * two is the entire subject of intermittency, and it is why reserve and
 * storage get bought. So this panel puts the day-ahead promise and the
 * measured output side by side and lets the miss open up in front of the
 * player.
 *
 * Both columns are real. The forecast is the figure the scenario declared at
 * setup and has never moved. The actual is live generator output over rated
 * capacity, straight from the projection. Nothing here is estimated.
 *
 * Renders only while a scenario has published a forecast, so it costs the rail
 * nothing in the seven scenarios that have not.
 */
import { useGenerationForecastStore, useGridStore } from '@state';
import type { ReactElement } from 'react';

/** Availability is measured against RATED capacity, not against dispatch. */
function availabilityOf(
  generators: ReturnType<typeof useGridStore.getState>['generators'],
  id: string,
): number | null {
  const unit = generators.find((g) => (g.id as string) === id);
  if (unit === undefined) return null;
  const capacity = unit.capacityMw as number;
  if (capacity <= 0) return null;
  return (unit.outputMw as number) / capacity;
}

function Row({
  label,
  forecast,
  actual,
}: {
  label: string;
  forecast: number;
  actual: number | null;
}): ReactElement {
  const pct = (value: number): string => `${String(Math.round(value * 100))} %`;
  // A miss only matters when output is BELOW forecast — coming in high is a
  // pleasant surprise, not an operational problem.
  const shortfall = actual === null ? 0 : Math.max(0, forecast - actual);
  const tone = shortfall > 0.25 ? '#B3261E' : shortfall > 0.1 ? '#B4531F' : '#217A56';

  return (
    <div style={{ padding: '5px 0', borderBottom: '1px solid #E7E9E6' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 11.5, color: '#5A6774' }}>{label}</span>
        <span className="console-value" style={{ fontSize: 11.5 }}>
          <span style={{ color: '#8B97A3' }}>{pct(forecast)}</span>
          <span style={{ color: '#C3C9C3', margin: '0 5px' }}>→</span>
          <span style={{ color: tone, fontWeight: 700 }}>
            {actual === null ? '—' : pct(actual)}
          </span>
        </span>
      </div>

      {/* Two bars on one baseline: the promise as a hairline, the measurement
          as a solid fill. The overshoot of one past the other IS the reading —
          no legend needed. */}
      <div
        style={{
          position: 'relative',
          height: 5,
          marginTop: 4,
          background: 'rgba(28, 37, 48, 0.06)',
          borderRadius: 2,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            width: `${String(Math.min(100, forecast * 100))}%`,
            background: 'rgba(90, 103, 116, 0.28)',
            borderRadius: 2,
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            width: `${String(actual === null ? 0 : Math.min(100, actual * 100))}%`,
            background: tone,
            borderRadius: 2,
            transition: 'width 400ms ease',
          }}
        />
      </div>
      {shortfall > 0.1 && (
        <div style={{ fontSize: 10, color: tone, marginTop: 3 }}>
          {pct(shortfall)} below forecast
        </div>
      )}
    </div>
  );
}

export function ForecastPanel(): ReactElement | null {
  const forecast = useGenerationForecastStore((s) => s.forecast);
  const generators = useGridStore((s) => s.generators);

  if (forecast === null) return null;

  const solar = availabilityOf(generators, 'G-SOLAR');
  const wind = availabilityOf(generators, 'G-WIND');

  return (
    <div className="console-panel" style={{ padding: '10px 14px' }}>
      <div className="console-section-title" style={{ marginBottom: 4 }}>
        Forecast vs Actual
      </div>
      <div style={{ fontSize: 10.5, color: '#8B97A3', lineHeight: 1.4, marginBottom: 5 }}>
        {forecast.note}
      </div>
      <Row label="Solar availability" forecast={forecast.solarAtCeiling} actual={solar} />
      <Row label="Wind availability" forecast={forecast.windForecast} actual={wind} />
      <div style={{ fontSize: 10, color: '#5A6774', lineHeight: 1.45, marginTop: 6 }}>
        Reserve is bought against the forecast. Everything the forecast misses has to come from
        somewhere else, right now.
      </div>
    </div>
  );
}
