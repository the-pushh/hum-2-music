"use client";

import { CacheStorage, ElectricPiano, Soundfont, SplendidGrandPiano } from "smplr";
import { instruments, type InstrumentId } from "./instruments";

/** What hum needs from any smplr instrument. */
export type Sound = {
  readonly ready: Promise<unknown>;
  start(event: { note: number; time?: number; duration?: number; velocity?: number }): unknown;
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

/** hum's 0–1 velocity on the 40–110 range the samples were picked for, so a hum sounds the same on the card and in the studio. */
export function sampleVelocity(velocity: number): number {
  return Math.round(40 + velocity * 70);
}

function range(from: number, to: number) {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}
