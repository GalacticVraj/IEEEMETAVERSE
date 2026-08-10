/**
 * TutorialManager — the controller for the persona tutorial.
 *
 * Owns everything the store and the dialog deliberately don't: which beat is
 * current, when a beat's gate is satisfied, which panel that beat discloses,
 * and the fallback that stops an interaction gate from ever freezing a demo.
 *
 * Mounted only in AppMode.Tutorial, and only after the intro flyover lands.
 */
import { useTutorialStore, useUiStore } from '@state';
import { useEffect, useRef } from 'react';
import type { ReactElement } from 'react';

import { PersonaDialog } from './PersonaDialog';
import { TUTORIAL_BEATS } from './tutorial-steps';

export function TutorialManager(): ReactElement | null {
  const active = useTutorialStore((s) => s.active);
  const stepIndex = useTutorialStore((s) => s.stepIndex);
  const advance = useTutorialStore((s) => s.advance);
  const reveal = useTutorialStore((s) => s.reveal);
  const complete = useTutorialStore((s) => s.complete);

  const selectedAsset = useUiStore((s) => s.selectedAsset);
  const selectAsset = useUiStore((s) => s.selectAsset);

  const beat = TUTORIAL_BEATS[stepIndex];

  // Disclose this beat's panel as it begins. Panels only ever get added, so
  // running this again after a re-render is harmless.
  useEffect(() => {
    if (!active || beat?.reveals === undefined) return;
    reveal(beat.reveals);
  }, [active, beat, reveal]);

  // Past the last beat the tutorial is finished — unlock everything and stop.
  useEffect(() => {
    if (active && beat === undefined) complete();
  }, [active, beat, complete]);

  // An interaction gate must never be able to strand a player (or a judge
  // watching a demo). If nothing is selected in time, select it for them.
  const gate = beat?.gate;
  const gateSatisfied = gate?.kind === 'select-asset' && selectedAsset !== null;
  const fallbackFired = useRef<string | null>(null);

  useEffect(() => {
    if (!active || gate?.kind !== 'select-asset' || beat === undefined) return;
    if (selectedAsset !== null || fallbackFired.current === beat.id) return;

    const timer = setTimeout(() => {
      fallbackFired.current = beat.id;
      if (useUiStore.getState().selectedAsset === null) {
        selectAsset({ kind: 'building', id: gate.fallbackAssetId });
      }
    }, gate.fallbackMs);

    return () => clearTimeout(timer);
  }, [active, beat, gate, selectedAsset, selectAsset]);

  // Satisfying a select-asset gate advances on its own — the player already
  // acted, so making them also press Continue would feel like being ignored.
  useEffect(() => {
    if (!active || !gateSatisfied) return;
    const timer = setTimeout(() => advance(), 700);
    return () => clearTimeout(timer);
  }, [active, gateSatisfied, advance]);

  if (!active || beat === undefined) return null;

  return (
    <PersonaDialog
      beatKey={beat.id}
      lines={beat.lines}
      mood={beat.mood}
      stepIndex={stepIndex}
      totalSteps={TUTORIAL_BEATS.length}
      waitingFor={gate?.kind === 'select-asset' && !gateSatisfied ? beat.cta : undefined}
      cta={gate?.kind === 'next' ? beat.cta : undefined}
      onAdvance={advance}
      onSkip={complete}
    />
  );
}
