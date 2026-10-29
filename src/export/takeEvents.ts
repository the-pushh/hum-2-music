import { drumSample } from "@/instruments/drumKit";
import type { Note } from "@/melody/types";

/** One note for a smplr instrument: a MIDI pitch (or drum sample name), when, for how long, and how hard, in seconds. */
export type SoundEvent = { note: number | string; time: number; duration: number; velocity: number };

/** hum's 0–1 velocity on the 40–110 range the samples were picked for, so a hum sounds the same on the card, in the studio and in an export. */
export function sampleVelocity(velocity: number): number {
  return Math.round(40 + velocity * 70);
}

/**
 * A take's notes as events for its instrument, in seconds at the take's tempo from `at`: melody notes on the
 * instrument's velocity range, beat hits on the drum machine's samples (drums it doesn't have are skipped). Shared by
 * the card's playback and the audio export, so both sound the same.
 */
export function takeEvents(notes: Note[], bpm: number, drums: boolean, at = 0): SoundEvent[] {
  const secPerBeat = 60 / bpm;
  return notes.flatMap((n): SoundEvent[] => {
    const time = at + n.start * secPerBeat;
    const duration = n.duration * secPerBeat;
    if (!drums) return [{ note: n.pitch, time, duration, velocity: sampleVelocity(n.velocity) }];
    const sample = drumSample(n.pitch);
    return sample ? [{ note: sample, time, duration, velocity: Math.max(1, Math.round(n.velocity * 127)) }] : [];
  });
}
