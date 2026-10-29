import { describe, expect, it } from "vitest";
import { withGeneratedParts } from "@/studio/generate/parts";
import type { Clip, Note, Project, Track } from "@/studio/types";
import { applyDirection } from "./apply";
import { directionSchema, type Direction } from "./schema";

const quarter = (pitch: number, startBeat: number): Note => ({ id: `${pitch}@${startBeat}`, pitch, startBeat, duration: 1, velocity: 100 });

const hum: Track = {
  id: "hum",
  projectId: "p",
  name: "Hum 1",
  type: "midi",
  color: "melody",
  volume: 0.8,
  pan: 0,
  muted: false,
  solo: false,
  armed: false,
  order: 0,
  instrumentPreset: "hum-piano",
  origin: { kind: "hum", ideaId: "idea" },
};
const humClip: Clip = { id: "c", trackId: "hum", type: "midi", name: "Hum", startBar: 0, lengthBars: 2, notes: [60, 64, 67, 64, 65, 69, 72, 69].map((p, i) => quarter(p, i)) };
const project: Project = { id: "p", name: "Song", bpm: 100, key: "C", scale: "major", timeSignature: [4, 4], tracks: [hum], clips: [humClip], createdAt: 0, updatedAt: 0 };

const direction = (d: Partial<Direction>): Direction => ({ understood: true, summary: "", ...d });
const notesOn = (p: Project, name: string) => {
  const track = p.tracks.find((t) => t.name === name)!;
  return p.clips.filter((c) => c.trackId === track.id).flatMap((c) => c.notes!.map((n) => [n.pitch, n.startBeat, n.duration]));
};

describe("reading a Direction", () => {
  it("accepts a well-formed Direction", () => {
    const raw = { understood: true, summary: "72 BPM · in D", bpm: 72, key: "D" };
    expect(directionSchema.parse(raw)).toEqual(raw);
  });

  it("accepts one that understood nothing", () => {
    expect(directionSchema.parse({ understood: false, summary: "" })).toEqual({ understood: false, summary: "" });
  });

  it.each([
    ["a tempo too fast", { bpm: 300 }],
    ["a tempo too slow", { bpm: 20 }],
    ["an unknown key", { key: "H" }],
    ["an unknown scale", { scale: "dorian" }],
  ])("rejects %s", (_, extra) => {
    expect(directionSchema.safeParse({ understood: true, summary: "x", ...extra }).success).toBe(false);
  });
});

describe("applying a Direction", () => {
  it("changes nothing when it names nothing", () => {
    expect(applyDirection(project, direction({}))).toEqual(project);
  });

  it("sets the tempo and keeps every note where it is in beats", () => {
    const slower = applyDirection(project, direction({ bpm: 72 }));
    expect(slower.bpm).toBe(72);
    expect(notesOn(slower, "Hum 1")).toEqual(notesOn(project, "Hum 1"));
  });


});

describe("changing key and mode", () => {
  const pitches = (p: Project, name: string) => notesOn(p, name).map(([pitch]) => pitch);
  const beat: Track = { ...hum, id: "beat", name: "Beat 1", type: "drum", color: "drums", instrumentPreset: "hum-drums", order: 1, origin: { kind: "hum", ideaId: "beat" } };
  const beatClip: Clip = { id: "bc", trackId: "beat", type: "drum", name: "Beat", startBar: 0, lengthBars: 1, notes: [quarter(36, 0), quarter(38, 1)] };
  const withBeat: Project = { ...project, tracks: [hum, beat], clips: [humClip, beatClip] };

  it("moves the song up a tone from C to D, hummed notes with it, drums where they are", () => {
    const inD = applyDirection(withBeat, direction({ key: "D" }));
    expect(inD.key).toBe("D");
    expect(pitches(inD, "Hum 1")).toEqual([62, 66, 69, 66, 67, 71, 74, 71]);
    expect(pitches(inD, "Beat 1")).toEqual([36, 38]);
  });

  it("takes the smallest move: F# to C goes down six semitones", () => {
    const inFSharp = { ...project, key: "F#" as const, clips: [{ ...humClip, notes: [quarter(66, 0)] }] };
    expect(pitches(applyDirection(inFSharp, direction({ key: "C" })), "Hum 1")).toEqual([60]);
  });

  it("moves a C major melody to C minor: E, A and B come down a semitone", () => {
    const scaleOfC = { ...project, clips: [{ ...humClip, notes: [60, 62, 64, 65, 67, 69, 71, 72].map((p, i) => quarter(p, i)) }] };
    const minor = applyDirection(scaleOfC, direction({ scale: "minor" }));
    expect(minor.scale).toBe("minor");
    expect(pitches(minor, "Hum 1")).toEqual([60, 62, 63, 65, 67, 68, 70, 72]);
  });

  it("moves a minor melody back to major", () => {
    const aMinor = { ...project, key: "A" as const, scale: "minor" as const, clips: [{ ...humClip, notes: [69, 72, 76, 79].map((p, i) => quarter(p, i)) }] };
    expect(pitches(applyDirection(aMinor, direction({ scale: "major" })), "Hum 1")).toEqual([69, 73, 76, 80]);
  });

  it("changes key and mode together: C major to A minor", () => {
    const aMinor = applyDirection(project, direction({ key: "A", scale: "minor" }));
    // Down a minor third to A, then the major third (C#) comes down to C.
    expect(pitches(aMinor, "Hum 1").slice(0, 3)).toEqual([57, 60, 64]);
  });

  it("rewrites generated chords in the new key", () => {
    const generated = withGeneratedParts(project);
    const inD = applyDirection(generated, direction({ key: "D" }));
    const firstChord = inD.clips.find((c) => c.trackId === inD.tracks.find((t) => t.name === "Chords")!.id)!.notes!.filter((n) => n.startBeat === 0).map((n) => n.pitch % 12);
    expect(firstChord).toEqual([2, 6, 9]); // D F# A
  });
});

describe("re-voicing tracks", () => {
  it("plays a named hum on the instrument, in its role", () => {
    const strings = applyDirection(project, direction({ instruments: [{ trackId: "hum", instrument: "strings" }] }));
    expect(strings.tracks[0]).toMatchObject({ instrumentPreset: "hum-strings", color: "melody" });
    const bass = applyDirection(project, direction({ instruments: [{ trackId: "hum", instrument: "bass" }] }));
    expect(bass.tracks[0]).toMatchObject({ instrumentPreset: "hum-bass", color: "bass" });
  });

  it("leaves drum and generated tracks alone even if named", () => {
    const generated = withGeneratedParts(project);
    const drums = generated.tracks.find((t) => t.name === "Drums")!;
    const chords = generated.tracks.find((t) => t.name === "Chords")!;
    const changed = applyDirection(generated, direction({ instruments: [{ trackId: drums.id, instrument: "strings" }, { trackId: chords.id, instrument: "flute" }] }));
    expect(changed.tracks).toEqual(generated.tracks);
  });

  it("rejects an unknown instrument", () => {
    expect(directionSchema.safeParse({ understood: true, summary: "x", instruments: [{ trackId: "hum", instrument: "kazoo" }] }).success).toBe(false);
  });
});

