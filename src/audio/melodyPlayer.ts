"use client";

import type { InstrumentId } from "@/instruments/instruments";
import { createSound, sampleVelocity, type Sound } from "@/instruments/sound";
import type { Note } from "@/melody/types";
import { audioContext } from "./context";

const loaded = new Map<InstrumentId, Promise<Sound>>();

/** Loads an instrument once per page. A failed load is forgotten, so the next play tries again. */
function load(id: InstrumentId): Promise<Sound> {
  let sound = loaded.get(id);
  if (!sound) {
    sound = audioContext()
      .then(async (ctx) => {
        const s = createSound(ctx, id);
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
  const s = await load(instrument);
  const ctx = await audioContext();
  const secPerBeat = 60 / bpm;
  const at = ctx.currentTime + 0.05;
  for (const n of notes) {
    s.start({ note: n.pitch, time: at + n.start * secPerBeat, duration: n.duration * secPerBeat, velocity: sampleVelocity(n.velocity) });
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
      s.stop();
      end();
    },
  };
}
