import { describe, expect, it } from "vitest";
import type { Clip, Note, Project, Track } from "@/studio/types";
import { withGeneratedParts } from "./parts";

const melodyTrack: Track = {
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

const quarter = (pitch: number, startBeat: number): Note => ({ id: `${pitch}@${startBeat}`, pitch, startBeat, duration: 1, velocity: 100 });

/** C E G E | F A C A: I then IV. */
const melodyClip: Clip = {
  id: "clip",
  trackId: "hum",
  type: "midi",
  name: "Hum",
  startBar: 0,
  lengthBars: 2,
  notes: [60, 64, 67, 64, 65, 69, 72, 69].map((p, i) => quarter(p, i)),
};

const project: Project = {
  id: "p",
  name: "Song",
  bpm: 100,
  key: "C",
  scale: "major",
  timeSignature: [4, 4],
  tracks: [melodyTrack],
  clips: [melodyClip],
  createdAt: 0,
  updatedAt: 0,
};

const notesOn = (p: Project, track: Track) =>
  p.clips.filter((c) => c.trackId === track.id).flatMap((c) => (c.notes ?? []).map((n) => [n.pitch, n.startBeat, n.duration]));

describe("generating parts", () => {
  it("adds a chords track marked as generated, one chord per bar of the melody", () => {
    const next = withGeneratedParts(project);
    const chords = next.tracks.find((t) => t.origin?.kind === "generated" && t.origin.part === "chords")!;
    expect(chords).toMatchObject({ name: "Chords", type: "midi", color: "keys", projectId: "p" });
    expect(next.clips.filter((c) => c.trackId === chords.id)).toHaveLength(1);
    expect(next.clips.find((c) => c.trackId === chords.id)).toMatchObject({ startBar: 0, lengthBars: 2 });
    expect(notesOn(next, chords)).toEqual([
      [60, 0, 4],
      [64, 0, 4],
      [67, 0, 4],
      [53, 4, 4],
      [57, 4, 4],
      [60, 4, 4],
    ]);
  });

  it("leaves the melody alone", () => {
    const next = withGeneratedParts(project);
    expect(next.tracks[0]).toEqual(melodyTrack);
    expect(next.clips.find((c) => c.id === "clip")).toEqual(melodyClip);
  });

  it("replaces the generated parts when run again, keeping tracks added by hand", () => {
    const handMade: Track = { ...melodyTrack, id: "mine", name: "Mine", origin: undefined, order: 5 };
    const once = withGeneratedParts({ ...project, tracks: [...project.tracks, handMade] });
    const quieter = once.tracks.map((t) => (t.origin?.kind === "generated" ? { ...t, volume: 0.2, muted: true } : t));
    const edited = {
      ...once,
      tracks: quieter,
      clips: once.clips.map((c) => (c.trackId === "hum" ? { ...c, notes: c.notes!.slice(0, 4) } : c)),
    };

    const twice = withGeneratedParts(edited);
    const generated = twice.tracks.filter((t) => t.origin?.kind === "generated");
    expect(generated.map((t) => t.name)).toEqual(["Chords", "Bass", "Drums"]);
    expect(generated[0]).toMatchObject({ volume: 0.2, muted: true });
    expect(twice.tracks.map((t) => t.id)).toContain("mine");
    // The melody now only has bar 1, so the chords follow it.
    expect(notesOn(twice, generated[0])).toEqual([
      [60, 0, 4],
      [64, 0, 4],
      [67, 0, 4],
    ]);
    expect(twice.clips.filter((c) => !twice.tracks.some((t) => t.id === c.trackId))).toEqual([]);
  });

  it("adds bass and drums tracks that follow the chords, drums on the step grid's kit", () => {
    const next = withGeneratedParts(project);
    const part = (name: string) => next.tracks.find((t) => t.name === name)!;
    expect(part("Bass")).toMatchObject({ type: "midi", color: "bass", origin: { kind: "generated", part: "bass" } });
    expect(part("Drums")).toMatchObject({ type: "drum", color: "drums", instrumentPreset: "hum-drums", origin: { kind: "generated", part: "drums" } });
    // I then IV: C2 up into F2.
    expect(notesOn(next, part("Bass")).map(([pitch, start]) => [pitch, start])).toEqual([
      [36, 0],
      [36, 2],
      [40, 3],
      [41, 4],
      [41, 6],
    ]);
    expect(next.clips.find((c) => c.trackId === part("Drums").id)).toMatchObject({ type: "drum", lengthBars: 2 });
  });

  it("keeps a hummed beat as the drums, still writing chords and bass for the melody", () => {
    const beatTrack: Track = { ...melodyTrack, id: "beat", name: "Beat 1", type: "drum", color: "drums", instrumentPreset: "hum-drums", order: 1, origin: { kind: "hum", ideaId: "beat" } };
    const beatClip: Clip = { id: "beat-clip", trackId: "beat", type: "drum", name: "Beat", startBar: 0, lengthBars: 1, notes: [quarter(36, 0), quarter(38, 1)] };
    const withBeat = { ...project, tracks: [melodyTrack, beatTrack], clips: [melodyClip, beatClip] };

    const next = withGeneratedParts(withGeneratedParts(withBeat));
    expect(next.tracks.map((t) => t.name)).toEqual(["Hum 1", "Beat 1", "Chords", "Bass"]);
    expect(notesOn(next, beatTrack)).toEqual(notesOn(withBeat, beatTrack));
  });

  it("drops generated drums made before a beat was hummed", () => {
    const generated = withGeneratedParts(project);
    const beatTrack: Track = { ...melodyTrack, id: "beat", name: "Beat 1", type: "drum", color: "drums", instrumentPreset: "hum-drums", order: 9, origin: { kind: "hum", ideaId: "beat" } };
    const next = withGeneratedParts({ ...generated, tracks: [...generated.tracks, beatTrack] });
    expect(next.tracks.filter((t) => t.type === "drum").map((t) => t.name)).toEqual(["Beat 1"]);
  });

  it("follows a hummed melody played as keys", () => {
    const asKeys = { ...project, tracks: [{ ...melodyTrack, color: "keys" as const, instrumentPreset: "hum-electric-piano" }] };
    const chordsOf = (p: Project) => notesOn(withGeneratedParts(p), withGeneratedParts(p).tracks.find((t) => t.name === "Chords")!);
    expect(chordsOf(asKeys)).toEqual(chordsOf(project));
  });

  it("writes only drums for an arrangement with no melody", () => {
    const empty = { ...project, clips: [] };
    expect(withGeneratedParts(empty).tracks.map((t) => t.name)).toEqual(["Hum 1", "Drums"]);
  });

  it("gives the same parts every time", () => {
    const strip = (p: Project) => p.tracks.map((t) => [t.name, notesOn(p, t)]);
    expect(strip(withGeneratedParts(project))).toEqual(strip(withGeneratedParts(project)));
  });
});
