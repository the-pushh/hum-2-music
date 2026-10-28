import type { TrackRole } from "@/studio/types";

/** Full class names, so Tailwind sees each one. */
export const roleBg: Record<TrackRole, string> = {
  melody: "bg-melody",
  keys: "bg-keys",
  bass: "bg-bass",
  drums: "bg-drums",
  vocals: "bg-vocals",
  fx: "bg-fx",
};

export const roleFill: Record<TrackRole, string> = {
  melody: "fill-melody",
  keys: "fill-keys",
  bass: "fill-bass",
  drums: "fill-drums",
  vocals: "fill-vocals",
  fx: "fill-fx",
};
