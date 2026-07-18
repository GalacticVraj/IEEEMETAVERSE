export interface DiagnosticsReport {
  readonly ticks: number;
  readonly lastTickMs: number;
  readonly averageTickMs: number;
  readonly maxTickMs: number;
  readonly slowestSystem: { readonly id: string; readonly ms: number } | null;
  /** Cumulative execution time per system, in ms. */
  readonly systemMs: Readonly<Record<string, number>>;
}

/**
 * Collects runtime timing diagnostics. Wall-clock access is INJECTED via
 * `timeProvider` (ms) so the kernel stays pure and framework-free — the actual
 * `performance.now()` lives in infrastructure. Purely observational: it reports
 * through an interface and renders nothing.
 */
export interface Diagnostics {
  beginTick(): void;
  endTick(): void;
  beginSystem(id: string): void;
  endSystem(id: string): void;
  report(): DiagnosticsReport;
  reset(): void;
}

export function createDiagnostics(timeProvider: () => number): Diagnostics {
  let ticks = 0;
  let lastTickMs = 0;
  let totalTickMs = 0;
  let maxTickMs = 0;
  let tickStart = 0;

  const systemMs = new Map<string, number>();
  const systemStart = new Map<string, number>();

  return {
    beginTick(): void {
      tickStart = timeProvider();
    },
    endTick(): void {
      const duration = timeProvider() - tickStart;
      ticks += 1;
      lastTickMs = duration;
      totalTickMs += duration;
      if (duration > maxTickMs) {
        maxTickMs = duration;
      }
    },
    beginSystem(id: string): void {
      systemStart.set(id, timeProvider());
    },
    endSystem(id: string): void {
      const start = systemStart.get(id) ?? timeProvider();
      const duration = timeProvider() - start;
      systemMs.set(id, (systemMs.get(id) ?? 0) + duration);
    },
    report(): DiagnosticsReport {
      let slowestSystem: { id: string; ms: number } | null = null;
      for (const [id, ms] of systemMs) {
        if (slowestSystem === null || ms > slowestSystem.ms) {
          slowestSystem = { id, ms };
        }
      }
      return {
        ticks,
        lastTickMs,
        averageTickMs: ticks === 0 ? 0 : totalTickMs / ticks,
        maxTickMs,
        slowestSystem,
        systemMs: Object.fromEntries(systemMs),
      };
    },
    reset(): void {
      ticks = 0;
      lastTickMs = 0;
      totalTickMs = 0;
      maxTickMs = 0;
      tickStart = 0;
      systemMs.clear();
      systemStart.clear();
    },
  };
}
