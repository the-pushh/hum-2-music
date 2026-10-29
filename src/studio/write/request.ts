import type { MelodyNote, Plan } from "@/studio/generate/plan";
import { melodyOf, planFor } from "@/studio/generate/plan";
import type { Project } from "@/studio/types";
import type { WrittenPart } from "./tidy";

/** What Claude is given to write parts: the song's frame, its melody and beat as notes, and the songwriter's note. */
export type WriteRequest = {
  plan: Plan;
  melody: MelodyNote[];
  /** A hummed beat's hits, so the bass can lock to the kick. Empty without one. */
  beat: { pitch: number; startBeat: number }[];
  parts: WrittenPart[];
  /** Up to 300 characters, or empty. */
  note: string;
};

/**
 * What to ask Claude for: chords and bass when there's a melody, drums unless a hummed beat is the drums, and never a
 * part the Style sets to none. Only notes leave the arrangement, never audio or lyrics.
 */
export function writeRequestOf(project: Project, note: string): WriteRequest {
  const plan = planFor(project);
  const melody = melodyOf(project);
  const beatTracks = new Set(project.tracks.filter((t) => t.origin?.kind === "hum" && t.type === "drum").map((t) => t.id));
  const beat = project.clips
    .filter((c) => beatTracks.has(c.trackId))
    .flatMap((c) => (c.notes ?? []).map((n) => ({ pitch: n.pitch, startBeat: c.startBar * plan.beatsPerBar + n.startBeat })))
    .sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);

  const parts: WrittenPart[] = [];
  if (melody.length && plan.style.chords !== "none") parts.push("chords");
  if (melody.length && plan.style.bass !== "none") parts.push("bass");
  if (!beatTracks.size && plan.style.drums !== "none") parts.push("drums");
  return { plan, melody, beat, parts, note: note.trim().slice(0, 300) };
}
