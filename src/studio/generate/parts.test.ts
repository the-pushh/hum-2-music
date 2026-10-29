import { describe, expect, it } from "vitest";
import type { Clip, Note, Project, Track } from "@/studio/types";
import { claudePartsFollowStyle, withClaudeParts, withGeneratedParts, withStyle } from "./parts";

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

describe("changing the style", () => {
  const drumsOf = (p: Project) => notesOn(p, p.tracks.find((t) => t.name === "Drums")!).map(([pitch, start]) => [pitch, start]);

  it("rewrites generated drums in the new feel and keeps the melody", () => {
    const generated = withGeneratedParts(project);
    const fourOnTheFloor = withStyle(generated, { drums: "four-on-the-floor" });
    expect(fourOnTheFloor.style?.drums).toBe("four-on-the-floor");
    expect(drumsOf(fourOnTheFloor).filter(([pitch]) => pitch === 36).map(([, start]) => start)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(notesOn(fourOnTheFloor, melodyTrack)).toEqual(notesOn(generated, melodyTrack));
  });

  it("removes generated drums when the feel is none, keeping the other parts", () => {
    const none = withStyle(withGeneratedParts(project), { drums: "none" });
    expect(none.tracks.map((t) => t.name)).toEqual(["Hum 1", "Chords", "Bass"]);
  });

  it("leaves out the chords or bass track when either is none, keeping the bass under the chords it can't hear", () => {
    const generated = withGeneratedParts(project);
    const bassOf = (p: Project) => notesOn(p, p.tracks.find((t) => t.name === "Bass")!);
    const noChords = withStyle(generated, { chords: "none" });
    expect(noChords.tracks.map((t) => t.name)).toEqual(["Hum 1", "Bass", "Drums"]);
    expect(bassOf(noChords)).toEqual(bassOf(generated));
    expect(withStyle(withGeneratedParts(project), { bass: "none" }).tracks.map((t) => t.name)).toEqual(["Hum 1", "Chords", "Drums"]);
  });

  it("only saves the style when nothing has been generated yet", () => {
    const styled = withStyle(project, { drums: "half-time" });
    expect(styled.tracks).toEqual(project.tracks);
    expect(styled.clips).toEqual(project.clips);
    expect(styled.style).toMatchObject({ drums: "half-time", chords: "triads" });
  });
});

describe("parts Claude wrote", () => {
  /** The arrangement with Claude's own chords: one held C major chord, marked as written by Claude. */
  function withClaudeChords(): Project {
    const generated = withGeneratedParts(project);
    const chords = generated.tracks.find((t) => t.name === "Chords")!;
    return {
      ...generated,
      tracks: generated.tracks.map((t) => (t.id === chords.id ? { ...t, volume: 0.3, origin: { kind: "generated", part: "chords", by: "claude" } } : t)),
      clips: generated.clips.map((c) => (c.trackId === chords.id ? { ...c, notes: [quarter(60, 0), quarter(64, 0), quarter(67, 0)] } : c)),
    };
  }
  const chordsOf = (p: Project) => notesOn(p, p.tracks.find((t) => t.name === "Chords")!);

  it("marks rule-written parts as written by rules", () => {
    const generated = withGeneratedParts(project);
    expect(generated.tracks.filter((t) => t.origin?.kind === "generated").map((t) => t.origin)).toEqual([
      { kind: "generated", part: "chords", by: "rules" },
      { kind: "generated", part: "bass", by: "rules" },
      { kind: "generated", part: "drums", by: "rules" },
    ]);
  });

  it("keeps Claude's parts when the style changes, still rewriting the rule-written ones", () => {
    const claude = withClaudeChords();
    const styled = withStyle(claude, { drums: "half-time" });
    expect(chordsOf(styled)).toEqual(chordsOf(claude));
    expect(styled.tracks.find((t) => t.name === "Chords")?.origin).toEqual({ kind: "generated", part: "chords", by: "claude" });
    const snares = notesOn(styled, styled.tracks.find((t) => t.name === "Drums")!).filter(([pitch]) => pitch === 38);
    expect(snares.map(([, start]) => start)).toEqual([2, 6]);
  });

  it("replaces Claude's parts with rule-written ones on Generate parts, keeping their mixer settings", () => {
    const claude = withClaudeChords();
    const plain = withGeneratedParts(claude);
    const chords = plain.tracks.find((t) => t.name === "Chords")!;
    expect(chords.origin).toEqual({ kind: "generated", part: "chords", by: "rules" });
    expect(chords.volume).toBe(0.3);
    expect(chordsOf(plain)).toEqual(chordsOf(withGeneratedParts(project)));
  });

  it("treats parts from before anyone was named as written by rules", () => {
    const old = withGeneratedParts(project);
    const unnamed = { ...old, tracks: old.tracks.map((t) => (t.origin?.kind === "generated" ? { ...t, origin: { kind: "generated" as const, part: t.origin.part } } : t)) };
    const styled = withStyle(unnamed, { drums: "half-time" });
    const snares = notesOn(styled, styled.tracks.find((t) => t.name === "Drums")!).filter(([pitch]) => pitch === 38);
    expect(snares.map(([, start]) => start)).toEqual([2, 6]);
  });
});

describe("putting Claude's parts in the arrangement", () => {
  const written = {
    chords: [60, 64, 67].map((pitch) => ({ pitch, startBeat: 0, duration: 4, velocity: 70 })),
    bass: [{ pitch: 36, startBeat: 0, duration: 2, velocity: 100 }],
  };

  it("adds the parts as generated tracks written by Claude", () => {
    const next = withClaudeParts(project, written);
    expect(next.tracks.map((t) => [t.name, t.origin])).toEqual([
      ["Hum 1", melodyTrack.origin],
      ["Chords", { kind: "generated", part: "chords", by: "claude" }],
      ["Bass", { kind: "generated", part: "bass", by: "claude" }],
    ]);
    expect(notesOn(next, next.tracks[1])).toEqual([
      [60, 0, 4],
      [64, 0, 4],
      [67, 0, 4],
    ]);
    expect(next.clips.find((c) => c.trackId === next.tracks[1].id)).toMatchObject({ startBar: 0, lengthBars: 2 });
  });

  it("replaces only the parts Claude wrote, keeping their mixer settings and the other parts", () => {
    const generated = withGeneratedParts(project);
    const quietChords = { ...generated, tracks: generated.tracks.map((t) => (t.name === "Chords" ? { ...t, volume: 0.2, muted: true } : t)) };
    const next = withClaudeParts(quietChords, { chords: written.chords });
    const chords = next.tracks.find((t) => t.name === "Chords")!;
    expect(chords).toMatchObject({ volume: 0.2, muted: true, origin: { kind: "generated", part: "chords", by: "claude" } });
    expect(notesOn(next, next.tracks.find((t) => t.name === "Drums")!)).toEqual(notesOn(generated, generated.tracks.find((t) => t.name === "Drums")!));
    expect(next.tracks.find((t) => t.name === "Bass")?.origin).toMatchObject({ by: "rules" });
  });

  it("never puts Claude's drums over a hummed beat", () => {
    const beat: Track = { ...melodyTrack, id: "beat", name: "Beat 1", type: "drum", color: "drums", instrumentPreset: "hum-drums", order: 1, origin: { kind: "hum", ideaId: "beat" } };
    const withBeat = { ...project, tracks: [melodyTrack, beat] };
    const next = withClaudeParts(withBeat, { drums: [{ pitch: 36, startBeat: 0, duration: 0.25, velocity: 100 }] });
    expect(next.tracks.map((t) => t.name)).toEqual(["Hum 1", "Beat 1"]);
  });
});

describe("whether Claude's parts follow the Style", () => {
  const chords = [60, 64, 67].map((pitch) => ({ pitch, startBeat: 0, duration: 4, velocity: 70 }));

  it("follow it right after Claude writes them", () => {
    expect(claudePartsFollowStyle(withClaudeParts(project, { chords }))).toBe(true);
  });

  it("stop following it when the Style changes under them", () => {
    const written = withClaudeParts(project, { chords });
    expect(claudePartsFollowStyle(withStyle(written, { drums: "half-time" }))).toBe(false);
  });

  it("follow it again once Claude writes in the new Style", () => {
    const changed = withStyle(withClaudeParts(project, { chords }), { drums: "half-time" });
    expect(claudePartsFollowStyle(withClaudeParts(changed, { chords }))).toBe(true);
  });

  it("have nothing to follow once Generate parts replaces them", () => {
    const changed = withStyle(withClaudeParts(project, { chords }), { drums: "half-time" });
    expect(claudePartsFollowStyle(withGeneratedParts(changed))).toBe(true);
  });

  it("have nothing to follow when Claude wrote nothing", () => {
    expect(claudePartsFollowStyle(withStyle(withGeneratedParts(project), { drums: "half-time" }))).toBe(true);
  });
});

describe("Claude's parts and the Style's none", () => {
  const chords = [60, 64, 67].map((pitch) => ({ pitch, startBeat: 0, duration: 4, velocity: 70 }));
  const drums = [{ pitch: 36, startBeat: 0, duration: 0.25, velocity: 100 }];

  it("removes a Claude part when the Style sets it to none", () => {
    const next = withStyle(withClaudeParts(withGeneratedParts(project), { chords }), { chords: "none" });
    expect(next.tracks.map((t) => t.name)).toEqual(["Hum 1", "Bass", "Drums"]);
  });

  it("removes Claude's drums once a hummed beat is the drums", () => {
    const written = withClaudeParts(project, { drums });
    const beat: Track = { ...melodyTrack, id: "beat", name: "Beat 1", type: "drum", color: "drums", instrumentPreset: "hum-drums", order: 9, origin: { kind: "hum", ideaId: "beat" } };
    const next = withStyle({ ...written, tracks: [...written.tracks, beat] }, { energy: "high" });
    expect(next.tracks.filter((t) => t.type === "drum").map((t) => t.name)).toEqual(["Beat 1"]);
  });
});

