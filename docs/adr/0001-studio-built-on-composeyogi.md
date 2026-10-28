# 0001: Build the studio on ComposeYogi's core, copied into hum

Status: accepted (2026-10-28, M3 spike)

## Context

M3 sends a Sketch into a light studio, so hum needs a multi-track studio. That means a piano roll, a drum grid, playback and MIDI export, and it has to edit the melodies M2 transcribes. Project rules: reuse permissively licensed parts, and rule out AGPL and GPL. That's why openDAW and GridSound were rejected. The two candidates were ComposeYogi (MIT) and Signal (MIT). The spike is in [`docs/research/m3-studio-spike.md`](../research/m3-studio-spike.md).

## Decision

The studio is built on **ComposeYogi**. Its studio core is **copied into `src/studio/`** with its MIT notice, and hum owns it from then on. We don't depend on it as a package or run its app inside hum. The pieces copied are the types, the `lib/music` theory modules, the scheduler and playout, the zustand project and playback stores, the track list, the piano roll and the drum sequencer.

We leave out its app shell, i18n, PWA, MP3 export (LGPL `lamejs`), COOP/COEP headers and its own IndexedDB persistence. Arrangements are saved through the Sketch store, which stays the only code that touches IndexedDB.

Signal is not used as a base. We port the logic of its MIT `pianoroll-editor` operations (drag-to-move, quantize) into the copied piano roll, with attribution.

## Why

- ComposeYogi brings the whole studio, including a drum grid, which Signal lacks.
- It's the same stack as hum (Next, React 19, Tone 15, Tailwind).
- Its `Note` is hum's `Note` in beats. The only differences are an `id` and velocity on a 0–127 scale.

Signal has the better piano roll. But it comes as a Vite SPA built on Emotion, Jotai, WebGL, Firebase and soundfonts, and its time is in MIDI ticks. Getting it into hum's design system would mean rewriting its styles and shaders.

## Consequences

- hum maintains the copied code. Upstream ComposeYogi fixes become optional cherry-picks.
- The piano roll needs pointer and touch input and drag-to-move before it works on a phone.
- Melody tracks play through hum's smplr piano. Generated chords and bass use ComposeYogi's synth presets.
- Drums play through smplr's LM-2 drum machine rather than ComposeYogi's sample kits, whose WAV files carry no licence of their own (decided while building M3).
- In the end only the logic layer was copied (types, music theory, scheduler, playout, presets, export, stores). The track list, piano roll and drum grid were written fresh in hum's style, porting Signal's drag and quantize logic, because restyling ComposeYogi's components would have touched every line.
- Generators produce plain `Note[]` in beats, Tone-free, tested like `src/melody/cleanup.ts`.
