import { Midi } from "@tonejs/midi";
import type { Note } from "@/melody/types";
import type { VoiceIdea } from "@/sketches/types";
import { sampleVelocity } from "./takeEvents";

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
    // Melody notes at the loudness the card plays them (its 40–110 range): the full 127 makes most DAW instruments
    // much brighter and harsher than the hum sounded. Whole MIDI velocities first, since the file format floors.
    const midiVelocity = drums ? Math.round(n.velocity * 127) : sampleVelocity(n.velocity);
    const velocity = Math.min(127, Math.max(1, midiVelocity)) / 127;
    track.addNote({ midi: n.pitch, time: n.start * secPerBeat, duration: n.duration * secPerBeat, velocity });
  }
  return midi.toArray();
}
