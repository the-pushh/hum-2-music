import { DRUM_PITCH } from "@/studio/music";
import type { PartNote } from "./bass";
import type { Plan } from "./plan";

const hit = 0.25;

/** A pop/rock beat: kick on 1 and 3, snare on 2 and 4, eighth note hats, and a crash on the very first downbeat. */
export function generateDrums(plan: Plan): PartNote[] {
  const notes: PartNote[] = [];
  for (let bar = 0; bar < plan.bars; bar++) {
    const from = bar * plan.beatsPerBar;
    if (bar === 0) notes.push({ pitch: DRUM_PITCH.crash, startBeat: 0, duration: hit, velocity: 100 });
    for (let beat = 0; beat < plan.beatsPerBar; beat++) {
      const at = from + beat;
      notes.push(
        beat % 2 === 0
          ? { pitch: DRUM_PITCH.kick, startBeat: at, duration: hit, velocity: 110 }
          : { pitch: DRUM_PITCH.snare, startBeat: at, duration: hit, velocity: 105 },
      );
      notes.push({ pitch: DRUM_PITCH.closedHat, startBeat: at, duration: hit, velocity: 85 });
      notes.push({ pitch: DRUM_PITCH.closedHat, startBeat: at + 0.5, duration: hit, velocity: 65 });
    }
  }
  return notes.sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
}
