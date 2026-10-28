import { scalePitchClasses } from "@/studio/music";
import type { Chord } from "./chords";
import type { Plan } from "./plan";

export type PartNote = { pitch: number; startBeat: number; duration: number; velocity: number };

/** The bass sits in the second octave: C2 (36) to B2 (47). */
const lowest = 36;

/**
 * A bass line under the chords: each chord's root on beats 1 and 3. When the next bar changes chord, beat 4 steps
 * into it from the scale note next to its root, below when moving up and above when moving down.
 */
export function generateBass(plan: Plan, chords: Chord[]): PartNote[] {
  const inKey = scalePitchClasses(plan.key, plan.scale);
  const half = plan.beatsPerBar / 2;
  const notes: PartNote[] = [];

  chords.forEach((chord, i) => {
    const from = chord.bar * plan.beatsPerBar;
    const root = lowest + chord.root;
    const next = chords[i + 1];
    notes.push({ pitch: root, startBeat: from, duration: half, velocity: 100 });
    if (!next || next.root === chord.root) {
      notes.push({ pitch: root, startBeat: from + half, duration: half, velocity: 90 });
      return;
    }
    const target = lowest + next.root;
    notes.push({ pitch: root, startBeat: from + half, duration: half - 1, velocity: 90 });
    notes.push({ pitch: scaleNeighbour(target, target > root ? -1 : 1, inKey), startBeat: from + plan.beatsPerBar - 1, duration: 1, velocity: 80 });
  });
  return notes;
}

/** The nearest note of the key one way or the other from `pitch`. */
function scaleNeighbour(pitch: number, direction: -1 | 1, inKey: Set<number>): number {
  let p = pitch + direction;
  while (!inKey.has(((p % 12) + 12) % 12)) p += direction;
  return p;
}

