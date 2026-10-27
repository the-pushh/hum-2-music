"use client";

import { CacheStorage, SplendidGrandPiano } from "smplr";
import type { Note } from "@/melody/types";
import { audioContext } from "./context";

type Piano = ReturnType<typeof SplendidGrandPiano>;

let piano: Promise<Piano> | undefined;

/** Loads the piano once. Samples are kept in the Cache API, so it plays offline after the first load. */
function loadPiano(): Promise<Piano> {
  piano ??= audioContext()
    .then(async (ctx) => {
      const p = SplendidGrandPiano(ctx, {
        storage: CacheStorage("hum-piano"),
        // Melodies sit around middle C after cleanup; load that range and let the nearest sample cover the rest.
        notesToLoad: { notes: range(48, 96), velocityRange: [40, 110], fallback: "nearest" },
      });
      await p.ready;
      return p;
    })
    .catch((err) => {
      piano = undefined;
      throw err;
    });
  return piano;
}

function range(from: number, to: number) {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

export type Playback = { pause: () => void };

/** Plays a melody on the grand piano. `onEnded` runs when it finishes or is paused. */
export async function playMelody(notes: Note[], bpm: number, onEnded: () => void): Promise<Playback> {
  const p = await loadPiano();
  const ctx = await audioContext();
  const secPerBeat = 60 / bpm;
  const at = ctx.currentTime + 0.05;
  for (const n of notes) {
    p.start({ note: n.pitch, time: at + n.start * secPerBeat, duration: n.duration * secPerBeat, velocity: Math.round(40 + n.velocity * 70) });
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
      p.stop();
      end();
    },
  };
}
