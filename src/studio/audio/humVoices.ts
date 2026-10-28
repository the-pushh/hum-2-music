"use client";

import * as Tone from "tone";
import { CacheStorage, SplendidGrandPiano } from "smplr";
import { createDrums, drumSample, type Drums } from "@/instruments/drums";
import type { Track } from "@/studio/types";

/**
 * hum's sampled instruments in the studio: the smplr grand piano the voice card plays, and an LM-2 drum machine
 * (also smplr). The scheduler drives them like a Tone synth, so mute, solo, volume and macros work as for any track.
 */
export const humPresets = { piano: "hum-piano", drums: "hum-drums" } as const;
export type HumPresetId = (typeof humPresets)[keyof typeof humPresets];

export const isHumPreset = (id: string | undefined): id is HumPresetId => id === humPresets.piano || id === humPresets.drums;

type Sampled = ReturnType<typeof SplendidGrandPiano> | Drums;

/**
 * One track's sampled instrument behind a Tone node. Voices are kept per track and reused across reschedules,
 * since loading samples takes seconds and the scheduler builds a new voice for every clip it schedules.
 */
export class HumVoice {
  readonly output: Tone.Gain;
  readonly ready: Promise<void>;
  private readonly instrument: Sampled;

  constructor(
    private readonly kind: HumPresetId,
  ) {
    this.output = new Tone.Gain(1);
    const context = Tone.getContext().rawContext as AudioContext;
    const destination = this.output.input as unknown as AudioNode;
    this.instrument =
      kind === humPresets.piano
        ? SplendidGrandPiano(context, {
            destination,
            storage: CacheStorage("hum-piano"),
            notesToLoad: { notes: range(36, 96), velocityRange: [40, 110], fallback: "nearest" },
          })
        : createDrums(context, destination);
    this.ready = this.instrument.ready.then(() => undefined);
  }

  /** Same shape as a Tone synth's, so the scheduler can call it. `time` is on the shared AudioContext's clock. */
  triggerAttackRelease(frequency: number, duration: number, time: number, velocity = 1) {
    const pitch = Math.round(Tone.Frequency(frequency).toMidi());
    if (this.kind === humPresets.piano) {
      // The voice card's mapping, so a hum sounds the same in both places.
      this.instrument.start({ note: pitch, time, duration, velocity: Math.round(40 + velocity * 70) });
    } else {
      const sample = drumSample(pitch);
      if (sample) this.instrument.start({ note: sample, time, velocity: Math.round(velocity * 127) });
    }
  }

  triggerRelease() {
    this.instrument.stop();
  }

  /** Voices outlive the clips that use them, so a clip's teardown leaves them alone. */
  dispose() {}
}

const voices = new Map<string, HumVoice>();

/** The track's sampled voice, made the first time it's asked for. */
export function humVoiceFor(track: Track, kind: HumPresetId): HumVoice {
  const key = `${track.id}|${kind}`;
  let voice = voices.get(key);
  if (!voice) {
    voice = new HumVoice(kind);
    voices.set(key, voice);
  }
  return voice;
}

function range(from: number, to: number) {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}
