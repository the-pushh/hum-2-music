"use client";

import { CacheStorage, DrumMachine } from "smplr";

export { drumSample } from "./drumKit";

export type Drums = ReturnType<typeof DrumMachine>;

/** hum's drum machine: smplr's LM-2, cached so it plays offline after its first load. */
export function createDrums(context: BaseAudioContext, destination?: AudioNode): Drums {
  return DrumMachine(context as AudioContext, { destination, instrument: "LM-2", storage: CacheStorage("hum-drums") });
}

