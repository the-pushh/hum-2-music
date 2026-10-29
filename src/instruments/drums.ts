"use client";

import { CacheStorage, DrumMachine } from "smplr";
import type { SoundOptions } from "./sound";

export { drumSample } from "./drumKit";

export type Drums = ReturnType<typeof DrumMachine>;

/** hum's drum machine: smplr's LM-2, cached so it plays offline after its first load. */
export function createDrums(context: BaseAudioContext, { destination, scheduler }: SoundOptions = {}): Drums {
  return DrumMachine(context as AudioContext, { destination, scheduler, instrument: "LM-2", storage: CacheStorage("hum-drums") });
}

