import { drumSample } from "@/instruments/drumKit";
import type { PartNote } from "@/studio/generate/bass";
import type { Plan } from "@/studio/generate/plan";

export type WrittenPart = "chords" | "bass" | "drums";

/** Notes as Claude wrote them: shaped like PartNotes, but not yet checked against the song. */
export type RawNote = { pitch: number; startBeat: number; duration: number; velocity: number };
export type RawParts = Partial<Record<WrittenPart, RawNote[]>>;
export type TidyParts = Partial<Record<WrittenPart, PartNote[]>>;

/** Sixteenth notes, the finest grid the studio edits on. */
const step = 0.25;
/** The most notes one part can bring in: sixteenth hats over 32 bars, with room for kicks and snares. */
export const maxNotesPerPart = 400;
/** Where each pitched part sits, as MIDI pitches: bass E1–G3, chords C3–G5. Notes outside move by octaves. */
const ranges = { bass: [28, 55], chords: [48, 79] } as const;

/**
 * Claude's parts made playable in hum: starts and lengths on sixteenths, every note inside the song, bass and chords
 * moved into their ranges by octaves, drums the kit can't play dropped, velocity kept to MIDI's 1–127, duplicates
 * collapsed, and no part longer than `maxNotesPerPart`. Pitches are never moved into the key: passing notes stay.
 * A part left with no notes counts as not written; with nothing written at all, there's nothing to use.
 */
export function tidyParts(plan: Plan, parts: RawParts): TidyParts | null {
  const end = plan.bars * plan.beatsPerBar;
  const tidy: TidyParts = {};
  for (const part of ["chords", "bass", "drums"] as const) {
    const notes = tidyPart(part, parts[part] ?? [], end);
    if (notes.length) tidy[part] = notes;
  }
  return Object.keys(tidy).length ? tidy : null;
}

function tidyPart(part: WrittenPart, notes: RawNote[], end: number): PartNote[] {
  const seen = new Set<string>();
  const tidy: PartNote[] = [];
  for (const raw of notes) {
    if (![raw.pitch, raw.startBeat, raw.duration, raw.velocity].every(Number.isFinite)) continue;
    if (raw.pitch < 0 || raw.pitch > 127 || raw.startBeat < 0 || raw.duration <= 0) continue;
    const startBeat = snap(raw.startBeat);
    if (startBeat >= end) continue;
    const pitch = part === "drums" ? Math.round(raw.pitch) : intoRange(Math.round(raw.pitch), ranges[part]);
    if (part === "drums" && !drumSample(pitch)) continue;
    const key = `${pitch}@${startBeat}`;
    if (seen.has(key)) continue;
    seen.add(key);
    tidy.push({
      pitch,
      startBeat,
      duration: Math.min(Math.max(step, snap(raw.duration)), end - startBeat),
      velocity: Math.min(127, Math.max(1, Math.round(raw.velocity))),
    });
  }
  return tidy.sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch).slice(0, maxNotesPerPart);
}

function snap(beats: number): number {
  return Math.round(beats / step) * step;
}

function intoRange(pitch: number, [low, high]: readonly [number, number]): number {
  let p = pitch;
  while (p > high) p -= 12;
  while (p < low) p += 12;
  return p;
}
