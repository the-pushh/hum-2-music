import { Midi } from "@tonejs/midi";
import { describe, expect, it } from "vitest";
import type { BeatHeard, MelodyHeard, Note } from "@/melody/types";
import type { VoiceIdea } from "@/sketches/types";
import { heardNotes, takeMidi } from "./takeMidi";

const note = (pitch: number, start: number, duration: number, velocity = 0.8): Note => ({ pitch, start, duration, velocity });

const melody: MelodyHeard = {
  status: "done",
  raw: [note(61, 0.1, 0.9)],
  clean: [note(60, 0, 1), note(64, 1, 1), note(67, 2, 2, 1)],
  key: { tonic: 0, mode: "major" },
  settings: { key: "auto", snap: true, grid: 8 },
  showRaw: false,
};
const beat: BeatHeard = { status: "done", kind: "beat", raw: [note(36, 0.05, 0.25)], clean: [note(36, 0, 0.25, 1), note(38, 1, 0.25, 0.5)], grid: 16, showRaw: false };

function idea(transcription: VoiceIdea["transcription"], take: VoiceIdea["take"] = { bpm: 120, click: true }): VoiceIdea {
  return { kind: "voice", id: "i", sketchId: "s", order: 0, createdAt: 0, blob: new Blob(), mime: "audio/webm", durationSec: 4, peaks: [], take, transcription };
}

/** Reads the file back the way a DAW would: notes in beats at the file's tempo. */
function readBack(bytes: Uint8Array) {
  const midi = new Midi(bytes);
  const ppq = midi.header.ppq;
  return {
    bpm: Math.round(midi.header.tempos[0]?.bpm ?? 0),
    name: midi.name,
    tracks: midi.tracks.map((t) => ({
      channel: t.channel,
      percussion: t.instrument.percussion,
      notes: t.notes.map((n) => [n.midi, n.ticks / ppq, n.durationTicks / ppq, Math.round(n.velocity * 127)]),
    })),
  };
}

describe("a take as a MIDI file", () => {
  it("holds the notes the card shows, in beats, at the take's tempo and the loudness the card plays them at", () => {
    const { notes, drums } = heardNotes(idea(melody))!;
    expect(readBack(takeMidi({ notes, drums, bpm: 120, name: "Hum" }))).toEqual({
      bpm: 120,
      name: "Hum",
      tracks: [
        {
          channel: 0,
          percussion: false,
          notes: [
            // 0.8 and 1 on the card's 40–110 range, never MIDI's full 127.
            [60, 0, 1, 96],
            [64, 1, 1, 96],
            [67, 2, 2, 110],
          ],
        },
      ],
    });
  });

  it("uses the raw notes when the card is showing raw", () => {
    const { notes } = heardNotes(idea({ ...melody, showRaw: true }))!;
    expect(notes).toEqual([note(61, 0.1, 0.9)]);
  });

  it("puts a beat's hits on the drum channel", () => {
    const { notes, drums } = heardNotes(idea(beat, { mode: "beat", bpm: 90, click: true }))!;
    const file = readBack(takeMidi({ notes, drums, bpm: 90, name: "Beat" }));
    expect(file.bpm).toBe(90);
    expect(file.tracks[0]).toMatchObject({ channel: 9, percussion: true });
    // Hits keep their full range, as the drum machine plays them.
    expect(file.tracks[0].notes.map(([pitch, start, , velocity]) => [pitch, start, velocity])).toEqual([
      [36, 0, 127],
      [38, 1, 64],
    ]);
  });

  it("has nothing to export before the take is heard", () => {
    expect(heardNotes(idea(undefined))).toBeNull();
    expect(heardNotes(idea({ status: "pending" }))).toBeNull();
    expect(heardNotes(idea({ ...melody, clean: [] }))).toBeNull();
  });
});
