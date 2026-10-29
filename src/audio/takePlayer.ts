"use client";

import { takeEvents } from "@/export/takeEvents";
import { createDrums } from "@/instruments/drums";
import type { InstrumentId } from "@/instruments/instruments";
import { createSound, type Sound } from "@/instruments/sound";
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
  return play(await load(instrument), notes, bpm, false, onEnded);
}

/** Plays a beat's hits on the drum machine. `onEnded` runs when it finishes or is paused. */
export async function playBeat(hits: Note[], bpm: number, onEnded: () => void): Promise<Playback> {
  return play(await load("drums"), hits, bpm, true, onEnded);
}

async function play(sound: Sound, notes: Note[], bpm: number, drums: boolean, onEnded: () => void): Promise<Playback> {
  const ctx = await audioContext();
  // smplr queues notes that start later, and its stop() only silences notes already sounding, so each note's own
  // cancel is kept to stop the rest of the take.
  const cancels = takeEvents(notes, bpm, drums, ctx.currentTime + 0.05).map((event) => sound.start(event));
  const length = (Math.max(0, ...notes.map((n) => n.start + n.duration)) * 60) / bpm;
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
      cancels.forEach((cancel) => cancel());
      end();
    },
  };
}
