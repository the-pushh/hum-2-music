import { Midi } from "@tonejs/midi";
import { describe, expect, it } from "vitest";
import type { Clip, Note, Project, Track } from "@/studio/types";
import { exportProjectToMidi } from "./export";

const track = (id: string, type: Track["type"], color: Track["color"]): Track => ({
  id,
  projectId: "p",
  name: id,
  type,
  color,
  volume: 0.8,
  pan: 0,
  muted: false,
  solo: false,
  armed: false,
  order: 0,
});

const note = (pitch: number, startBeat: number, duration: number, velocity = 100): Note => ({
  id: `${pitch}-${startBeat}`,
  pitch,
  startBeat,
  duration,
  velocity,
});

const clip = (trackId: string, startBar: number, notes: Note[]): Clip => ({
  id: `${trackId}-${startBar}`,
  trackId,
  type: "midi",
  name: trackId,
  startBar,
  lengthBars: 2,
  notes,
});

const project: Project = {
  id: "p",
  name: "Twinkle",
  bpm: 120,
  key: "C",
  scale: "major",
  timeSignature: [4, 4],
  tracks: [track("Melody", "midi", "melody"), track("Chords", "midi", "keys"), track("Drums", "drum", "drums"), track("Empty", "midi", "bass")],
  clips: [
    clip("Melody", 0, [note(60, 0, 1, 127), note(67, 2, 0.5)]),
    clip("Chords", 1, [note(48, 0, 4), note(52, 0, 4), note(55, 0, 4)]),
    { ...clip("Drums", 0, [note(36, 0, 0.25), note(38, 1, 0.25), note(42, 0.5, 0.25)]), type: "drum" },
  ],
  createdAt: 0,
  updatedAt: 0,
};

/** Exports and reads the file back the way another DAW would. */
function roundTrip(p: Project) {
  return new Midi(exportProjectToMidi(p).toArray());
}

const beatsOf = (midi: Midi, trackIndex: number) =>
  midi.tracks[trackIndex].notes.map((n) => [n.midi, n.ticks / midi.header.ppq, n.durationTicks / midi.header.ppq]);

describe("MIDI export", () => {
  it("keeps the tempo, time signature and name", () => {
    const midi = roundTrip(project);
    expect(Math.round(midi.header.tempos[0].bpm)).toBe(120);
    expect(midi.header.timeSignatures[0].timeSignature).toEqual([4, 4]);
    expect(midi.header.name).toBe("Twinkle");
  });

  it("writes one MIDI track per track with notes, by name", () => {
    expect(roundTrip(project).tracks.map((t) => t.name)).toEqual(["Melody", "Chords", "Drums"]);
  });

  it("puts every note back where it was, in beats, with clips offset by their bar", () => {
    const midi = roundTrip(project);
    expect(beatsOf(midi, 0)).toEqual([
      [60, 0, 1],
      [67, 2, 0.5],
    ]);
    expect(beatsOf(midi, 1)).toEqual([
      [48, 4, 4],
      [52, 4, 4],
      [55, 4, 4],
    ]);
    expect(beatsOf(midi, 2)).toEqual([
      [36, 0, 0.25],
      [42, 0.5, 0.25],
      [38, 1, 0.25],
    ]);
  });

  it("keeps velocity", () => {
    const [loud, normal] = roundTrip(project).tracks[0].notes;
    expect(Math.round(loud.velocity * 127)).toBe(127);
    expect(Math.round(normal.velocity * 127)).toBe(100);
  });

  it("puts drums on channel 10 and nothing else there", () => {
    const midi = roundTrip(project);
    expect(midi.tracks[2].channel).toBe(9);
    expect(midi.tracks[2].instrument.percussion).toBe(true);
    expect(midi.tracks.slice(0, 2).map((t) => t.channel)).not.toContain(9);
  });
});
