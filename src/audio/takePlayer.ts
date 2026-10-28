"use client";

import { createDrums, drumSample } from "@/instruments/drums";
import type { InstrumentId } from "@/instruments/instruments";
import { createSound, sampleVelocity, type Sound } from "@/instruments/sound";
import type { Note } from "@/melody/types";
import { audioContext } from "./context";

const loaded = new Map<InstrumentId | "drums", Promise<Sound>>();

/** Loads an instrument once per page. A failed load is forgotten, so the next play tries again. */
function load(id: InstrumentId | "drums"): Promise<Sound> {
  let sound = loaded.get(id);
  if (!sound) {
    sound = audioContext()
      .then(async (ctx) => {
        const s = id === "drums" ? createDrums(ctx) : createSound(ctx, id);
        await s.ready;
        return s;
      })
      .catch((err) => {
        loaded.delete(id);
        throw err;
      });
    loaded.set(id, sound);
  }
  return sound;
}

export type Playback = { pause: () => void };

/** Plays a melody on one of hum's instruments. `onEnded` runs when it finishes or is paused. */
export async function playMelody(notes: Note[], bpm: number, instrument: InstrumentId, onEnded: () => void): Promise<Playback> {
  return play(await load(instrument), notes, bpm, onEnded, (n) => ({ note: n.pitch, velocity: sampleVelocity(n.velocity) }));
}

/** Plays a beat's hits on the drum machine. `onEnded` runs when it finishes or is paused. */
export async function playBeat(hits: Note[], bpm: number, onEnded: () => void): Promise<Playback> {
  return play(await load("drums"), hits, bpm, onEnded, (n) => {
    const sample = drumSample(n.pitch);
    return sample ? { note: sample, velocity: Math.max(1, Math.round(n.velocity * 127)) } : null;
  });
}

async function play(
  sound: Sound,
  notes: Note[],
  bpm: number,
  onEnded: () => void,
  voice: (n: Note) => { note: number | string; velocity: number } | null,
): Promise<Playback> {
  const ctx = await audioContext();
  const secPerBeat = 60 / bpm;
  const at = ctx.currentTime + 0.05;
  for (const n of notes) {
    const v = voice(n);
    if (v) sound.start({ ...v, time: at + n.start * secPerBeat, duration: n.duration * secPerBeat });
  }
  const length = Math.max(0, ...notes.map((n) => n.start + n.duration)) * secPerBeat;
  let ended = false;
  const end = () => {
    if (ended) return;
    ended = true;
    clearTimeout(timer);
    onEnded();
  };
  const timer = setTimeout(end, (length + 0.3) * 1000);
  return {
    pause() {
      sound.stop();
      end();
    },
  };
}
