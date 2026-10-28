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
    const raw = { understood: true, summary: "72 BPM · half-time", bpm: 72, style: { drums: "half-time", energy: "low" } };
    expect(directionSchema.parse(raw)).toEqual(raw);
  });

  it("accepts one that understood nothing", () => {
    expect(directionSchema.parse({ understood: false, summary: "" })).toEqual({ understood: false, summary: "" });
  });

  it.each([
    ["a tempo too fast", { bpm: 300 }],
    ["a tempo too slow", { bpm: 20 }],
    ["an unknown drum feel", { style: { drums: "trap" } }],
    ["an unknown energy", { style: { energy: "eleven" } }],
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

  it("merges the style and rewrites generated parts in it", () => {
    const generated = withGeneratedParts(project);
    const halfTime = applyDirection(generated, direction({ style: { drums: "half-time" } }));
    expect(halfTime.style).toMatchObject({ drums: "half-time", chords: "triads" });
    expect(notesOn(halfTime, "Drums").filter(([pitch]) => pitch === 38).map(([, start]) => start)).toEqual([2, 6]);
  });

  it("leaves a hummed beat alone when the drum feel changes", () => {
    const beat: Track = { ...hum, id: "beat", name: "Beat 1", type: "drum", color: "drums", instrumentPreset: "hum-drums", order: 1, origin: { kind: "hum", ideaId: "beat" } };
    const beatClip: Clip = { id: "bc", trackId: "beat", type: "drum", name: "Beat", startBar: 0, lengthBars: 1, notes: [quarter(36, 0), quarter(38, 1)] };
    const withBeat = withGeneratedParts({ ...project, tracks: [hum, beat], clips: [humClip, beatClip] });
    const changed = applyDirection(withBeat, direction({ style: { drums: "four-on-the-floor" } }));
    expect(notesOn(changed, "Beat 1")).toEqual(notesOn(withBeat, "Beat 1"));
    expect(changed.tracks.map((t) => t.name)).not.toContain("Drums");
  });
});
