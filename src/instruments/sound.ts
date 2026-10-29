"use client";

import { CacheStorage, ElectricPiano, Soundfont, SplendidGrandPiano } from "smplr";
import { instruments, type InstrumentId } from "./instruments";

export { sampleVelocity } from "@/export/takeEvents";

/** What hum needs from any smplr instrument. */
export type Sound = {
  readonly ready: Promise<unknown>;
  /** Returns a function that cancels the note if it hasn't played yet, or stops it if it has. */
  start(event: { note: number | string; time?: number; duration?: number; velocity?: number }): () => void;
  stop(): void;
};

/** Melodies sit around middle C after cleanup; load that range and let the nearest sample cover the rest. */
const melodyRange = { notes: range(36, 96), velocityRange: [40, 110] as [number, number], fallback: "nearest" as const };

/**
 * A new smplr instrument for one of hum's instruments, playing into `destination` (the speakers if none). Samples are
 * kept in the Cache API, so each instrument plays offline after its first load.
 */
export function createSound(context: BaseAudioContext, id: InstrumentId, destination?: AudioNode): Sound {
  const sound = instruments[id].sound;
  const ctx = context as AudioContext;
  switch (sound.kind) {
    case "grand":
      return SplendidGrandPiano(ctx, { destination, storage: CacheStorage("hum-piano"), notesToLoad: melodyRange });
    case "electric":
      return ElectricPiano(ctx, { destination, instrument: sound.name, storage: CacheStorage("hum-instruments") });
    case "soundfont":
      return Soundfont(ctx, { destination, instrument: sound.name, kit: "FluidR3_GM", storage: CacheStorage("hum-instruments") });
  }
}


function range(from: number, to: number) {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}
