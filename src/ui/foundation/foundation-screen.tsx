import type { ReactElement } from 'react';

export interface FoundationScreenProps {
  readonly profile: string;
  readonly seed: number;
}

interface SystemEntry {
  readonly tag: string;
  readonly name: string;
  readonly responsibility: string;
  readonly status: 'ready' | 'placeholder';
}

const SYSTEMS: readonly SystemEntry[] = [
  {
    tag: 'KERNEL',
    name: 'Simulation Kernel',
    responsibility: 'Time · RNG · scheduler · lifecycle · FSM · registry',
    status: 'ready',
  },
  {
    tag: 'A',
    name: 'Simulation Engine',
    responsibility: 'Topology · power flow · cascade · protection · weather',
    status: 'placeholder',
  },
  {
    tag: 'B',
    name: 'Learning Engine',
    responsibility: 'Learner twin · knowledge tracing · scoring',
    status: 'placeholder',
  },
  {
    tag: 'C',
    name: 'Presentation',
    responsibility: 'Scene graph · visual effects (pure consumer)',
    status: 'placeholder',
  },
  {
    tag: 'D',
    name: 'User Interface',
    responsibility: 'HUD · decision wheel · timeline · replay controls',
    status: 'placeholder',
  },
  {
    tag: 'E',
    name: 'Audio Engine',
    responsibility: 'Adaptive music · ambient · SFX · mixing',
    status: 'placeholder',
  },
  {
    tag: 'F',
    name: 'Infrastructure',
    responsibility: 'DI · config · serialization · logging · bootstrap',
    status: 'ready',
  },
  {
    tag: 'RPL',
    name: 'Replay',
    responsibility: 'Record · playback · verify · timeline · snapshots',
    status: 'placeholder',
  },
  {
    tag: 'SCN',
    name: 'Scenarios',
    responsibility: 'ICrisisScenario plugin registry',
    status: 'ready',
  },
];

function StatusChip({ status }: { readonly status: SystemEntry['status'] }): ReactElement {
  const ready = status === 'ready';
  return (
    <span
      className={[
        'rounded-instrument border px-2 py-0.5 text-[10px] uppercase tracking-widest',
        ready
          ? 'border-status-nominal/40 text-status-nominal'
          : 'border-surface-border text-ink-muted',
      ].join(' ')}
    >
      {ready ? 'Ready' : 'Placeholder'}
    </span>
  );
}

/**
 * Phase-1 foundation status console. Not gameplay UI — a verification surface
 * proving the architecture is wired and the toolchain runs. Styled in the
 * frozen visual language (control-room graphite, instrument accents).
 */
export function FoundationScreen({ profile, seed }: FoundationScreenProps): ReactElement {
  return (
    <main className="min-h-screen bg-surface-base px-6 py-10 text-ink-primary sm:px-10">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 border-b border-surface-border pb-5">
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.3em] text-instrument">
            <span className="text-status-nominal">●</span> Foundation online
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">GridGuard</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-secondary">
            Simulation-first architecture. The simulation is the single source of truth; rendering,
            UI, audio, and replay are consumers only.
          </p>
          <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-1 font-mono text-xs text-ink-muted">
            <div className="flex gap-2">
              <dt>profile</dt>
              <dd className="text-ink-secondary">{profile}</dd>
            </div>
            <div className="flex gap-2">
              <dt>seed</dt>
              <dd className="text-ink-secondary">{seed}</dd>
            </div>
            <div className="flex gap-2">
              <dt>phase</dt>
              <dd className="text-ink-secondary">1 · foundation</dd>
            </div>
          </dl>
        </header>

        <ul className="grid gap-px overflow-hidden rounded-panel border border-surface-border bg-surface-border sm:grid-cols-2">
          {SYSTEMS.map((system) => (
            <li key={system.tag} className="bg-surface-panel p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-xs text-instrument">{system.tag}</span>
                  <span className="text-sm font-medium">{system.name}</span>
                </div>
                <StatusChip status={system.status} />
              </div>
              <p className="mt-2 text-xs text-ink-muted">{system.responsibility}</p>
            </li>
          ))}
        </ul>

        <footer className="mt-8 font-mono text-[11px] uppercase tracking-widest text-ink-muted">
          Simulation first · Rendering second · UI third
        </footer>
      </div>
    </main>
  );
}
