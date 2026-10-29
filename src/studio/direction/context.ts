import type { InstrumentId } from "@/instruments/instruments";
import type { Style } from "@/studio/generate/style";
import type { MusicalKey, MusicalScale, TrackRole } from "@/studio/types";

/** What Claude is told about a hum when picking its instrument from the songwriter's words. Never audio or lyrics. */
export type DescribeContext = {
  bpm: number;
  key: MusicalKey;
  scale: MusicalScale;
  style: Style;
  tracks: { id: string; name: string; role: TrackRole; kind: "hummed melody" | "hummed beat" | "generated" | "added by hand"; instrument?: InstrumentId }[];
};
