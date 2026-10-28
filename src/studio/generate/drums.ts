import { DRUM_PITCH } from "@/studio/music";
import type { PartNote } from "./bass";
import { atEnergy } from "./energy";
import type { Plan } from "./plan";
import type { Style } from "./style";

const hit = 0.25;

type Hit = { drum: "kick" | "snare" | "closedHat" | "openHat"; at: number; velocity: number };

/** One bar of 4/4 in each feel, as hits by beat. Bars of other lengths repeat the pattern's beats that fit. */
const feels: Record<Exclude<Style["drums"], "none">, Hit[]> = {
  // Kick on 1 and 3, snare on 2 and 4, eighth note hats.
  "pop-rock": [
    ...[0, 2].map((at) => ({ drum: "kick" as const, at, velocity: 110 })),
    ...[1, 3].map((at) => ({ drum: "snare" as const, at, velocity: 105 })),
    ...eighthHats(),
  ],
  // A kick on every beat, snare on 2 and 4, open hats on the offbeats.
  "four-on-the-floor": [
    ...[0, 1, 2, 3].map((at) => ({ drum: "kick" as const, at, velocity: 110 })),
    ...[1, 3].map((at) => ({ drum: "snare" as const, at, velocity: 100 })),
    ...[0.5, 1.5, 2.5, 3.5].map((at) => ({ drum: "openHat" as const, at, velocity: 75 })),
  ],
  // Kick on 1, the snare only on 3, so the bar feels twice as long.
  "half-time": [{ drum: "kick", at: 0, velocity: 110 }, { drum: "snare", at: 2, velocity: 105 }, ...eighthHats()],
  // Kick on 1, the and of 2 and the and of 3; snare on 2 and 4.
  "boom-bap": [
    ...[0, 1.5, 2.5].map((at) => ({ drum: "kick" as const, at, velocity: at ? 95 : 110 })),
    ...[1, 3].map((at) => ({ drum: "snare" as const, at, velocity: 110 })),
    ...eighthHats(),
  ],
};

function eighthHats(): Hit[] {
  return [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((at) => ({ drum: "closedHat", at, velocity: at % 1 ? 65 : 85 }));
}

/** Energy thins the closed hats to quarters (low) or fills them out to sixteenths (high). */
function hatsAtEnergy(pattern: Hit[], energy: Style["energy"]): Hit[] {
  if (energy === "medium") return pattern;
  const hats = pattern.filter((h) => h.drum === "closedHat");
  if (!hats.length) return pattern;
  const others = pattern.filter((h) => h.drum !== "closedHat");
  if (energy === "low") return [...others, ...hats.filter((h) => h.at % 1 === 0)];
  const sixteenths = [0, 1, 2, 3].flatMap((beat) => [0, 0.25, 0.5, 0.75].map((off) => beat + off));
  return [...others, ...sixteenths.map((at) => ({ drum: "closedHat" as const, at, velocity: at % 1 ? (at % 0.5 ? 55 : 65) : 85 }))];
}

/**
 * A drum part in the Plan's feel, with a crash on the very first downbeat. Energy sets how busy the hats are and how
 * hard it all hits. "none" is no drums at all.
 */
export function generateDrums(plan: Plan): PartNote[] {
  if (plan.style.drums === "none") return [];
  const { energy } = plan.style;
  const pattern = hatsAtEnergy(feels[plan.style.drums], energy).filter((h) => h.at < plan.beatsPerBar);
  const notes: PartNote[] = [];
  for (let bar = 0; bar < plan.bars; bar++) {
    const from = bar * plan.beatsPerBar;
    if (bar === 0) notes.push({ pitch: DRUM_PITCH.crash, startBeat: 0, duration: hit, velocity: atEnergy(100, energy) });
    for (const h of pattern) notes.push({ pitch: DRUM_PITCH[h.drum], startBeat: from + h.at, duration: hit, velocity: atEnergy(h.velocity, energy) });
  }
  return notes.sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
}
