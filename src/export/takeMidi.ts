import { Midi } from "@tonejs/midi";
import type { Note } from "@/melody/types";
import type { VoiceIdea } from "@/sketches/types";

/** General MIDI's drum channel (10, counted from 0). */
const drumChannel = 9;

/**
 * The notes a take's card shows, clean or raw, and whether they're drum hits. Nothing until the take has been heard
 * and hum found something in it.
 */
export function heardNotes(idea: VoiceIdea): { notes: Note[]; drums: boolean } | null {
  const t = idea.transcription;
  if (t?.status !== "done") return null;
  const notes = t.showRaw ? t.raw : t.clean;
  return notes.length ? { notes, drums: t.kind === "beat" } : null;
}

/**
 * A take as a standard MIDI file for a DAW: one track of its notes at the take's tempo, a beat on the drum channel.
 * Only notes: the instrument hum plays it on is a preview, so the DAW chooses the sound.
 */
export function takeMidi({ notes, drums, bpm, name }: { notes: Note[]; drums: boolean; bpm: number; name: string }): Uint8Array {
  const midi = new Midi();
  midi.name = name;
  midi.header.setTempo(bpm);
  const track = midi.addTrack();
  track.name = name;
  track.channel = drums ? drumChannel : 0;
  const secPerBeat = 60 / bpm;
  for (const n of notes) {
    // Rounded to a whole MIDI velocity first: the file format floors, which would turn 0.8 (101.6) into 101.
    const velocity = Math.min(127, Math.max(1, Math.round(n.velocity * 127))) / 127;
    track.addNote({ midi: n.pitch, time: n.start * secPerBeat, duration: n.duration * secPerBeat, velocity });
  }
  return midi.toArray();
}
