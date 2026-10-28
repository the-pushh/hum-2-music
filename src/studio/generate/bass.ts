import { scalePitchClasses } from "@/studio/music";
import type { Chord } from "./chords";
import { atEnergy } from "./energy";
import type { Plan } from "./plan";

export type PartNote = { pitch: number; startBeat: number; duration: number; velocity: number };

/** The bass sits in the second octave: C2 (36) to B2 (47). */
const lowest = 36;

/**
 * A bass line under the chords, in the Style's bass:
 * - roots: each chord's root on beats 1 and 3. When the next bar changes chord, beat 4 steps into it from the scale note
 *   next to its root, below when moving up and above when moving down.
 * - octaves: eighth notes alternating the root and the octave above.
 * - walking: root, third and fifth on beats 1 to 3, then the same step into the next root (or back to the third).
 * - none: no bass.
 * Softer or harder with the Style's energy.
 */
export function generateBass(plan: Plan, chords: Chord[]): PartNote[] {
  const { bass, energy } = plan.style;
  if (bass === "none") return [];
  const inKey = scalePitchClasses(plan.key, plan.scale);
  const notes: PartNote[] = [];
  const play = (pitch: number, startBeat: number, duration: number, velocity: number) =>
    notes.push({ pitch, startBeat, duration, velocity: atEnergy(velocity, energy) });

  chords.forEach((chord, i) => {
    const from = chord.bar * plan.beatsPerBar;
    const root = lowest + chord.root;
    const next = chords[i + 1];
    const stepInto = next && next.root !== chord.root ? stepToward(lowest + next.root, root, inKey) : undefined;

    if (bass === "octaves") {
      for (let at = 0; at < plan.beatsPerBar; at += 0.5) play(at % 1 ? root + 12 : root, from + at, 0.5, at % 1 ? 80 : 95);
      return;
    }
    if (bass === "walking") {
      const third = root + (chord.pitches[1] - chord.pitches[0]);
      const fifth = root + (chord.pitches[2] - chord.pitches[0]);
      [root, third, fifth].forEach((pitch, beat) => play(pitch, from + beat, 1, beat ? 85 : 100));
      play(stepInto ?? third, from + 3, 1, 80);
      return;
    }
    const half = plan.beatsPerBar / 2;
    play(root, from, half, 100);
    if (stepInto === undefined) {
      play(root, from + half, half, 90);
      return;
    }
    play(root, from + half, half - 1, 90);
    play(stepInto, from + plan.beatsPerBar - 1, 1, 80);
  });
  return notes;
}

/** The scale note next to `target`, on the side `from` is coming from: below when moving up, above when moving down. */
function stepToward(target: number, from: number, inKey: Set<number>): number {
  return scaleNeighbour(target, target > from ? -1 : 1, inKey);
}

/** The nearest note of the key one way or the other from `pitch`. */
function scaleNeighbour(pitch: number, direction: -1 | 1, inKey: Set<number>): number {
  let p = pitch + direction;
  while (!inKey.has(((p % 12) + 12) % 12)) p += direction;
  return p;
}
