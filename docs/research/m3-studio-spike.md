# M3 studio spike: ComposeYogi or Signal

Date: 2026-10-28. This is a spike for M3 step 1. It makes a recommendation and changes no product code.

**Pick: ComposeYogi.** We copy its studio core into hum (`src/studio/`) rather than running the whole ComposeYogi app inside hum. Signal is not the base. We use its MIT `pianoroll-editor` package as a reference for the note-editing operations ComposeYogi lacks.

The decision is recorded in [ADR 0001](../adr/0001-studio-built-on-composeyogi.md).

## What was looked at

| | ComposeYogi | Signal |
|---|---|---|
| Repo | https://github.com/AppsYogi-com/ComposeYogi | https://github.com/ryohey/signal |
| Commit read | `13fe2f61` (2026-10-13) | `dc5e0313` (2026-10-20) |

Both were cloned into a scratch folder outside the repo. The source was read, the lockfile was scanned, and licences were checked against the npm registry.

**Not verified: whether they build today.** Running `npm ci` / `next build` on the clones was blocked in this session, because the permission policy treats running external code as off-limits. So "builds today" below is based on lockfiles, CI config and recent commit activity, not on a local build. To check by hand:

```bash
cd <scratch>/composeyogi && npm ci && npm run check && npx next build
```

Paths below are relative to each repo's root at the commit above.

## Comparison

| Criterion | ComposeYogi | Signal |
|---|---|---|
| **1. Licence** | MIT (`LICENSE`, `package.json`). The lockfile has 646 packages and none are GPL or AGPL. The only LGPL ones are `@img/sharp-libvips-*`, which comes with Next itself and is already in hum, and `lamejs` (LGPL-3.0, MP3 export). hum can drop `lamejs`. | MIT (`LICENSE`, root and `app/package.json`). Workspace packages such as `core` and `pianoroll-editor` have no `license` field of their own, but the root MIT licence covers them. Third-party deps: `spessasynth_core`/`_lib` (Apache-2.0), `firebase`/`firebaseui` (Apache-2.0), `mdi-react` (MIT AND OFL-1.1), `@breezystack/lamejs` (LGPL-3.0). Nothing is GPL or AGPL. The default `A320U.sf2` soundfont has no licence stated in the repo. |
| **2. Activity / builds** | Young: first commit 2026-01-11, 101 commits, 54 of them in the last 3 months. v1.4.0 shipped 2026-08-31 (`CHANGELOG.md`). One org, 152 stars. It pins **Next 15** (`^15.1.0`), React 19 and Tailwind 3, and it has 23 Vitest suites. Local build not checked (see above). | Mature: about 10 years old, 3,754 commits, 82 in the last 3 months, 2.4k stars. It's a Vite 7 SPA plus Electron, with pnpm and turbo, React 19.2 and TS 6. It requires Node `>=24 <25`. Local build not checked. |
| **3. Piano roll** | `components/compose/editors/PianoRoll.tsx` (550 lines, DOM). You can **draw** (click), **resize** (right-edge handle), **delete** (double-click or Delete), select and shift-select, and edit velocity in a lane (`VelocityLane.tsx`). It snaps to the grid and highlights the scale. **It can't move notes by dragging**, and it has no copy/paste, quantize or transpose. It is **mouse-only**: `onMouseDown`/`mousemove`, with no pointer or touch events. | `app/src/features/piano-roll/` (about 6.5k lines, WebGL via `@ryohey/webgl-react`) on top of `packages/pianoroll-editor` (`createPianoRollEditor`). It has draw, move (`dragNote`), resize, delete, quantize, transpose, duplicate, copy/paste and area select. It's the stronger editor. Input is also mouse-gesture based (`app/src/gesture/MouseGesture.ts`). |
| **4. Drum grid** | **Yes.** `components/compose/editors/DrumSequencer.tsx` is a step grid with per-step velocity and preset patterns. Drum clips hold notes at GM pitches (`lib/music/percussion.ts`). It has six sampler kits (`lib/audio/drum-kits.ts`). | **No.** Drums are piano-roll notes on channel 10, drawn with a drum shader (`canvas/shaders/DrumNoteShader.ts`). There is no step grid. |
| **5. MIDI** | **Export:** `exportProjectToMidi` in `lib/audio/export.ts` (`@tonejs/midi`), offered in `ExportModal.tsx`. **Import:** `importMidiFile` in `lib/audio/project-io.ts`, which groups notes into clips and maps channel 10 to drum tracks. | Its whole model *is* MIDI events (`midifile-ts`). Import and export live in `packages/core/src/midi/midiConversion.ts` and `app/src/features/export`. |
| **6a. Runs in hum's Next 16 / React 19** | Same family: Next App Router, React 19, Tone 15 (hum has `tone ^15.1.22`), zustand. Its studio is a client page (`app/[locale]/compose/page.tsx`). What doesn't carry over: Next 15 conventions, `next-intl` (37 files call `useTranslations`), `[locale]` routing plus `middleware.ts`, the serwist PWA, COOP/COEP headers in `next.config.ts` (COEP would break hum's YouTube/Spotify embeds, so don't copy it) and `lamejs` loaded with a `<script>` tag. The fix is to copy the core modules, not the app. | It's a Vite SPA with its own entry (`app/src/index.tsx`), a Jotai app state, an Emotion theme, Firebase auth and a service worker. Putting it in Next means extracting `packages/core`, `pianoroll-editor`, `player` and the `features/piano-roll` UI, and rebuilding the Jotai providers and Emotion theme they assume. |
| **6b. Restyle with hum's tokens** | Moderate. It's Tailwind already, but v3 with its own generated token system (`lib/design/tokens.ts` → `app/globals.css`), shadcn/Radix (22 `components/ui` files), **lucide** icons (31 files) and **207 arbitrary-value classes**. Class names like `bg-accent` map almost directly onto hum's tokens (`--color-accent`, `--color-surface`, `--color-line`…). Its track-role colours (`drums, bass, keys, melody, vocals, fx`) would need hum tokens added. | Hard. Styling is Emotion `styled` (97 files) plus WebGL shaders that read colours from the Emotion theme. Getting to "Tailwind tokens only" means rewriting every component's styles and feeding hum's tokens into the shaders. Icons are `mdi-react`. |
| **7a. hum melody → model** | **Almost 1:1.** ComposeYogi's `Note` is `{id, pitch, startBeat, duration, velocity}` in beats from clip start, with velocity 0–127 (`types/index.ts`). hum's `Note` is `{pitch, start, duration, velocity}` in beats, with velocity 0–1. The mapping adds `id`, renames `start`→`startBeat` and scales velocity by 127. One voice Idea becomes one `midi` Track plus one Clip at bar 0. `Take.bpm` becomes `Project.bpm`, and hum's `Key {tonic, mode}` becomes `Project.key`/`scale`. Proven in the prototype below. | Ticks, not beats: `tick = beats × song.timebase` (480 by default, `midiConversion.ts`). Notes are `{tick, duration, noteNumber, velocity}` through `PianoRollEditor`. Tracks are MIDI tracks with channel and program events. Doable, but every hum↔studio crossing converts units, and hum's later generators would have to speak ticks or convert too. |
| **7b. Track / Plan / Generator** | **Track** (hum's later concept) maps to a ComposeYogi `Track` and its `Clip`s, with `type` `midi` or `drum` and role colours for chords, bass and drums. **Generator** fits as a pure function `(plan) → {track, clips}`. Its output is plain `Note[]` in beats, the same as hum's own `Note`, so a generator stays testable without Tone. ComposeYogi already works this way: `lib/music/*` and `instrument-spec.ts` import no Tone (see `ARCHITECTURE.md` § Testing). **Plan** covers the project-level `bpm`, `key`, `scale` and `timeSignature`, plus what ComposeYogi lacks: sections and bar counts. Those live on hum's Plan, and generators read them. The drum generator writes GM-pitch notes into a `drum` clip, which the step grid then edits. | Track maps onto Signal's `Track`, which is an event store. A generator would write MIDI events (`addEvent`), or notes through a `createPianoRollEditor` per track. Plan has nowhere to live in Signal's song model beyond tempo and time-signature events. |
| **8. "Open in studio" glue** | Small. The mapping is about 40 lines (prototype), plus a record in the Sketch store to keep the arrangement, a route, and an adapter that replaces ComposeYogi's `lib/persistence` (its own `composeyogi` IndexedDB via `idb`). hum allows only the Sketch store to touch IndexedDB, so this adapter is required. About 1 day of glue after the core is copied in. The copy and restyle are about 4–6 days. | Large. Extracting and re-hosting the piano roll is about 1–2 weeks. Then we'd still have to build a track list, drum grid, scheduler on Tone or smplr (Signal plays through spessasynth soundfonts) and transport. About 2–3 weeks before "Open in studio" is useful. |

## Prototype

The prototype is a throwaway script, `sketchToProject.ts`. It isn't in the repo. A copy is in the session group's shared notes folder, under `m3-studio-spike/`. It imports hum's real `src/melody/types.ts` and ComposeYogi's real `types/index.ts` and type-checks them under `strict` with hum's own `tsc`. It then maps a cleaned "Twinkle Twinkle" melody into:

- a ComposeYogi `Project` with one `midi` track on the `grand-piano` preset and a 2-bar clip. The notes come out as `{pitch 60, startBeat 0, duration 1, velocity 89}` and so on.
- Signal's note shape: `{tick 0, duration 480, noteNumber 60, velocity 89}` and so on.

The only conversion ComposeYogi needs is velocity ×127. Signal needs beats ×480 everywhere.

## Why ComposeYogi

1. **It has the whole studio.** It comes with a track list, piano roll, drum step grid, transport, mixer, Tone scheduler and MIDI export and import. Signal brings a better piano roll and nothing else hum needs (no drum grid, no Tone).
2. **It uses the same stack and units.** Next, React 19, Tone 15, Tailwind, beats in state. hum's `Note` drops in with a rename. Signal would bring Vite, Emotion, Jotai, WebGL, Firebase, soundfonts and ticks.
3. **Restyling is realistic.** It's Tailwind already. Swapping its tokens for hum's and lucide for Phosphor is mechanical. Re-theming Signal means rewriting its Emotion styles and shaders.
4. **Generators fit its testing pattern.** ComposeYogi keeps musical decisions in Tone-free modules (`lib/music/`, `scheduler.ts`'s `buildRenderPlan`, golden snapshots). That matches how hum tests cleanup, so the M3 generators can follow the same pattern.

## Risks

- **Bus factor and youth.** It's one org, about 10 months old and 152 stars. *Mitigation:* we copy the code into hum and own it, so we don't depend on upstream. Upstream fixes become optional cherry-picks.
- **The piano roll can't move notes and can't be used on a phone.** It's mouse-only, with no drag-to-move. hum is phone-first. *Mitigation:* a ticket rewrites its handlers as pointer events and adds move. We port the logic of Signal's `packages/pianoroll-editor` `dragNote` and `quantizeNotes` (MIT, with attribution).
- **Its sound is unproven by ear.** `ARCHITECTURE.md` says "No audio in the app has been assessed by ear", and it has no sampled piano. *Mitigation:* melody tracks use hum's smplr piano, the instrument M2 already ships. ComposeYogi synths and kits are used for chords, bass and drums, and checked by ear on the phone pass.
- **Version gap.** ComposeYogi is Next 15 and Tailwind 3. hum is Next 16 (Cache Components) and Tailwind 4. *Mitigation:* copy only `'use client'` modules, which are framework-agnostic, and leave its app shell, i18n, middleware and PWA behind. The studio route renders a client island, which fits Cache Components.
- **Its own IndexedDB.** `lib/persistence` (`composeyogi` DB) and its callers (`useAutosave`, `ProjectSelector`, `Transport`, `recording-manager`, `custom-instruments`, `sample-*`, `shortcuts`) would break hum's rule that only the Sketch store touches IndexedDB. *Mitigation:* don't copy `lib/persistence`. Arrangement saves go through a new Sketch store method, and features that need their own storage (audio recording, user samples, custom instruments) are cut for M3.
- **Hand-maintained `Project` field lists.** `schedule-hash.ts`, `ProjectRecord` and the autosave signature (`ARCHITECTURE.md` § Known rough edges) fail silently if a new field is missed. *Mitigation:* copy their exhaustiveness tests along with them.
- **Builds-today unverified.** See above. The first copy-in ticket starts by building the upstream clone once to get a known-good baseline.
- **Licence housekeeping.** Copied files keep ComposeYogi's MIT notice, in a `src/studio/LICENSE-ComposeYogi` file and as header attribution. Don't bring `lamejs` (LGPL), which means no MP3 export. Ported Signal logic gets the same treatment.

## Outline of the M3 tickets for the pick

These are rough. They become GitHub issues when the user asks. Vertical slices, tracer first:

1. **Tracer: open a Sketch in the studio.** Copy in ComposeYogi's `types`, `lib/music/*`, `lib/audio/scheduler.ts`, `playout.ts` and `synth-presets.ts`, and `lib/store/project.ts` plus `playback.ts` (zustand + zundo), with the licence notice. Add `/sketches/[id]/studio`, where a client island builds a `Project` from the Sketch's transcribed voice Ideas (the prototype mapping, using `clean` or `raw` per `showRaw`) and plays it. Unstyled is fine.
2. **Save the arrangement in the Sketch store.** Add an arrangement record per Sketch (Dexie version bump). Reopening the studio restores edits. A new transcription offers to refresh its track. Tested through the store's public interface with fake-indexeddb.
3. **Track list and transport in hum's style.** Restyle the track list, transport and mixer with hum tokens and Phosphor. No arbitrary values. Add track-role tokens to `globals.css`.
4. **Piano roll that works on a phone.** Restyle it, switch to pointer events, and add drag-to-move. Port the drag and quantize logic from Signal's `pianoroll-editor`, with attribution. Keep draw, resize, delete and velocity.
5. **Melody tracks play as hum's piano.** Bridge smplr into the scheduler as an instrument, so the studio sounds like the voice card.
6. **Drum grid.** Restyle the step sequencer for `drum` tracks with one kit.
7. **Export `.mid`.** `exportProjectToMidi` behind a studio button. Importing a `.mid` as a new track is optional, a stretch goal.
8. **Phone pass.** Open a hummed Sketch on a real phone, edit a note, add a drum pattern, and export.

After that, M3 step 3 (separate spec): define `Plan`, `Track` and `Generator` in `GLOSSARY.md`, then add chord, bass and pop/rock drum generators as pure functions `Plan → {track, clips}` with golden tests.

## Glossary note

The task brief points at `GLOSSARY.md` for `Track`, `Plan` and `Generator`, but **no `GLOSSARY.md` exists yet** on `main` or `m2/melody`. This spike uses the working meanings from the M3 plan: generators turn a Plan into tracks. Pin the terms down with `/domain-modeling` when the generator spec is written.
