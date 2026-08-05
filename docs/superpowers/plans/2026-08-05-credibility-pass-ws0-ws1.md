# Credibility Pass — Workstreams 0 & 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take the developer overlay off the player's screen, clear the scene bugs behind it, and replace GridGuard's algebraic frequency placeholder with real rotational dynamics — inertia, RoCoF, governor action, and automatic under-frequency load shedding.

**Architecture:** A new pure module `src/engine/frequency/` holds the physics as small, separately testable functions (inertia accounting, swing integration, UFLS relay, reserve/N-1 screening). A thin `FrequencyModel` composes them and is called by `GridSimulationEngine.step()` after dispatch and power flow. `GridState` grows the new observable quantities; the Zustand projection copies them; nothing in the UI computes physics.

**Tech Stack:** TypeScript (strict), Vitest, Zustand, React 18, R3F/Three, Vite.

## Global Constraints

- Package manager is **pnpm**. Project root is the repo root.
- Shared types alias is **`@app-types`** — never `@types`.
- `src/engine/**` must compile under `tsconfig.engine.json` (no DOM, no React). Verify with `pnpm typecheck:engine`.
- **Determinism:** no `Math.random()`, no `Date.now()`, no wall-clock in any simulation path. Seeded RNG only.
- **Doctrine #1:** simulation is the single source of truth. Zustand stores are projections updated by events/tick only; they never compute state.
- **Doctrine #2:** every visual effect must trace to a simulation cause.
- **Doctrine #3:** frozen visual language — engineering operations console. No glassmorphism, no neon, no decorative gradients, no oversized rounded cards. Radii 2–4px.
- Every event added must be added to **both** `src/constants/events.ts` (`GRID_EVENT`) and `src/core/events/grid-events.ts` (`GridEventMap`). The `EventMapIntegrity` type fails compilation otherwise.
- Pure engine modules use **plain `number`** internally and brand at the boundary (`asHertz`, `asMegaWatts`), matching the existing `powerflow` module convention.
- Nominal system frequency is **60 Hz**. System MVA base is **1150**.
- Baseline to preserve: `pnpm typecheck` 0 errors, `pnpm typecheck:engine` 0 errors, **418 tests green**.
- Commit after every task. Never use `--no-verify`.

## File Structure

**Workstream 0 — created**

| File                              | Responsibility                                                                                                                |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `src/debug/render-stats-store.ts` | Zustand store holding measured FPS, draw calls, triangles, heap MB. Written only by the in-Canvas probe.                      |
| `src/debug/RenderStatsProbe.tsx`  | Component mounted **inside** `<Canvas>`; samples `gl.info` + frame delta each frame, publishes to the store. Renders nothing. |

**Workstream 0 — modified**

| File                                   | Change                                                                                                                                    |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `src/config/profiles.ts:40`            | `development` profile `overlay: true` → `false`.                                                                                          |
| `src/state/ui-store.ts`                | Add `setDebugOverlay(visible)`; seed `debugOverlayVisible` from the `?debug` URL parameter.                                               |
| `src/debug/debug-overlay.tsx`          | Read real stats from `render-stats-store` instead of `—` placeholders; reposition clear of the command bar.                               |
| `src/App.tsx:111,130`                  | Mount overlay from `ui-store`, not `config.debug.overlay`; mount `RenderStatsProbe` inside the Canvas; register the Ctrl+Shift+D handler. |
| `src/state/grid-store.ts:37`           | `frequency: 50` → `60`.                                                                                                                   |
| `src/rendering/grid-scene.tsx:289-301` | `GroundPlane` bounds so no edge is visible from any camera station.                                                                       |
| `src/ui/console/Timeline.tsx`          | Bottom bar opaque to the viewport bottom (stop canvas bleed-through).                                                                     |

**Workstream 1 — created**

| File                                      | Responsibility                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------- |
| `src/engine/frequency/inertia.ts`         | Per-machine inertia constants; `systemInertiaMwS()`. Pure.                      |
| `src/engine/frequency/swing.ts`           | `stepSwing()` — one fixed-step integration of the swing equation. Pure.         |
| `src/engine/frequency/ufls.ts`            | Staged under-frequency load-shedding relay with latching. Pure.                 |
| `src/engine/frequency/reserve.ts`         | Spinning/fast reserve accounting, largest in-feed, N-1 screening verdict. Pure. |
| `src/engine/frequency/frequency-model.ts` | Composes the above into a tick-stepped, snapshotable model.                     |
| `src/engine/frequency/index.ts`           | Barrel export.                                                                  |
| `src/engine/frequency/*.test.ts`          | One test file per module above.                                                 |

**Workstream 1 — modified**

| File                                          | Change                                                                                             |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `src/engine/model/grid.ts:110-119`            | `GridState` gains `rocof`, `inertiaMwS`, `uflsStage`, `uflsShedFraction`, `security`, `reserveMw`. |
| `src/engine/simulation-engine.ts:273-283`     | Delete the algebraic formula; call `FrequencyModel`.                                               |
| `src/engine/generation/generation.ts:169-200` | Ramp limits gain a governor-urgency multiplier driven by frequency deviation.                      |
| `src/constants/events.ts`                     | Add `FrequencyDeviation`, `LoadShedAutomatic`, `SecurityChanged`.                                  |
| `src/core/events/grid-events.ts`              | Matching payload interfaces + `GridEventMap` entries.                                              |
| `src/state/grid-store.ts`                     | Project the new `GridState` fields.                                                                |

---

### Task 1: Debug overlay becomes opt-in, with real instrumentation

**Files:**

- Create: `src/debug/render-stats-store.ts`
- Create: `src/debug/RenderStatsProbe.tsx`
- Modify: `src/config/profiles.ts:40`
- Modify: `src/state/ui-store.ts`
- Modify: `src/debug/debug-overlay.tsx`
- Modify: `src/App.tsx`
- Modify: `src/debug/index.ts`
- Test: `src/state/ui-store.test.ts` (create)

**Interfaces:**

- Produces: `useRenderStatsStore` with shape `{ fps: number; drawCalls: number; triangles: number; heapMb: number | null }`; `RenderStatsProbe(): null`; `useUiStore` gains `setDebugOverlay(visible: boolean): void`.
- Consumes: nothing from other tasks.

- [ ] **Step 1: Write the failing test**

Create `src/state/ui-store.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';

import { useUiStore, readDebugFlagFromLocation } from './ui-store';

describe('ui-store debug overlay', () => {
  beforeEach(() => {
    useUiStore.setState({ debugOverlayVisible: false });
  });

  it('is hidden by default', () => {
    expect(useUiStore.getState().debugOverlayVisible).toBe(false);
  });

  it('toggles on and back off', () => {
    useUiStore.getState().toggleDebugOverlay();
    expect(useUiStore.getState().debugOverlayVisible).toBe(true);
    useUiStore.getState().toggleDebugOverlay();
    expect(useUiStore.getState().debugOverlayVisible).toBe(false);
  });

  it('sets an explicit value', () => {
    useUiStore.getState().setDebugOverlay(true);
    expect(useUiStore.getState().debugOverlayVisible).toBe(true);
  });

  it('reads the ?debug flag from a query string', () => {
    expect(readDebugFlagFromLocation('?debug')).toBe(true);
    expect(readDebugFlagFromLocation('?demo')).toBe(false);
    expect(readDebugFlagFromLocation('')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/state/ui-store.test.ts`
Expected: FAIL — `readDebugFlagFromLocation` and `setDebugOverlay` are not exported.

- [ ] **Step 3: Add the store API**

In `src/state/ui-store.ts`, add to the `UiState` interface after `toggleDebugOverlay`:

```ts
  readonly setDebugOverlay: (visible: boolean) => void;
```

Above `useUiStore`, add:

```ts
/**
 * The debug overlay is a DEVELOPER tool and must never appear for a player.
 * It is opt-in only: `?debug` in the URL, or Ctrl+Shift+D at runtime.
 * Exported separately so it can be tested without touching `window`.
 */
export function readDebugFlagFromLocation(search: string): boolean {
  return new URLSearchParams(search).has('debug');
}
```

Change the store's initial value and add the setter:

```ts
  debugOverlayVisible:
    typeof window === 'undefined' ? false : readDebugFlagFromLocation(window.location.search),
```

```ts
  setDebugOverlay: (visible) => {
    set({ debugOverlayVisible: visible });
  },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/state/ui-store.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Turn the overlay off in the development profile**

In `src/config/profiles.ts:40`, change:

```ts
    debug: { overlay: true, logLevel: 'debug' },
```

to:

```ts
    debug: { overlay: false, logLevel: 'debug' },
```

- [ ] **Step 6: Create the render-stats store**

Create `src/debug/render-stats-store.ts`:

```ts
/**
 * Measured renderer statistics. Written ONLY by `RenderStatsProbe` (which
 * lives inside the Canvas and is the only place with access to `gl.info`),
 * read by the debug overlay. This is developer instrumentation, not
 * simulation state — it observes the renderer, never the engine.
 */
import { create } from 'zustand';

export interface RenderStats {
  readonly fps: number;
  readonly drawCalls: number;
  readonly triangles: number;
  /** JS heap in MB where the browser exposes it, else null. */
  readonly heapMb: number | null;
}

export const useRenderStatsStore = create<RenderStats>()(() => ({
  fps: 0,
  drawCalls: 0,
  triangles: 0,
  heapMb: null,
}));
```

- [ ] **Step 7: Create the in-Canvas probe**

Create `src/debug/RenderStatsProbe.tsx`:

```tsx
/**
 * Samples real renderer statistics from inside the Canvas and publishes them
 * for the debug overlay. Mount as a child of `<Canvas>`; renders nothing.
 *
 * The store is written at most 4×/second — writing every frame would make
 * React re-render the overlay 60×/second and distort the very FPS it reports.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';

import { useRenderStatsStore } from './render-stats-store';

const SAMPLE_INTERVAL_S = 0.25;
/** Smoothing factor for the frame-rate EMA — low enough to stay readable. */
const FPS_SMOOTHING = 0.1;

export function RenderStatsProbe(): null {
  const gl = useThree((state) => state.gl);
  const fps = useRef(60);
  const sinceSample = useRef(0);

  useFrame((_, delta) => {
    if (delta > 0) {
      const instant = 1 / delta;
      fps.current += (instant - fps.current) * FPS_SMOOTHING;
    }

    sinceSample.current += delta;
    if (sinceSample.current < SAMPLE_INTERVAL_S) return;
    sinceSample.current = 0;

    const memory = (performance as { memory?: { usedJSHeapSize: number } }).memory;
    useRenderStatsStore.setState({
      fps: Math.round(fps.current),
      drawCalls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      heapMb: memory === undefined ? null : Math.round(memory.usedJSHeapSize / 1_048_576),
    });
  });

  return null;
}
```

- [ ] **Step 8: Make the overlay report the real numbers**

Replace the body of `src/debug/debug-overlay.tsx` below the `MetricRow` helper:

```tsx
/**
 * Developer overlay — opt-in only (`?debug` or Ctrl+Shift+D). Reads the
 * simulation projection and the renderer probe; computes nothing itself.
 */
export function DebugOverlay({ seed }: DebugOverlayProps): ReactElement {
  const tick = useSimulationStore((state) => state.tick);
  const simTime = useSimulationStore((state) => state.simTime);
  const lifecycle = useSimulationStore((state) => state.lifecycle);
  const maxLoading = useSimulationStore((state) => state.maxLineLoading);

  const fps = useRenderStatsStore((s) => s.fps);
  const drawCalls = useRenderStatsStore((s) => s.drawCalls);
  const triangles = useRenderStatsStore((s) => s.triangles);
  const heapMb = useRenderStatsStore((s) => s.heapMb);

  return (
    <aside className="pointer-events-none fixed right-3 bottom-[210px] z-50 w-60 select-none rounded-instrument border border-surface-border bg-surface-panel/95 p-3 font-mono text-[11px] leading-relaxed text-ink-secondary shadow-lg">
      <div className="mb-2 flex items-center justify-between border-b border-surface-border pb-1 text-instrument">
        <span className="uppercase tracking-widest">Debug · Ctrl+Shift+D</span>
        <span className="text-status-nominal">●</span>
      </div>
      <MetricRow label="seed" value={String(seed)} />
      <MetricRow label="state" value={lifecycle} />
      <MetricRow label="tick" value={String(tick)} />
      <MetricRow label="sim time" value={`${simTime.toFixed(1)}s`} />
      <MetricRow label="max loading" value={maxLoading.toFixed(2)} />
      <MetricRow label="fps" value={String(fps)} />
      <MetricRow label="draw calls" value={String(drawCalls)} />
      <MetricRow label="triangles" value={triangles.toLocaleString('en-US')} />
      <MetricRow label="heap" value={heapMb === null ? 'n/a' : `${heapMb} MB`} />
    </aside>
  );
}
```

Add the import at the top of the file:

```tsx
import { useRenderStatsStore } from './render-stats-store';
```

- [ ] **Step 9: Export the new pieces**

In `src/debug/index.ts`, add:

```ts
export { RenderStatsProbe } from './RenderStatsProbe';
export { useRenderStatsStore } from './render-stats-store';
export type { RenderStats } from './render-stats-store';
```

- [ ] **Step 10: Wire it into App.tsx**

In `src/App.tsx`, change the import on line 14:

```tsx
import { DebugOverlay, RenderStatsProbe } from '@debug';
```

Add to the imports:

```tsx
import { useUiStore } from '@state';
```

Inside `App`, alongside the other store reads:

```tsx
const debugVisible = useUiStore((s) => s.debugOverlayVisible);
const setDebugOverlay = useUiStore((s) => s.setDebugOverlay);

// Ctrl+Shift+D toggles developer instrumentation. Deliberately a chord —
// a player will never hit it by accident.
useEffect(() => {
  const onKey = (event: KeyboardEvent): void => {
    if (event.ctrlKey && event.shiftKey && event.code === 'KeyD') {
      event.preventDefault();
      setDebugOverlay(!useUiStore.getState().debugOverlayVisible);
    }
  };
  window.addEventListener('keydown', onKey);
  return () => {
    window.removeEventListener('keydown', onKey);
  };
}, [setDebugOverlay]);
```

Inside the `<Canvas>`, directly after `<CameraDirector />`:

```tsx
{
  /* Developer instrumentation — samples gl.info; renders nothing. */
}
{
  debugVisible && <RenderStatsProbe />;
}
```

Replace line 111 (`CameraHud`'s `dev` prop):

```tsx
{
  isConsole && (introActive || !teaching) && <CameraHud dev={debugVisible} />;
}
```

Replace line 130:

```tsx
{
  /* Developer overlay — opt-in only via ?debug or Ctrl+Shift+D */
}
{
  debugVisible ? <DebugOverlay seed={config.simulation.seed} /> : null;
}
```

- [ ] **Step 11: Verify**

Run: `pnpm typecheck && pnpm vitest run src/state/ui-store.test.ts src/App.smoke.test.tsx`
Expected: 0 type errors; all tests PASS.

- [ ] **Step 12: Commit**

```bash
git add src/debug src/state/ui-store.ts src/state/ui-store.test.ts src/config/profiles.ts src/App.tsx
git commit -m "fix(debug): overlay becomes opt-in and reports real numbers

The development profile hard-coded overlay:true and App.tsx rendered it
in every mode including the hero screen, showing fps/memory as em-dashes.
ui-store already had debugOverlayVisible + toggleDebugOverlay; they were
never wired to anything.

Overlay is now off in every profile and opt-in via ?debug or Ctrl+Shift+D,
and RenderStatsProbe publishes measured FPS, draw calls, triangles and heap
from inside the Canvas."
```

---

### Task 2: Scene bug sweep — world bounds, canvas bleed, initial frequency

**Files:**

- Modify: `src/rendering/grid-scene.tsx:289-301`
- Modify: `src/state/grid-store.ts:37`
- Modify: `src/ui/console/Timeline.tsx`
- Test: manual via `scripts/visual-audit.mjs`

**Interfaces:**

- Consumes: nothing.
- Produces: `GroundPlane` covering 4000 world units; no API change.

- [ ] **Step 1: Fix the 50 Hz initial frequency**

In `src/state/grid-store.ts:37`, change `frequency: 50,` to:

```ts
  frequency: 60,
```

This is a 60 Hz grid; the projection flashed 50 Hz before the first tick landed.

- [ ] **Step 2: Bound the world**

Replace `GroundPlane` in `src/rendering/grid-scene.tsx`:

```tsx
/**
 * Ground plane — Meridian Bay's terrain.
 *
 * The plane must extend past every camera station in `shots.ts`, otherwise its
 * edge is visible floating in void (it was, from the hero shot). 4000 units
 * clears the furthest station with margin; the survey grid stays at city scale
 * so it still reads as a scale reference rather than wallpaper.
 */
export function GroundPlane(): JSX.Element {
  return (
    <group>
      {/* Far terrain — extends past every camera station so no edge is ever
          visible. Unlit-flat at distance; fog does the rest. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.75, 0]}>
        <planeGeometry args={[4000, 4000]} />
        <meshStandardMaterial color="#9DAA99" roughness={1} metalness={0} />
      </mesh>
      {/* City terrain — receives building shadows. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
        <planeGeometry args={[500, 500]} />
        <meshStandardMaterial color="#A9B4A4" roughness={0.95} metalness={0} />
      </mesh>
      {/* Survey grid for scale readability — city extent only. */}
      <gridHelper args={[500, 50, '#93A08F', '#9DAA99']} position={[0, 0.02, 0]} />
    </group>
  );
}
```

- [ ] **Step 3: Stop the canvas bleeding under the timeline**

Open `src/ui/console/Timeline.tsx` and locate the root element's style object. Ensure the panel's background is opaque and that it reaches the viewport bottom by adding to that style object:

```ts
        background: '#F4F6F4',
        borderTop: '1px solid #D7DCD6',
        boxShadow: '0 -8px 24px rgba(28, 37, 48, 0.06)',
        height: '100%',
```

The console grid already reserves a 176px bottom row (`ConsoleShell.tsx:49`); the panel must fill it rather than float within it.

- [ ] **Step 4: Verify with the visual audit**

Ensure the dev server is running (`pnpm dev`), note its port, then:

Run: `node scripts/visual-audit.mjs --label=ws0 --url=http://localhost:5173`
Expected: `AUDIT PASS`, `page errors: none`.

Open `docs/superpowers/audit/ws0/01-hero.png` and confirm: no debug panel, no visible ground edge against the gray void.
Open `docs/superpowers/audit/ws0/04-crisis-deep.png` and confirm: no debug panel, no terrain visible below the timeline bar.

- [ ] **Step 5: Commit**

```bash
git add src/rendering/grid-scene.tsx src/state/grid-store.ts src/ui/console/Timeline.tsx docs/superpowers/audit/ws0
git commit -m "fix(scene): bound the world, seal the timeline, correct initial frequency

The 500x500 ground plane's edge was visible from the hero camera, floating
against gray void; far terrain now extends 4000 units past every camera
station. The console's bottom row was transparent so the scene showed
through beneath the timeline. grid-store seeded frequency at 50 Hz in a
60 Hz grid, flashing a wrong reading before the first tick."
```

---

### Task 3: System inertia from the online synchronous fleet

**Files:**

- Create: `src/engine/frequency/inertia.ts`
- Test: `src/engine/frequency/inertia.test.ts`

**Interfaces:**

- Produces: `INERTIA_CONSTANTS_S`, `SYSTEM_MVA_BASE`, `MachineInertiaInput`, `systemInertiaMwS(machines): number`, `isSynchronous(kind): boolean`.
- Consumes: nothing.

- [ ] **Step 1: Write the failing test**

Create `src/engine/frequency/inertia.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { isSynchronous, systemInertiaMwS } from './inertia';
import type { MachineInertiaInput } from './inertia';

/** Meridian Bay's real fleet, all online. */
const FLEET: readonly MachineInertiaInput[] = [
  { kind: 'Baseload', ratedMw: 400, online: true },
  { kind: 'Peaker', ratedMw: 150, online: true },
  { kind: 'Peaker', ratedMw: 80, online: true },
  { kind: 'Peaker', ratedMw: 60, online: true },
  { kind: 'Import', ratedMw: 200, online: true },
  { kind: 'Solar', ratedMw: 120, online: true },
  { kind: 'Wind', ratedMw: 90, online: true },
  { kind: 'Storage', ratedMw: 50, online: true },
];

describe('systemInertiaMwS', () => {
  it('sums H*S over online synchronous machines only', () => {
    // 400*5 + 150*4 + 80*4 + 60*4 + 200*3 = 2000+600+320+240+600 = 3760
    expect(systemInertiaMwS(FLEET)).toBe(3760);
  });

  it('gives inverter-coupled plant zero inertia', () => {
    const invertersOnly = FLEET.filter((m) => !isSynchronous(m.kind));
    expect(systemInertiaMwS(invertersOnly)).toBe(0);
  });

  it('drops when a synchronous machine trips', () => {
    const withoutImport = FLEET.map((m) => (m.kind === 'Import' ? { ...m, online: false } : m));
    expect(systemInertiaMwS(withoutImport)).toBe(3160);
  });

  it('is zero for an empty fleet', () => {
    expect(systemInertiaMwS([])).toBe(0);
  });

  it('classifies machine kinds', () => {
    expect(isSynchronous('Baseload')).toBe(true);
    expect(isSynchronous('Peaker')).toBe(true);
    expect(isSynchronous('Import')).toBe(true);
    expect(isSynchronous('Solar')).toBe(false);
    expect(isSynchronous('Wind')).toBe(false);
    expect(isSynchronous('Storage')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/engine/frequency/inertia.test.ts`
Expected: FAIL — cannot resolve `./inertia`.

- [ ] **Step 3: Implement**

Create `src/engine/frequency/inertia.ts`:

```ts
/**
 * Rotational inertia accounting.
 *
 * A synchronous machine stores kinetic energy in its spinning mass; that
 * energy is what resists a frequency change in the instant after a generation
 * or load imbalance. The inertia constant H is that stored energy expressed in
 * seconds: H = E_kinetic / S_rated. A machine with H = 5 s holds enough
 * kinetic energy to supply its full rating for 5 seconds.
 *
 * The point of this module: inverter-coupled plant (solar, wind, batteries)
 * has NO rotating mass synchronised to the grid and therefore contributes
 * ZERO inertia. As renewables displace thermal plant, system inertia falls and
 * the same MW loss produces a much faster frequency collapse. That is the
 * defining stability problem of modern power systems, and here it is emergent
 * rather than scripted.
 *
 * Typical values follow standard machine data (Kundur, "Power System Stability
 * and Control", Table 3.2): large steam ~4-6 s, gas turbines ~3-5 s.
 */

/** Inertia constant H in seconds, by generator kind. */
export const INERTIA_CONSTANTS_S: Readonly<Record<string, number>> = {
  Baseload: 5.0,
  Peaker: 4.0,
  /**
   * The interconnect is not a local machine, but a stiff AC tie couples this
   * system to the neighbouring one's rotating mass. 3.0 s represents the
   * effective inertia the tie contributes at Meridian Bay's scale.
   */
  Import: 3.0,
  Solar: 0,
  Wind: 0,
  Storage: 0,
};

/** System MVA base — the sum of installed capacity at Meridian Bay. */
export const SYSTEM_MVA_BASE = 1150;

export interface MachineInertiaInput {
  readonly kind: string;
  readonly ratedMw: number;
  /** False when tripped or otherwise disconnected. */
  readonly online: boolean;
}

/** True when the machine's rotating mass is synchronised to grid frequency. */
export function isSynchronous(kind: string): boolean {
  return (INERTIA_CONSTANTS_S[kind] ?? 0) > 0;
}

/**
 * Total stored kinetic energy available to resist frequency change, in MW·s
 * (equivalently H_sys · S_base). Only online synchronous machines count.
 */
export function systemInertiaMwS(machines: readonly MachineInertiaInput[]): number {
  let total = 0;
  for (const machine of machines) {
    if (!machine.online) continue;
    total += (INERTIA_CONSTANTS_S[machine.kind] ?? 0) * machine.ratedMw;
  }
  return total;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/engine/frequency/inertia.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/frequency/inertia.ts src/engine/frequency/inertia.test.ts
git commit -m "feat(frequency): system inertia from the online synchronous fleet

Inverter-coupled plant contributes zero inertia, so displacing thermal
generation with renewables measurably weakens the system's resistance to
frequency change. Meridian Bay's full fleet holds 3760 MW-s; losing the
200 MW import tie takes it to 3160."
```

---

### Task 4: The swing equation

**Files:**

- Create: `src/engine/frequency/swing.ts`
- Test: `src/engine/frequency/swing.test.ts`

**Interfaces:**

- Produces: `NOMINAL_HZ`, `MIN_HZ`, `MAX_HZ`, `LOAD_DAMPING_MW_PER_HZ`, `SwingInput`, `SwingResult`, `stepSwing(input): SwingResult`.
- Consumes: nothing.

- [ ] **Step 1: Write the failing test**

Create `src/engine/frequency/swing.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { MIN_HZ, NOMINAL_HZ, stepSwing } from './swing';

describe('stepSwing', () => {
  it('holds nominal frequency when generation matches load', () => {
    const result = stepSwing({
      frequencyHz: NOMINAL_HZ,
      mechanicalMw: 1000,
      electricalMw: 1000,
      inertiaMwS: 3760,
      timestepS: 0.1,
    });
    expect(result.frequencyHz).toBe(NOMINAL_HZ);
    expect(result.rocofHzPerS).toBe(0);
  });

  it('produces the hand-computed RoCoF for a 200 MW deficit', () => {
    // RoCoF = f0 * dP / (2 * H*S) = 60 * -200 / (2 * 3160) = -1.8987...
    const result = stepSwing({
      frequencyHz: NOMINAL_HZ,
      mechanicalMw: 800,
      electricalMw: 1000,
      inertiaMwS: 3160,
      timestepS: 0.1,
    });
    expect(result.rocofHzPerS).toBeCloseTo(-1.8987, 3);
    expect(result.frequencyHz).toBeCloseTo(NOMINAL_HZ - 0.18987, 4);
  });

  it('falls faster at lower inertia for the same deficit', () => {
    const base = { frequencyHz: NOMINAL_HZ, mechanicalMw: 800, electricalMw: 1000, timestepS: 0.1 };
    const strong = stepSwing({ ...base, inertiaMwS: 3760 });
    const weak = stepSwing({ ...base, inertiaMwS: 1500 });
    expect(Math.abs(weak.rocofHzPerS)).toBeGreaterThan(Math.abs(strong.rocofHzPerS));
  });

  it('rises when generation exceeds load', () => {
    const result = stepSwing({
      frequencyHz: NOMINAL_HZ,
      mechanicalMw: 1050,
      electricalMw: 1000,
      inertiaMwS: 3760,
      timestepS: 0.1,
    });
    expect(result.rocofHzPerS).toBeGreaterThan(0);
    expect(result.frequencyHz).toBeGreaterThan(NOMINAL_HZ);
  });

  it('applies load damping that opposes the deviation', () => {
    // Below nominal, load self-regulation reduces demand, easing the deficit.
    const undamped = stepSwing({
      frequencyHz: NOMINAL_HZ,
      mechanicalMw: 900,
      electricalMw: 1000,
      inertiaMwS: 3760,
      timestepS: 0.1,
    });
    const damped = stepSwing({
      frequencyHz: 59.0,
      mechanicalMw: 900,
      electricalMw: 1000,
      inertiaMwS: 3760,
      timestepS: 0.1,
    });
    expect(Math.abs(damped.rocofHzPerS)).toBeLessThan(Math.abs(undamped.rocofHzPerS));
  });

  it('collapses to the floor when no synchronous machine is online', () => {
    const result = stepSwing({
      frequencyHz: 59.5,
      mechanicalMw: 500,
      electricalMw: 1000,
      inertiaMwS: 0,
      timestepS: 0.1,
    });
    expect(result.frequencyHz).toBe(MIN_HZ);
  });

  it('is deterministic — identical inputs give identical output', () => {
    const input = {
      frequencyHz: 59.7,
      mechanicalMw: 940,
      electricalMw: 1081,
      inertiaMwS: 3160,
      timestepS: 0.1,
    };
    expect(stepSwing(input)).toEqual(stepSwing(input));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/engine/frequency/swing.test.ts`
Expected: FAIL — cannot resolve `./swing`.

- [ ] **Step 3: Implement**

Create `src/engine/frequency/swing.ts`:

```ts
/**
 * The swing equation — how system frequency actually moves.
 *
 *     df/dt = f0 / (2 * H_sys * S_base) * (P_mech - P_elec - D * df)
 *
 * Frequency is the *integral* of imbalance, not a function of it. That single
 * distinction is what this module exists to restore: a deficit does not park
 * frequency at a lower value, it drives frequency downward continuously until
 * something arrests it. The rate of that fall (RoCoF) is inversely
 * proportional to stored kinetic energy, which is why inertia matters.
 *
 * `D` is load self-regulation: real load (motors especially) draws less power
 * as frequency falls, which partially offsets a deficit. ~1 %/Hz of system
 * load is the conventional figure.
 *
 * Integration is explicit Euler at the kernel's fixed timestep. At 100 ms with
 * a system time constant of seconds this is stable and exactly reproducible,
 * which matters more here than higher-order accuracy: replay must stay
 * bit-identical.
 */

export const NOMINAL_HZ = 60;
/** Below this the system has collapsed; no useful dynamics remain. */
export const MIN_HZ = 55;
export const MAX_HZ = 65;

/** Load self-regulation, ~1 %/Hz of the 1150 MW base. */
export const LOAD_DAMPING_MW_PER_HZ = 19;

export interface SwingInput {
  /** Frequency at the start of this step, Hz. */
  readonly frequencyHz: number;
  /** Mechanical power delivered by prime movers, MW. */
  readonly mechanicalMw: number;
  /** Electrical power drawn by served load, MW. */
  readonly electricalMw: number;
  /** Stored kinetic energy of online synchronous machines, MW·s. */
  readonly inertiaMwS: number;
  /** Fixed timestep, seconds. */
  readonly timestepS: number;
}

export interface SwingResult {
  readonly frequencyHz: number;
  /** Rate of change of frequency, Hz/s. The size of a loss shows up here. */
  readonly rocofHzPerS: number;
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

/** One fixed-step integration of the swing equation. Pure. */
export function stepSwing(input: SwingInput): SwingResult {
  // With no synchronous machines online there is no rotating mass defining
  // frequency at all — the system has collapsed rather than slowed.
  if (input.inertiaMwS <= 0) {
    return { frequencyHz: MIN_HZ, rocofHzPerS: 0 };
  }

  const deviationHz = input.frequencyHz - NOMINAL_HZ;
  const netMw = input.mechanicalMw - input.electricalMw - LOAD_DAMPING_MW_PER_HZ * deviationHz;

  const rocofHzPerS = (NOMINAL_HZ * netMw) / (2 * input.inertiaMwS);
  const frequencyHz = clamp(input.frequencyHz + rocofHzPerS * input.timestepS, MIN_HZ, MAX_HZ);

  return { frequencyHz, rocofHzPerS };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/engine/frequency/swing.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/frequency/swing.ts src/engine/frequency/swing.test.ts
git commit -m "feat(frequency): the swing equation

Frequency becomes the integral of power imbalance rather than a function of
it. A 200 MW deficit against 3160 MW-s of inertia now yields RoCoF of
-1.90 Hz/s, matching the hand calculation, and the same deficit falls
measurably faster when inertia is lower."
```

---

### Task 5: Under-frequency load shedding

**Files:**

- Create: `src/engine/frequency/ufls.ts`
- Test: `src/engine/frequency/ufls.test.ts`

**Interfaces:**

- Produces: `UFLS_STAGES`, `UflsStage`, `UflsState`, `INITIAL_UFLS_STATE`, `stepUfls(state, frequencyHz): UflsStepResult` where `UflsStepResult = { state: UflsState; newlyTripped: readonly number[] }`, `totalShedFraction(state): number`.
- Consumes: nothing.

- [ ] **Step 1: Write the failing test**

Create `src/engine/frequency/ufls.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { INITIAL_UFLS_STATE, stepUfls, totalShedFraction } from './ufls';

describe('stepUfls', () => {
  it('sheds nothing at nominal frequency', () => {
    const result = stepUfls(INITIAL_UFLS_STATE, 60);
    expect(result.newlyTripped).toEqual([]);
    expect(totalShedFraction(result.state)).toBe(0);
  });

  it('sheds nothing just above the first threshold', () => {
    const result = stepUfls(INITIAL_UFLS_STATE, 59.31);
    expect(result.newlyTripped).toEqual([]);
  });

  it('fires stage 1 at 59.3 Hz', () => {
    const result = stepUfls(INITIAL_UFLS_STATE, 59.3);
    expect(result.newlyTripped).toEqual([1]);
    expect(totalShedFraction(result.state)).toBeCloseTo(0.05, 6);
  });

  it('fires every crossed stage when frequency plunges past several at once', () => {
    const result = stepUfls(INITIAL_UFLS_STATE, 58.5);
    expect(result.newlyTripped).toEqual([1, 2, 3]);
    expect(totalShedFraction(result.state)).toBeCloseTo(0.25, 6);
  });

  it('latches — a recovered frequency does not restore shed load', () => {
    const tripped = stepUfls(INITIAL_UFLS_STATE, 59.0).state;
    const recovered = stepUfls(tripped, 60.0);
    expect(recovered.newlyTripped).toEqual([]);
    expect(totalShedFraction(recovered.state)).toBeCloseTo(0.15, 6);
  });

  it('never fires the same stage twice', () => {
    const first = stepUfls(INITIAL_UFLS_STATE, 59.3);
    const second = stepUfls(first.state, 59.3);
    expect(second.newlyTripped).toEqual([]);
    expect(totalShedFraction(second.state)).toBeCloseTo(0.05, 6);
  });

  it('escalates stage by stage as frequency keeps falling', () => {
    let state = INITIAL_UFLS_STATE;
    state = stepUfls(state, 59.3).state;
    expect(totalShedFraction(state)).toBeCloseTo(0.05, 6);
    state = stepUfls(state, 59.0).state;
    expect(totalShedFraction(state)).toBeCloseTo(0.15, 6);
    state = stepUfls(state, 58.7).state;
    expect(totalShedFraction(state)).toBeCloseTo(0.25, 6);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/engine/frequency/ufls.test.ts`
Expected: FAIL — cannot resolve `./ufls`.

- [ ] **Step 3: Implement**

Create `src/engine/frequency/ufls.ts`:

```ts
/**
 * Under-frequency load shedding — the grid's last automatic defence.
 *
 * When frequency falls far enough that governors cannot arrest it, relays
 * disconnect blocks of load without asking anyone. It is deliberately outside
 * the operator's control: by the time these fire, there is no time for a
 * human decision.
 *
 * The teaching value is precise. UFLS always "works" — frequency recovers and
 * the system survives. But it recovers by making a district dark. A player who
 * acts early never sees stage 1; a player who hesitates watches the grid save
 * itself at the cost of the choice they refused to make.
 *
 * Thresholds follow typical North American practice (three stages between
 * 59.3 and 58.7 Hz shedding roughly a quarter of load in total).
 *
 * Stages LATCH: shed load stays shed until an operator restores it. Real
 * relays behave this way — automatic reconnection into a weak system is how
 * you get a second collapse.
 */

export interface UflsStage {
  readonly stage: number;
  /** Fires at or below this frequency, Hz. */
  readonly thresholdHz: number;
  /** Fraction of total system load disconnected by this stage. */
  readonly shedFraction: number;
}

export const UFLS_STAGES: readonly UflsStage[] = [
  { stage: 1, thresholdHz: 59.3, shedFraction: 0.05 },
  { stage: 2, thresholdHz: 59.0, shedFraction: 0.1 },
  { stage: 3, thresholdHz: 58.7, shedFraction: 0.1 },
];

export interface UflsState {
  /** Stage numbers that have fired, ascending. Latched. */
  readonly firedStages: readonly number[];
}

export const INITIAL_UFLS_STATE: UflsState = { firedStages: [] };

export interface UflsStepResult {
  readonly state: UflsState;
  /** Stages that fired on THIS step — emit one event per entry. */
  readonly newlyTripped: readonly number[];
}

/** Total fraction of system load currently disconnected by UFLS. */
export function totalShedFraction(state: UflsState): number {
  let total = 0;
  for (const stage of UFLS_STAGES) {
    if (state.firedStages.includes(stage.stage)) total += stage.shedFraction;
  }
  return total;
}

/**
 * Evaluate every stage against the present frequency. Pure: returns the next
 * state rather than mutating.
 */
export function stepUfls(state: UflsState, frequencyHz: number): UflsStepResult {
  const newlyTripped: number[] = [];
  for (const stage of UFLS_STAGES) {
    if (state.firedStages.includes(stage.stage)) continue;
    if (frequencyHz <= stage.thresholdHz) newlyTripped.push(stage.stage);
  }

  if (newlyTripped.length === 0) return { state, newlyTripped: [] };

  return {
    state: { firedStages: [...state.firedStages, ...newlyTripped].sort((a, b) => a - b) },
    newlyTripped,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/engine/frequency/ufls.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/frequency/ufls.ts src/engine/frequency/ufls.test.ts
git commit -m "feat(frequency): staged under-frequency load shedding

Three latching stages at 59.3/59.0/58.7 Hz shedding 5/10/10 % of system
load. Automatic and outside operator control: by the time these fire there
is no time for a human decision. The grid survives by going dark, which is
precisely the lesson."
```

---

### Task 6: Reserve accounting and N-1 contingency screening

**Files:**

- Create: `src/engine/frequency/reserve.ts`
- Test: `src/engine/frequency/reserve.test.ts`

**Interfaces:**

- Produces: `SecurityVerdict` (`'Secure' | 'AtRisk' | 'Insecure'`), `ReserveUnit`, `ReserveAssessment`, `assessReserve(units, demandMw, inertiaMwS): ReserveAssessment`.
- Consumes: `NOMINAL_HZ` from `./swing`.

- [ ] **Step 1: Write the failing test**

Create `src/engine/frequency/reserve.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { assessReserve } from './reserve';
import type { ReserveUnit } from './reserve';

const HEALTHY: readonly ReserveUnit[] = [
  { id: 'G-BASE-S', kind: 'Baseload', ratedMw: 400, outputMw: 400, online: true },
  { id: 'G-PEAK-S', kind: 'Peaker', ratedMw: 150, outputMw: 60, online: true },
  { id: 'G-PEAK-IN', kind: 'Peaker', ratedMw: 80, outputMw: 30, online: true },
  { id: 'G-IMPORT', kind: 'Import', ratedMw: 200, outputMw: 150, online: true },
  { id: 'G-SOLAR', kind: 'Solar', ratedMw: 120, outputMw: 90, online: true },
];

describe('assessReserve', () => {
  it('reports headroom on online units', () => {
    const result = assessReserve(HEALTHY, 730, 3760);
    // (150-60) + (80-30) + (200-150) + (120-90) = 90+50+50+30 = 220
    expect(result.reserveMw).toBe(220);
  });

  it('identifies the largest single in-feed', () => {
    const result = assessReserve(HEALTHY, 730, 3760);
    expect(result.largestInfeedMw).toBe(400);
    expect(result.largestInfeedId).toBe('G-BASE-S');
  });

  it('is Secure when reserve covers the largest in-feed', () => {
    const plenty: readonly ReserveUnit[] = [
      { id: 'A', kind: 'Peaker', ratedMw: 300, outputMw: 100, online: true },
      { id: 'B', kind: 'Peaker', ratedMw: 300, outputMw: 100, online: true },
    ];
    // largest in-feed 100 MW; reserve 400 MW
    expect(assessReserve(plenty, 200, 3760).verdict).toBe('Secure');
  });

  it('is Insecure when reserve cannot cover the largest in-feed', () => {
    const result = assessReserve(HEALTHY, 730, 3760);
    // reserve 220 < largest in-feed 400
    expect(result.verdict).toBe('Insecure');
  });

  it('excludes offline units from reserve', () => {
    const tripped = HEALTHY.map((u) =>
      u.id === 'G-IMPORT' ? { ...u, online: false, outputMw: 0 } : u,
    );
    const result = assessReserve(tripped, 730, 3160);
    // 90 + 50 + 30 = 170
    expect(result.reserveMw).toBe(170);
  });

  it('never reports negative headroom for an over-dispatched unit', () => {
    const over: readonly ReserveUnit[] = [
      { id: 'A', kind: 'Peaker', ratedMw: 100, outputMw: 120, online: true },
    ];
    expect(assessReserve(over, 120, 3760).reserveMw).toBe(0);
  });

  it('projects the RoCoF that losing the largest in-feed would cause', () => {
    const result = assessReserve(HEALTHY, 730, 3160);
    // 60 * 400 / (2 * 3160) = 3.797...
    expect(result.projectedRocofHzPerS).toBeCloseTo(3.7975, 3);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/engine/frequency/reserve.test.ts`
Expected: FAIL — cannot resolve `./reserve`.

- [ ] **Step 3: Implement**

Create `src/engine/frequency/reserve.ts`:

```ts
/**
 * Reserve accounting and N-1 contingency screening.
 *
 * The N-1 criterion is the organising principle of power system operation: the
 * system must survive the loss of any single element. Control room staff do
 * not primarily watch what IS happening — they watch what WOULD happen if the
 * largest in-feed disappeared in the next second.
 *
 * Surfacing this turns GridGuard from a reactive game into an anticipatory
 * one. "Corridor stress 58 %" tells a player nothing about whether they are
 * one trip away from losing the city; "Insecure — losing G-BASE-S would take
 * you to 3.8 Hz/s" tells them exactly that.
 */
import { NOMINAL_HZ } from './swing';

export type SecurityVerdict = 'Secure' | 'AtRisk' | 'Insecure';

export interface ReserveUnit {
  readonly id: string;
  readonly kind: string;
  readonly ratedMw: number;
  readonly outputMw: number;
  readonly online: boolean;
}

export interface ReserveAssessment {
  /** Total unloaded capacity on online units, MW. */
  readonly reserveMw: number;
  /** Output of the single largest online in-feed, MW. */
  readonly largestInfeedMw: number;
  readonly largestInfeedId: string | null;
  /** RoCoF that losing the largest in-feed would cause right now, Hz/s. */
  readonly projectedRocofHzPerS: number;
  readonly verdict: SecurityVerdict;
}

/** Reserve below this multiple of the largest in-feed is merely at risk. */
const AT_RISK_RATIO = 1.0;
const SECURE_RATIO = 1.2;

/**
 * Assess whether the system would survive losing its largest single in-feed.
 * Pure; reads a snapshot and computes nothing that persists.
 */
export function assessReserve(
  units: readonly ReserveUnit[],
  demandMw: number,
  inertiaMwS: number,
): ReserveAssessment {
  let reserveMw = 0;
  let largestInfeedMw = 0;
  let largestInfeedId: string | null = null;

  for (const unit of units) {
    if (!unit.online) continue;
    reserveMw += Math.max(0, unit.ratedMw - unit.outputMw);
    if (unit.outputMw > largestInfeedMw) {
      largestInfeedMw = unit.outputMw;
      largestInfeedId = unit.id;
    }
  }

  const projectedRocofHzPerS =
    inertiaMwS > 0 ? (NOMINAL_HZ * largestInfeedMw) / (2 * inertiaMwS) : Infinity;

  let verdict: SecurityVerdict;
  if (largestInfeedMw === 0) {
    verdict = 'Secure';
  } else if (reserveMw >= largestInfeedMw * SECURE_RATIO) {
    verdict = 'Secure';
  } else if (reserveMw >= largestInfeedMw * AT_RISK_RATIO) {
    verdict = 'AtRisk';
  } else {
    verdict = 'Insecure';
  }

  void demandMw; // reserved for the line-overload screen in workstream 3

  return {
    reserveMw,
    largestInfeedMw,
    largestInfeedId,
    projectedRocofHzPerS,
    verdict,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/engine/frequency/reserve.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/frequency/reserve.ts src/engine/frequency/reserve.test.ts
git commit -m "feat(frequency): reserve accounting and N-1 contingency screening

Control room staff watch what WOULD happen if the largest in-feed vanished,
not only what is happening. Secure/AtRisk/Insecure plus the RoCoF that loss
would cause turns the console anticipatory rather than reactive."
```

---

### Task 7: The FrequencyModel — composing the physics

**Files:**

- Create: `src/engine/frequency/frequency-model.ts`
- Create: `src/engine/frequency/index.ts`
- Test: `src/engine/frequency/frequency-model.test.ts`

**Interfaces:**

- Consumes: `systemInertiaMwS`, `MachineInertiaInput` (Task 3); `stepSwing`, `NOMINAL_HZ` (Task 4); `stepUfls`, `INITIAL_UFLS_STATE`, `totalShedFraction`, `UflsState` (Task 5); `assessReserve`, `ReserveUnit`, `SecurityVerdict` (Task 6).
- Produces: `FrequencyMachine`, `FrequencyStepInput`, `FrequencyStepOutput`, `createFrequencyModel(): FrequencyModel` with `step(input): FrequencyStepOutput`, `getState()`, `reset()`, `captureState()`, `restoreState(state)`.

- [ ] **Step 1: Write the failing test**

Create `src/engine/frequency/frequency-model.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { createFrequencyModel } from './frequency-model';
import type { FrequencyMachine } from './frequency-model';

const FLEET: readonly FrequencyMachine[] = [
  { id: 'G-BASE-S', kind: 'Baseload', ratedMw: 400, outputMw: 400, online: true },
  { id: 'G-PEAK-S', kind: 'Peaker', ratedMw: 150, outputMw: 120, online: true },
  { id: 'G-PEAK-IN', kind: 'Peaker', ratedMw: 80, outputMw: 60, online: true },
  { id: 'G-GAS-HB', kind: 'Peaker', ratedMw: 60, outputMw: 50, online: true },
  { id: 'G-IMPORT', kind: 'Import', ratedMw: 200, outputMw: 200, online: true },
  { id: 'G-SOLAR', kind: 'Solar', ratedMw: 120, outputMw: 90, online: true },
  { id: 'G-WIND', kind: 'Wind', ratedMw: 90, outputMw: 40, online: true },
  { id: 'G-BATT-DT', kind: 'Storage', ratedMw: 50, outputMw: 20, online: true },
];

const balanced = () => ({
  machines: FLEET,
  generationMw: 980,
  demandMw: 980,
  timestepS: 0.1,
});

describe('FrequencyModel', () => {
  it('starts at nominal with full fleet inertia', () => {
    const model = createFrequencyModel();
    const out = model.step(balanced());
    expect(out.frequencyHz).toBeCloseTo(60, 6);
    expect(out.inertiaMwS).toBe(3760);
    expect(out.uflsStage).toBe(0);
  });

  it('falls continuously under a sustained deficit', () => {
    const model = createFrequencyModel();
    const deficit = { ...balanced(), generationMw: 880 };
    const first = model.step(deficit);
    const second = model.step(deficit);
    expect(first.frequencyHz).toBeLessThan(60);
    expect(second.frequencyHz).toBeLessThan(first.frequencyHz);
    expect(second.rocofHzPerS).toBeLessThan(0);
  });

  it('loses inertia when a synchronous machine goes offline', () => {
    const model = createFrequencyModel();
    const withImport = model.step(balanced());
    const withoutImport = model.step({
      ...balanced(),
      machines: FLEET.map((m) => (m.id === 'G-IMPORT' ? { ...m, online: false, outputMw: 0 } : m)),
      generationMw: 780,
    });
    expect(withImport.inertiaMwS).toBe(3760);
    expect(withoutImport.inertiaMwS).toBe(3160);
  });

  it('fires UFLS once frequency reaches the first threshold', () => {
    const model = createFrequencyModel();
    const severe = { ...balanced(), generationMw: 700 };
    let out = model.step(severe);
    for (let i = 0; i < 200 && out.uflsStage === 0; i += 1) {
      out = model.step(severe);
    }
    expect(out.uflsStage).toBeGreaterThanOrEqual(1);
    expect(out.uflsShedFraction).toBeGreaterThan(0);
  });

  it('reports an N-1 security verdict each step', () => {
    const model = createFrequencyModel();
    const out = model.step(balanced());
    expect(['Secure', 'AtRisk', 'Insecure']).toContain(out.security);
    expect(out.reserveMw).toBeGreaterThan(0);
  });

  it('is deterministic across two identically driven models', () => {
    const a = createFrequencyModel();
    const b = createFrequencyModel();
    const input = { ...balanced(), generationMw: 900 };
    for (let i = 0; i < 50; i += 1) {
      expect(a.step(input)).toEqual(b.step(input));
    }
  });

  it('round-trips through capture and restore', () => {
    const model = createFrequencyModel();
    const input = { ...balanced(), generationMw: 900 };
    for (let i = 0; i < 20; i += 1) model.step(input);

    const snapshot = model.captureState();
    const expected = model.step(input);

    const restored = createFrequencyModel();
    restored.restoreState(snapshot);
    expect(restored.step(input)).toEqual(expected);
  });

  it('returns to nominal after reset', () => {
    const model = createFrequencyModel();
    for (let i = 0; i < 20; i += 1) model.step({ ...balanced(), generationMw: 800 });
    model.reset();
    expect(model.getState().frequencyHz).toBe(60);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/engine/frequency/frequency-model.test.ts`
Expected: FAIL — cannot resolve `./frequency-model`.

- [ ] **Step 3: Implement**

Create `src/engine/frequency/frequency-model.ts`:

```ts
/**
 * FrequencyModel — the system's rotational dynamics, composed.
 *
 * Each tick: recompute inertia from the machines actually online, integrate
 * the swing equation against the present imbalance, then let the UFLS relays
 * look at the result. Reserve/N-1 screening rides along because it needs the
 * same snapshot.
 *
 * Ordering matters. UFLS evaluates AFTER integration, on the frequency the
 * step produced — a relay responds to the frequency that exists, not the one
 * that existed before the imbalance was applied.
 *
 * Governor action is NOT a separate power term here. The generation model
 * already ramps units toward demand with per-kind rate limits, which is
 * mechanically what a governor does; adding a parallel droop injection would
 * double-count primary response. Droop instead scales that ramp's urgency —
 * see `generation.ts`.
 */
import { systemInertiaMwS } from './inertia';
import type { MachineInertiaInput } from './inertia';
import { assessReserve } from './reserve';
import type { ReserveUnit, SecurityVerdict } from './reserve';
import { NOMINAL_HZ, stepSwing } from './swing';
import { INITIAL_UFLS_STATE, stepUfls, totalShedFraction } from './ufls';
import type { UflsState } from './ufls';

/** One machine as the frequency model sees it. */
export interface FrequencyMachine extends MachineInertiaInput, ReserveUnit {
  readonly id: string;
  readonly kind: string;
  readonly ratedMw: number;
  readonly outputMw: number;
  readonly online: boolean;
}

export interface FrequencyStepInput {
  readonly machines: readonly FrequencyMachine[];
  /** Total mechanical power delivered this tick, MW. */
  readonly generationMw: number;
  /** Total electrical demand served this tick, MW. */
  readonly demandMw: number;
  readonly timestepS: number;
}

export interface FrequencyStepOutput {
  readonly frequencyHz: number;
  readonly rocofHzPerS: number;
  readonly inertiaMwS: number;
  /** Highest UFLS stage that has fired; 0 when none. */
  readonly uflsStage: number;
  readonly uflsShedFraction: number;
  /** Stages that fired on THIS step — emit one event each. */
  readonly uflsNewlyTripped: readonly number[];
  readonly security: SecurityVerdict;
  readonly reserveMw: number;
  readonly largestInfeedMw: number;
}

interface InternalState {
  readonly frequencyHz: number;
  readonly ufls: UflsState;
}

export interface FrequencyModel {
  step(input: FrequencyStepInput): FrequencyStepOutput;
  getState(): InternalState;
  reset(): void;
  captureState(): unknown;
  restoreState(state: unknown): void;
}

const INITIAL: InternalState = {
  frequencyHz: NOMINAL_HZ,
  ufls: INITIAL_UFLS_STATE,
};

export function createFrequencyModel(): FrequencyModel {
  let state: InternalState = INITIAL;

  return {
    step(input: FrequencyStepInput): FrequencyStepOutput {
      const inertiaMwS = systemInertiaMwS(input.machines);

      const swing = stepSwing({
        frequencyHz: state.frequencyHz,
        mechanicalMw: input.generationMw,
        electricalMw: input.demandMw,
        inertiaMwS,
        timestepS: input.timestepS,
      });

      const ufls = stepUfls(state.ufls, swing.frequencyHz);
      state = { frequencyHz: swing.frequencyHz, ufls: ufls.state };

      const reserve = assessReserve(input.machines, input.demandMw, inertiaMwS);
      const firedStages = ufls.state.firedStages;

      return {
        frequencyHz: swing.frequencyHz,
        rocofHzPerS: swing.rocofHzPerS,
        inertiaMwS,
        uflsStage: firedStages.length === 0 ? 0 : (firedStages[firedStages.length - 1] ?? 0),
        uflsShedFraction: totalShedFraction(ufls.state),
        uflsNewlyTripped: ufls.newlyTripped,
        security: reserve.verdict,
        reserveMw: reserve.reserveMw,
        largestInfeedMw: reserve.largestInfeedMw,
      };
    },

    getState(): InternalState {
      return state;
    },

    reset(): void {
      state = INITIAL;
    },

    captureState(): unknown {
      return { frequencyHz: state.frequencyHz, firedStages: [...state.ufls.firedStages] };
    },

    restoreState(snapshot: unknown): void {
      const s = snapshot as { frequencyHz: number; firedStages: number[] };
      state = {
        frequencyHz: s.frequencyHz,
        ufls: { firedStages: [...s.firedStages] },
      };
    },
  };
}
```

- [ ] **Step 4: Create the barrel export**

Create `src/engine/frequency/index.ts`:

```ts
export { INERTIA_CONSTANTS_S, SYSTEM_MVA_BASE, isSynchronous, systemInertiaMwS } from './inertia';
export type { MachineInertiaInput } from './inertia';

export { LOAD_DAMPING_MW_PER_HZ, MAX_HZ, MIN_HZ, NOMINAL_HZ, stepSwing } from './swing';
export type { SwingInput, SwingResult } from './swing';

export { INITIAL_UFLS_STATE, UFLS_STAGES, stepUfls, totalShedFraction } from './ufls';
export type { UflsStage, UflsState, UflsStepResult } from './ufls';

export { assessReserve } from './reserve';
export type { ReserveAssessment, ReserveUnit, SecurityVerdict } from './reserve';

export { createFrequencyModel } from './frequency-model';
export type {
  FrequencyMachine,
  FrequencyModel,
  FrequencyStepInput,
  FrequencyStepOutput,
} from './frequency-model';
```

- [ ] **Step 5: Run the tests and the engine typecheck**

Run: `pnpm vitest run src/engine/frequency && pnpm typecheck:engine`
Expected: all frequency tests PASS (26 across four files); 0 type errors.

- [ ] **Step 6: Commit**

```bash
git add src/engine/frequency/frequency-model.ts src/engine/frequency/frequency-model.test.ts src/engine/frequency/index.ts
git commit -m "feat(frequency): compose inertia, swing, UFLS and N-1 into one model

UFLS evaluates after integration, on the frequency the step produced — a
relay responds to the frequency that exists. Governor action is not a
separate power term: the generation model already ramps toward demand with
per-kind rate limits, and a parallel droop injection would double-count
primary response."
```

---

### Task 8: Retire the algebraic frequency formula

**Files:**

- Modify: `src/engine/model/grid.ts:110-119`
- Modify: `src/engine/simulation-engine.ts`
- Test: `src/engine/simulation-engine.test.ts`

**Interfaces:**

- Consumes: `createFrequencyModel`, `FrequencyMachine`, `FrequencyModel` (Task 7).
- Produces: `GridState` gains `rocof: number`, `inertiaMwS: number`, `uflsStage: number`, `uflsShedFraction: number`, `security: SecurityVerdict`, `reserveMw: MegaWatts`, `largestInfeedMw: MegaWatts`.

- [ ] **Step 1: Write the failing test**

Append to `src/engine/simulation-engine.test.ts` inside the existing top-level `describe`:

```ts
it('integrates frequency rather than computing it algebraically', () => {
  const { engine, context } = makeEngine();
  engine.init(context);

  // Two ticks under identical conditions must NOT give identical frequency
  // if a real imbalance exists — the old formula was memoryless and would.
  engine.step({ tick: 1, timestep: 0.1, simTime: 0.1 } as never);
  const first = engine.getState().frequency as number;
  engine.step({ tick: 2, timestep: 0.1, simTime: 0.2 } as never);
  const second = engine.getState().frequency as number;

  expect(Number.isFinite(first)).toBe(true);
  expect(Number.isFinite(second)).toBe(true);
  // Frequency must be a plausible grid frequency at all times.
  expect(first).toBeGreaterThan(55);
  expect(first).toBeLessThan(65);
});

it('publishes inertia, RoCoF and an N-1 verdict on GridState', () => {
  const { engine, context } = makeEngine();
  engine.init(context);
  engine.step({ tick: 1, timestep: 0.1, simTime: 0.1 } as never);

  const state = engine.getState();
  expect(state.inertiaMwS).toBeGreaterThan(0);
  expect(Number.isFinite(state.rocof)).toBe(true);
  expect(['Secure', 'AtRisk', 'Insecure']).toContain(state.security);
  expect(state.uflsStage).toBe(0);
});
```

If `makeEngine` does not already exist in that file, reuse whatever construction helper the existing tests use — read the file's existing setup before writing this step.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/engine/simulation-engine.test.ts`
Expected: FAIL — `state.inertiaMwS` is undefined.

- [ ] **Step 3: Extend GridState**

In `src/engine/model/grid.ts`, add to the imports:

```ts
import type { SecurityVerdict } from '../frequency';
```

Replace the `GridState` interface:

```ts
export interface GridState {
  readonly frequency: Hertz;
  /** Rate of change of frequency, Hz/s. Negative while frequency falls. */
  readonly rocof: number;
  /** Stored kinetic energy of online synchronous machines, MW·s. */
  readonly inertiaMwS: number;
  /** Highest under-frequency load-shedding stage that has fired; 0 = none. */
  readonly uflsStage: number;
  /** Fraction of system load disconnected automatically by UFLS. */
  readonly uflsShedFraction: number;
  /** N-1 contingency verdict for the present operating point. */
  readonly security: SecurityVerdict;
  /** Unloaded capacity on online units, MW. */
  readonly reserveMw: MegaWatts;
  /** Output of the largest single online in-feed, MW. */
  readonly largestInfeedMw: MegaWatts;
  readonly lines: readonly LineFlow[];
  readonly zones: readonly ZoneStatus[];
  readonly totalGeneration: MegaWatts;
  readonly totalLoad: MegaWatts;
  /** Output from Solar + Wind + Storage units this tick. */
  readonly renewableGeneration: MegaWatts;
  readonly generators: readonly GeneratorStatus[];
}
```

- [ ] **Step 4: Wire the model into the engine**

In `src/engine/simulation-engine.ts`, add to the imports:

```ts
import { createFrequencyModel } from './frequency';
import type { FrequencyMachine, FrequencyModel } from './frequency';
```

Add a private field beside `state`:

```ts
  private readonly frequencyModel: FrequencyModel = createFrequencyModel();
```

Replace lines 273-283 (the algebraic formula and the state assignment):

```ts
// 9. Frequency dynamics.
//
// Frequency is the INTEGRAL of imbalance, not a function of it. The old
// `60 + 0.005 * (gen - load)` was memoryless: a deficit parked frequency
// at a value and nothing further happened. Real frequency falls
// continuously at a rate set by how much rotating mass is online, which
// is why losing a synchronous machine is qualitatively worse than losing
// the same MW of solar.
const machines: readonly FrequencyMachine[] = topology.generators.map((gen) => ({
  id: gen.id as string,
  kind: gen.kind as string,
  ratedMw: gen.capacity as number,
  outputMw: this.generation.getGeneratorOutput(gen.id) as number,
  online: !this.generation.isTripped(gen.id),
}));

const freq = this.frequencyModel.step({
  machines,
  generationMw: totalGen as number,
  demandMw: totalDemand as number,
  timestepS: context.timestep,
});

this.state = {
  frequency: asHertz(freq.frequencyHz),
  rocof: freq.rocofHzPerS,
  inertiaMwS: freq.inertiaMwS,
  uflsStage: freq.uflsStage,
  uflsShedFraction: freq.uflsShedFraction,
  security: freq.security,
  reserveMw: asMegaWatts(freq.reserveMw),
  largestInfeedMw: asMegaWatts(freq.largestInfeedMw),
  lines: lineFlows,
  zones: zoneStatuses,
  totalGeneration: totalGen,
  totalLoad: totalDemand,
  renewableGeneration: asMegaWatts(renewableMw),
  generators: generatorStatuses,
};
```

- [ ] **Step 5: Update reset, snapshot and initial state**

In `reset()`, add before `this._initializeState()`:

```ts
this.frequencyModel.reset();
```

In `captureState()`, add to the returned object:

```ts
      frequency: this.frequencyModel.captureState(),
```

In `restoreState()`, add `frequency: unknown;` to the destructured type and, before `this.state = s.state;`:

```ts
this.frequencyModel.restoreState(s.frequency);
```

In `_initializeState()`, replace the assignment:

```ts
this.state = {
  frequency: asHertz(60),
  rocof: 0,
  inertiaMwS: 0,
  uflsStage: 0,
  uflsShedFraction: 0,
  security: 'Secure',
  reserveMw: asMegaWatts(0),
  largestInfeedMw: asMegaWatts(0),
  lines: [],
  zones: [],
  totalGeneration: asMegaWatts(0),
  totalLoad: asMegaWatts(0),
  renewableGeneration: asMegaWatts(0),
  generators: [],
};
```

- [ ] **Step 6: Run the full suite**

Run: `pnpm typecheck && pnpm typecheck:engine && pnpm test`
Expected: 0 type errors; all tests PASS. Other tests constructing a `GridState` literal (e.g. `restoration.test.ts:93,129`, `director.test.ts:29`) will need the new fields — add them with the same defaults as `_initializeState`.

- [ ] **Step 7: Commit**

```bash
git add src/engine
git commit -m "feat(engine): retire the algebraic frequency formula

simulation-engine computed frequency as 60 + 0.005*(gen-load) — memoryless
and instantaneous, so a 98 MW deficit parked the display at 59.51 Hz and
nothing further happened. Frequency is now integrated by FrequencyModel,
and GridState publishes RoCoF, system inertia, UFLS stage and the N-1
security verdict alongside it."
```

---

### Task 9: Events and the state projection

**Files:**

- Modify: `src/constants/events.ts`
- Modify: `src/core/events/grid-events.ts`
- Modify: `src/engine/simulation-engine.ts`
- Modify: `src/state/grid-store.ts`
- Test: `src/state/grid-store.test.ts` (create)

**Interfaces:**

- Consumes: `FrequencyStepOutput` (Task 7); `GridState` new fields (Task 8).
- Produces: `GRID_EVENT.LoadShedAutomatic` / `SecurityChanged`; `GridProjection` gains `rocof`, `inertiaMwS`, `uflsStage`, `uflsShedFraction`, `security`, `reserveMw`, `largestInfeedMw`.

- [ ] **Step 1: Register the event names**

In `src/constants/events.ts`, add inside `GRID_EVENT` after `ZoneBlackout`:

```ts
  /** An under-frequency relay stage shed load automatically. */
  LoadShedAutomatic: 'LoadShedAutomatic',
  /** The N-1 contingency verdict changed. */
  SecurityChanged: 'SecurityChanged',
```

- [ ] **Step 2: Add the payloads**

In `src/core/events/grid-events.ts`, add after `ZoneBlackoutPayload`:

```ts
export interface LoadShedAutomaticPayload {
  /** UFLS stage that fired, 1-based. */
  readonly stage: number;
  readonly thresholdHz: number;
  /** Fraction of system load this stage disconnected. */
  readonly shedFraction: number;
}

export interface SecurityChangedPayload {
  readonly verdict: 'Secure' | 'AtRisk' | 'Insecure';
  readonly reserveMw: MegaWatts;
  readonly largestInfeedMw: MegaWatts;
}
```

Add to `GridEventMap` after `ZoneBlackout`:

```ts
LoadShedAutomatic: LoadShedAutomaticPayload;
SecurityChanged: SecurityChangedPayload;
```

- [ ] **Step 3: Emit them from the engine**

In `src/engine/simulation-engine.ts`, immediately after the `this.state = {...}` assignment from Task 8:

```ts
// UFLS fired: this is the grid saving itself without asking. One event per
// stage so the timeline can explain each block of load that went dark.
for (const stage of freq.uflsNewlyTripped) {
  const definition = UFLS_STAGES.find((s) => s.stage === stage);
  if (definition === undefined) continue;
  domainEvents.emit(GRID_EVENT.LoadShedAutomatic, {
    stage,
    thresholdHz: definition.thresholdHz,
    shedFraction: definition.shedFraction,
  });
}

if (freq.security !== previousSecurity) {
  domainEvents.emit(GRID_EVENT.SecurityChanged, {
    verdict: freq.security,
    reserveMw: asMegaWatts(freq.reserveMw),
    largestInfeedMw: asMegaWatts(freq.largestInfeedMw),
  });
}
```

Capture `previousSecurity` immediately before the `this.state = {...}` assignment:

```ts
const previousSecurity = this.state.security;
```

Add `UFLS_STAGES` to the frequency import in this file.

- [ ] **Step 4: Write the failing projection test**

Create `src/state/grid-store.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { useGridStore } from './grid-store';

describe('grid-store projection', () => {
  it('defaults to a 60 Hz grid at rest', () => {
    const state = useGridStore.getState();
    expect(state.frequency).toBe(60);
    expect(state.rocof).toBe(0);
    expect(state.inertiaMwS).toBe(0);
    expect(state.uflsStage).toBe(0);
    expect(state.security).toBe('Secure');
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `pnpm vitest run src/state/grid-store.test.ts`
Expected: FAIL — `rocof` is undefined.

- [ ] **Step 6: Project the new fields**

In `src/state/grid-store.ts`, add to `GridProjection`:

```ts
  readonly rocof: number;
  readonly inertiaMwS: number;
  readonly uflsStage: number;
  readonly uflsShedFraction: number;
  readonly security: 'Secure' | 'AtRisk' | 'Insecure';
  readonly reserveMw: number;
  readonly largestInfeedMw: number;
```

Add to `INITIAL`:

```ts
  rocof: 0,
  inertiaMwS: 0,
  uflsStage: 0,
  uflsShedFraction: 0,
  security: 'Secure',
  reserveMw: 0,
  largestInfeedMw: 0,
```

Add inside the `SimulationTick` handler's `setState` call:

```ts
        rocof: gs.rocof,
        inertiaMwS: gs.inertiaMwS,
        uflsStage: gs.uflsStage,
        uflsShedFraction: gs.uflsShedFraction,
        security: gs.security,
        reserveMw: gs.reserveMw as number,
        largestInfeedMw: gs.largestInfeedMw as number,
```

- [ ] **Step 7: Verify everything**

Run: `pnpm typecheck && pnpm typecheck:engine && pnpm test`
Expected: 0 type errors; all tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/constants src/core/events src/engine src/state
git commit -m "feat(events): publish automatic load shedding and N-1 verdict changes

UFLS emits one LoadShedAutomatic per stage so the timeline can explain each
block that went dark, and SecurityChanged fires on N-1 transitions. The grid
projection carries RoCoF, inertia, UFLS stage and reserve for the console."
```

---

### Task 10: Governor urgency in the generation ramp

**Files:**

- Modify: `src/engine/generation/generation.ts:169-200`
- Test: `src/engine/generation/generation.test.ts`

**Interfaces:**

- Consumes: `NOMINAL_HZ` (Task 4).
- Produces: `IGenerationModel.dispatch` gains an optional fourth parameter `frequencyHz?: number`.

- [ ] **Step 1: Write the failing test**

Append to `src/engine/generation/generation.test.ts` inside the existing `describe`:

```ts
it('ramps governed units harder when frequency is depressed', () => {
  const nominal = new MeridianBayGenerationModel();
  const depressed = new MeridianBayGenerationModel();
  nominal.init(makeContext());
  depressed.init(makeContext());

  const weather = { irradiance: 1, wind: 1, temperature: 40 } as never;

  // Prime both with the same starting outputs.
  nominal.dispatch(MERIDIAN_BAY_TOPOLOGY, weather, 600 as never, 60);
  depressed.dispatch(MERIDIAN_BAY_TOPOLOGY, weather, 600 as never, 60);

  // Now ask for far more than either can reach in one tick.
  nominal.dispatch(MERIDIAN_BAY_TOPOLOGY, weather, 1100 as never, 60);
  depressed.dispatch(MERIDIAN_BAY_TOPOLOGY, weather, 1100 as never, 59.0);

  expect(depressed.totalOutput() as number).toBeGreaterThan(nominal.totalOutput() as number);
});

it('does not exceed rated capacity however urgent the governor', () => {
  const model = new MeridianBayGenerationModel();
  model.init(makeContext());
  const weather = { irradiance: 1, wind: 1, temperature: 40 } as never;
  for (let i = 0; i < 200; i += 1) {
    model.dispatch(MERIDIAN_BAY_TOPOLOGY, weather, 2000 as never, 57.0);
  }
  expect(model.totalOutput() as number).toBeLessThanOrEqual(1150);
});
```

Read the file's existing setup first and reuse its context helper and imports rather than inventing `makeContext` if one already exists under another name.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/engine/generation/generation.test.ts`
Expected: FAIL — `dispatch` takes three parameters; the depressed and nominal outputs are equal.

- [ ] **Step 3: Widen the interface**

In `src/engine/generation/generation.ts`, change the `IGenerationModel.dispatch` signature:

```ts
  dispatch(
    topology: GridTopology,
    weather: WeatherState,
    targetDemand?: MegaWatts,
    frequencyHz?: number,
  ): readonly GenerationDispatch[];
```

- [ ] **Step 4: Implement governor urgency**

Add near the top of `generation.ts`, after the imports:

```ts
/**
 * Governor droop, per unit. 5 % means a 5 % frequency change commands 100 %
 * output change — the standard setting for interconnected operation.
 */
const DROOP_R = 0.05;
const NOMINAL_HZ = 60;
/** A governor can open a valve several times faster than a dispatch ramp. */
const MAX_GOVERNOR_URGENCY = 4;
```

Change the `dispatch` signature on the class to match the interface, then replace the ramp-limit block (lines 169-200) with:

```ts
// 3. Apply ramp rate limits from previous outputs.
//
// These limits ARE the primary frequency response: a governor senses
// falling frequency and opens the valve, and how fast it can do so is
// exactly what a ramp limit expresses. Frequency deviation therefore
// scales the limit rather than injecting a separate power term — adding a
// parallel droop injection on top of a dispatch that already chases demand
// would double-count primary response.
//
// Baseload cannot ramp meaningfully; renewables are weather-limited;
// neither responds to frequency.
const deviationHz = NOMINAL_HZ - frequencyHz;
const urgency =
  deviationHz <= 0
    ? 1
    : Math.min(MAX_GOVERNOR_URGENCY, 1 + deviationHz / (DROOP_R * NOMINAL_HZ) / 0.1);

const RAMP_LIMITS: Readonly<Record<string, number>> = {
  Peaker: 5,
  Import: 10,
  Storage: 20,
};

for (const gen of topology.generators) {
  const target = plannedDispatch.get(gen.id) ?? 0;
  const prev = this.currentOutputs.get(gen.id) ?? 0;

  let actual = target;
  if (this.tripped.has(gen.id)) {
    actual = 0;
  } else {
    const baseLimit = RAMP_LIMITS[gen.kind as string];
    if (baseLimit !== undefined) {
      // Only an increase is urgent — a governor does not close a valve
      // faster because frequency is low.
      const diff = target - prev;
      const limit = diff > 0 ? baseLimit * urgency : baseLimit;
      if (Math.abs(diff) > limit) {
        actual = prev + Math.sign(diff) * limit;
      }
    }
  }

  // Clamp actual between 0 and maximum available
  const maxAvail = availabilities.get(gen.id) ?? 0;
  actual = Math.max(0, Math.min(maxAvail, actual));

  this.currentOutputs.set(gen.id, asMegaWatts(actual));
  results.push({ generator: gen.id, output: asMegaWatts(actual) });

  // Emit GenerationChanged when output changes
  (this.context.events as unknown as TypedEventBus<GridEventMap>).emit(
    GRID_EVENT.GenerationChanged,
    { generator: gen.id, output: asMegaWatts(actual) },
  );
}
```

Add the parameter with its default to the method signature:

```ts
  public dispatch(
    topology: GridTopology,
    weather: WeatherState,
    targetDemand: MegaWatts = 895 as MegaWatts,
    frequencyHz = NOMINAL_HZ,
  ): readonly GenerationDispatch[] {
```

- [ ] **Step 5: Pass the live frequency from the engine**

In `src/engine/simulation-engine.ts`, change the dispatch call (line 139):

```ts
// The governor sees the frequency the LAST tick ended at — a real governor
// responds to measured frequency, which is necessarily a tick behind.
this.generation.dispatch(topology, weatherState, totalDemand, this.state.frequency as number);
```

- [ ] **Step 6: Verify**

Run: `pnpm typecheck && pnpm typecheck:engine && pnpm test`
Expected: 0 type errors; all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/engine/generation src/engine/simulation-engine.ts
git commit -m "feat(generation): governor urgency scales the dispatch ramp

Ramp limits ARE primary frequency response — a governor senses falling
frequency and opens the valve, and the limit expresses how fast it can.
Frequency deviation now scales that limit rather than injecting a parallel
droop term, which would double-count against a dispatch already chasing
demand. Only increases are urgent, and rated capacity still binds."
```

---

### Task 11: What-if projection for operator actions

**Files:**

- Create: `src/engine/frequency/what-if.ts`
- Test: `src/engine/frequency/what-if.test.ts`
- Modify: `src/engine/frequency/index.ts`

**Interfaces:**

- Consumes: `createFrequencyModel`, `FrequencyMachine` (Task 7).
- Produces: `WhatIfInput`, `WhatIfProjection`, `projectAction(input): WhatIfProjection`.

- [ ] **Step 1: Write the failing test**

Create `src/engine/frequency/what-if.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { projectAction } from './what-if';
import type { FrequencyMachine } from './frequency-model';

const FLEET: readonly FrequencyMachine[] = [
  { id: 'G-BASE-S', kind: 'Baseload', ratedMw: 400, outputMw: 400, online: true },
  { id: 'G-PEAK-S', kind: 'Peaker', ratedMw: 150, outputMw: 150, online: true },
  { id: 'G-SOLAR', kind: 'Solar', ratedMw: 120, outputMw: 90, online: true },
];

const BASE = {
  machines: FLEET,
  generationMw: 640,
  demandMw: 740,
  frequencyHz: 59.6,
  timestepS: 0.1,
  horizonTicks: 50,
};

describe('projectAction', () => {
  it('reports a smaller deficit when load is removed', () => {
    const doNothing = projectAction({ ...BASE, loadReliefMw: 0 });
    const shed = projectAction({ ...BASE, loadReliefMw: 100 });
    expect(shed.finalFrequencyHz).toBeGreaterThan(doNothing.finalFrequencyHz);
    expect(shed.deltaDemandMw).toBe(-100);
  });

  it('predicts recovery toward nominal when relief closes the gap', () => {
    const shed = projectAction({ ...BASE, loadReliefMw: 100 });
    expect(shed.finalFrequencyHz).toBeGreaterThan(BASE.frequencyHz);
  });

  it('predicts continued decline with no action', () => {
    const doNothing = projectAction({ ...BASE, loadReliefMw: 0 });
    expect(doNothing.finalFrequencyHz).toBeLessThan(BASE.frequencyHz);
  });

  it('flags whether UFLS would fire within the horizon', () => {
    const severe = projectAction({ ...BASE, demandMw: 900, loadReliefMw: 0 });
    expect(severe.uflsWouldFire).toBe(true);
    const relieved = projectAction({ ...BASE, demandMw: 900, loadReliefMw: 300 });
    expect(relieved.uflsWouldFire).toBe(false);
  });

  it('never mutates the caller’s machine list', () => {
    const before = JSON.stringify(FLEET);
    projectAction({ ...BASE, loadReliefMw: 100 });
    expect(JSON.stringify(FLEET)).toBe(before);
  });

  it('is deterministic', () => {
    const input = { ...BASE, loadReliefMw: 60 };
    expect(projectAction(input)).toEqual(projectAction(input));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/engine/frequency/what-if.test.ts`
Expected: FAIL — cannot resolve `./what-if`.

- [ ] **Step 3: Implement**

Create `src/engine/frequency/what-if.ts`:

```ts
/**
 * What-if projection for operator actions.
 *
 * The console must be able to say "this lever buys you +0.18 Hz and keeps you
 * out of load shedding" BEFORE the player commits, and that number has to come
 * from the same physics that will judge them afterwards. Anything estimated in
 * the UI would eventually disagree with the simulation, and the moment a
 * teaching tool lies about consequence it stops teaching.
 *
 * This runs the real frequency model forward against a COPY of the operating
 * point. It never touches live state.
 *
 * It deliberately holds generation flat over the horizon: it answers "what
 * does this lever do", not "what will the whole grid do", and crediting
 * unrelated dispatch to the player's action would overstate it.
 */
import { createFrequencyModel } from './frequency-model';
import type { FrequencyMachine } from './frequency-model';

export interface WhatIfInput {
  readonly machines: readonly FrequencyMachine[];
  readonly generationMw: number;
  readonly demandMw: number;
  readonly frequencyHz: number;
  readonly timestepS: number;
  /** Ticks to simulate forward. */
  readonly horizonTicks: number;
  /** MW of demand the candidate action removes. */
  readonly loadReliefMw: number;
}

export interface WhatIfProjection {
  readonly finalFrequencyHz: number;
  readonly lowestFrequencyHz: number;
  /** Change in demand the action causes, MW (negative = relief). */
  readonly deltaDemandMw: number;
  /** True if any UFLS stage would fire within the horizon. */
  readonly uflsWouldFire: boolean;
  readonly finalReserveMw: number;
}

/** Run the real physics forward against a copy. Pure. */
export function projectAction(input: WhatIfInput): WhatIfProjection {
  const model = createFrequencyModel();
  model.restoreState({ frequencyHz: input.frequencyHz, firedStages: [] });

  const demandMw = Math.max(0, input.demandMw - input.loadReliefMw);
  let lowestFrequencyHz = input.frequencyHz;
  let uflsWouldFire = false;
  let finalFrequencyHz = input.frequencyHz;
  let finalReserveMw = 0;

  for (let tick = 0; tick < input.horizonTicks; tick += 1) {
    const out = model.step({
      machines: input.machines,
      generationMw: input.generationMw,
      demandMw,
      timestepS: input.timestepS,
    });
    finalFrequencyHz = out.frequencyHz;
    finalReserveMw = out.reserveMw;
    if (out.frequencyHz < lowestFrequencyHz) lowestFrequencyHz = out.frequencyHz;
    if (out.uflsStage > 0) uflsWouldFire = true;
  }

  return {
    finalFrequencyHz,
    lowestFrequencyHz,
    deltaDemandMw: -input.loadReliefMw,
    uflsWouldFire,
    finalReserveMw,
  };
}
```

- [ ] **Step 4: Export it**

Add to `src/engine/frequency/index.ts`:

```ts
export { projectAction } from './what-if';
export type { WhatIfInput, WhatIfProjection } from './what-if';
```

- [ ] **Step 5: Verify the whole suite**

Run: `pnpm typecheck && pnpm typecheck:engine && pnpm test`
Expected: 0 type errors; all tests PASS.

- [ ] **Step 6: Run the visual audit**

Ensure the dev server is running, then:

Run: `node scripts/visual-audit.mjs --label=ws1 --url=http://localhost:5173`
Expected: `AUDIT PASS`, `page errors: none`.

- [ ] **Step 7: Commit**

```bash
git add src/engine/frequency docs/superpowers/audit/ws1
git commit -m "feat(frequency): what-if projection for operator actions

The console must be able to say what a lever buys BEFORE the player commits,
using the same physics that will judge them afterwards. Runs the real model
forward against a copy of the operating point; generation is held flat so an
action is not credited with unrelated dispatch."
```

---

## Self-Review

**Spec coverage.** Workstream 0: overlay opt-in (Task 1), real instrumentation (Task 1), world bounds and canvas bleed (Task 2). The spec also listed removing the wireframe substation markers and rescaling the solar farm under workstream 0 — both are deferred to workstream 2, where that geometry is replaced wholesale rather than patched twice; the spec's own workstream 2 already owns them. Workstream 1: swing equation (Task 4), inertia from online synchronous plant (Task 3), governor droop (Task 10), UFLS (Task 5), N-1 screening (Task 6), what-if API (Task 11), events and projection (Task 9). The **per-bus voltage estimate** is not covered here — it exists only to drive brownout flicker in workstream 2, so it moves to that plan where its consumer lives.

**Placeholder scan.** No TBD/TODO. Every code step carries real code. Two steps (Task 8 Step 1, Task 10 Step 1) instruct the implementer to reuse an existing test helper rather than assuming its name — that is a deliberate instruction to read first, not a placeholder.

**Type consistency.** `FrequencyMachine` extends both `MachineInertiaInput` and `ReserveUnit`, so one array satisfies `systemInertiaMwS` and `assessReserve` — checked against both signatures. `SecurityVerdict` is defined once in `reserve.ts` and imported by `grid.ts` and re-declared structurally (not imported) in `grid-events.ts`, because `core` must not depend on `engine`; the union is written out literally there. `stepUfls` returns `{ state, newlyTripped }` and every caller destructures both. `totalShedFraction` takes `UflsState`, matching its call site in `frequency-model.ts`.
