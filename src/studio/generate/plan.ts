import type { MusicalKey, MusicalScale, Project } from "@/studio/types";

/** The musical frame Generators write into: tempo, key, and how many bars of what time. */
export type Plan = {
  bpm: number;
  key: MusicalKey;
  scale: MusicalScale;
  beatsPerBar: number;
  bars: number;
};

/** A melody note in beats from the start of the arrangement. */
export type MelodyNote = { pitch: number; startBeat: number; duration: number };

/** Bars a Plan covers when there's no melody to measure. */
const emptyBars = 4;

/** Every note on the arrangement's melody tracks, in beats from the start. */
export function melodyOf(project: Project): MelodyNote[] {
  const beatsPerBar = project.timeSignature[0];
  const melodyTracks = new Set(project.tracks.filter((t) => t.color === "melody").map((t) => t.id));
  return project.clips
    .filter((c) => melodyTracks.has(c.trackId))
    .flatMap((c) =>
      (c.notes ?? []).map((n) => ({ pitch: n.pitch, startBeat: c.startBar * beatsPerBar + n.startBeat, duration: n.duration })),
    )
    .sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
}

/** The Plan for an arrangement: its tempo and key, over as many whole bars as its melody lasts. */
export function planFor(project: Project): Plan {
  const beatsPerBar = project.timeSignature[0];
  const end = Math.max(0, ...melodyOf(project).map((n) => n.startBeat + n.duration));
  return {
    bpm: project.bpm,
    key: project.key,
    scale: project.scale,
    beatsPerBar,
    bars: end > 0 ? Math.ceil(end / beatsPerBar - 1e-9) : emptyBars,
  };
}
