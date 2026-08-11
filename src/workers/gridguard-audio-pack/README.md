# GridGuard Audio Pack (synthesized, placeholder-grade)

These files are procedurally generated (not sourced from any external library), so there's
zero licensing risk to ship them as-is in a competition submission.

## Install

Drop the `audio/` folder into `public/` so paths resolve as `public/audio/sfx/*.mp3` and
`public/audio/music/*.mp3` — this matches the paths already in `manifest.json`, which is
written to match the asset-manifest pattern from the audio-engine spec (`src/audio/manifest.ts`).
If your project already has an `audio-engine.ts` manifest, just merge these entries in rather
than replacing it.

## SFX (11 files, one-shot, mono, faded 3ms at both edges to avoid clicks)

| file                  | tuned for                                             |
| --------------------- | ----------------------------------------------------- |
| ui-click.mp3          | generic hover/confirm click                           |
| action-commit.mp3     | operator action executed                              |
| action-error.mp3      | invalid action / error buzzer                         |
| breaker-trip.mp3      | protection trip — heavy mechanical clunk              |
| blackout.mp3          | zone goes dark — descending sweep + power-down whoosh |
| generator-lost.mp3    | generator lost — spin-down motor with stutter         |
| stress-escalation.mp3 | corridor stress crosses a band — two-beep alert       |
| shift-start.mp3       | mission start — soft ascending swell                  |
| shift-end.mp3         | mission end — descending resolving chime              |
| tour-step.mp3         | tutorial/tour step advance — tiny tick                |
| rating-reveal.mp3     | after-action rating reveal — small fanfare            |

## Music (3 files, 16-second seamless loops, mono)

`calm.mp3`, `tense.mp3`, `critical.mp3` — each built from sine partials whose frequencies are
exact multiples of 1/16s, so the waveform is phase-continuous at the loop point (no click,
no fade needed to hide a seam). Loudness and harmonic density step up from calm → tense →
critical (tense adds a tritone + faster pulse, critical adds mild distortion + a fast
heartbeat-style pulse) so the crossfade between them reads as escalating tension rather than
just "louder."

## This is placeholder-grade, on purpose

Synthesized tones get the audio-reactive system fully testable end-to-end today. For final
submission polish, swap `music/*.mp3` for real composed/recorded stems and the higher-detail
SFX packs suggested earlier (Kenney UI/Interface/Impact/Sci-Fi packs) — the manifest means
that's a file swap, not a code change, as long as the new files keep the same names or you
update `manifest.json` to point at them.
