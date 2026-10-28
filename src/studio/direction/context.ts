import { instrumentOfPreset, type InstrumentId } from "@/instruments/instruments";
import { defaultStyle, type Style } from "@/studio/generate/style";
import type { MusicalKey, MusicalScale, Project, TrackRole } from "@/studio/types";

/** What Claude is told about the arrangement, so "slower" or "the hook" can be read against it. Never audio or lyrics. */
export type DescribeContext = {
  bpm: number;
  key: MusicalKey;
  scale: MusicalScale;
  style: Style;
  tracks: { id: string; name: string; role: TrackRole; kind: "hummed melody" | "hummed beat" | "generated" | "added by hand"; instrument?: InstrumentId }[];
};

/** The arrangement's settings and tracks, as Claude needs them to read a description. */
export function contextOf(project: Project): DescribeContext {
  return {
    bpm: project.bpm,
    key: project.key,
    scale: project.scale,
    style: project.style ?? defaultStyle,
    tracks: [...project.tracks]
      .sort((a, b) => a.order - b.order)
      .map((t) => ({
        id: t.id,
        name: t.name,
        role: t.color,
        kind: t.origin?.kind === "hum" ? (t.type === "drum" ? "hummed beat" : "hummed melody") : t.origin?.kind === "generated" ? "generated" : "added by hand",
        ...(instrumentOfPreset(t.instrumentPreset) && { instrument: instrumentOfPreset(t.instrumentPreset) }),
      })),
  };
}
