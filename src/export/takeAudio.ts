"use client";

import { renderOffline, Scheduler } from "smplr";
import { createDrums } from "@/instruments/drums";
import type { InstrumentId } from "@/instruments/instruments";
import { createSound } from "@/instruments/sound";
import type { Note } from "@/melody/types";
import { takeEvents } from "./takeEvents";

/** Room after the last note for the instrument to ring out. */
const tailSec = 2;

/**
 * A take rendered on its instrument as a 16-bit WAV, as it sounds on the card: a melody on its chosen instrument, a beat
 * on the drum machine. Rendered offline, faster than real time and without playing aloud. The first render of an
 * instrument loads its samples (cached after that).
 */
export async function takeAudio({ notes, drums, bpm, instrument }: { notes: Note[]; drums: boolean; bpm: number; instrument: InstrumentId }): Promise<Blob> {
  const length = (Math.max(0, ...notes.map((n) => n.start + n.duration)) * 60) / bpm;
  const result = await renderOffline(
    async (context) => {
      // Every note is handed to the instrument now, before the render starts (see SoundOptions).
      const scheduler = Scheduler(context, { lookaheadMs: (length + tailSec) * 1000 });
      const sound = drums ? createDrums(context, { scheduler }) : createSound(context, instrument, { scheduler });
      await sound.ready;
      for (const event of takeEvents(notes, bpm, drums)) sound.start(event);
    },
    { duration: length + tailSec },
  );
  return result.toWav16();
}
