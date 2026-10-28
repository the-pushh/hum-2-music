import { describe, expect, it } from "vitest";
import type { BeatHeard, MelodyHeard, Note as HumNote, Transcription } from "@/melody/types";
import type { Idea, Sketch, VoiceIdea } from "@/sketches/types";
import { heardOf, refreshHum, sketchToProject, staleHums, type HeardIdea } from "./sketchToProject";

const sketch: Sketch = { id: "s1", title: "Twinkle", createdAt: 1, updatedAt: 2 };

/** The first phrase of Twinkle Twinkle, as cleanup leaves it: quarter notes, then a half note. */
const twinkle: HumNote[] = [60, 60, 67, 67, 69, 69].map((pitch, i) => ({ pitch, start: i, duration: 1, velocity: 0.7 }));
twinkle.push({ pitch: 67, start: 6, duration: 2, velocity: 1 });

type Done = MelodyHeard;

const done = (clean: HumNote[], extra: Partial<Done> = {}): Done => ({
  status: "done",
  raw: [{ pitch: 61, start: 0.1, duration: 0.9, velocity: 0.5 }],
  clean,
  key: { tonic: 0, mode: "major" },
  settings: { key: "auto", snap: true, grid: 8 },
  showRaw: false,
  ...extra,
});

/** Kick, hat, snare, hat: one beat of a backbeat, snapped. */
const backbeat: HumNote[] = [
  { pitch: 36, start: 0, duration: 0.25, velocity: 1 },
  { pitch: 42, start: 0.5, duration: 0.25, velocity: 0.5 },
  { pitch: 38, start: 1, duration: 0.25, velocity: 0.8 },
  { pitch: 42, start: 1.5, duration: 0.25, velocity: 0.5 },
];

const beatDone = (clean: HumNote[], extra: Partial<BeatHeard> = {}): BeatHeard => ({
  status: "done",
  kind: "beat",
  raw: [{ pitch: 38, start: 0.05, duration: 0.25, velocity: 0.6 }],
  clean,
  grid: 16,
  showRaw: false,
  ...extra,
});

const beatTake = (bpm = 90): VoiceIdea["take"] => ({ mode: "beat", bpm, click: true });

let order = 0;
function hum(transcription?: Transcription, take?: VoiceIdea["take"], instrument?: VoiceIdea["instrument"]): VoiceIdea {
  order++;
  return {
    kind: "voice",
    id: `hum${order}`,
    sketchId: "s1",
    order,
    createdAt: order,
    blob: new Blob(),
    mime: "audio/webm",
    durationSec: 4,
    peaks: [],
    ...(take && { take }),
    ...(transcription && { transcription }),
    ...(instrument && { instrument }),
  };
}

const note: Idea = { kind: "note", id: "n1", sketchId: "s1", order: 0, createdAt: 0, text: "chorus idea" };

describe("sketchToProject", () => {
  it("turns a transcribed hum into a melody track with one clip of its notes", () => {
    const project = sketchToProject(sketch, [note, hum(done(twinkle), { bpm: 100, click: true })]);

    expect(project.name).toBe("Twinkle");
    expect(project.bpm).toBe(100);
    expect(project.key).toBe("C");
    expect(project.scale).toBe("major");
    expect(project.timeSignature).toEqual([4, 4]);
    expect(project.tracks).toHaveLength(1);
    const [track] = project.tracks;
    expect(track).toMatchObject({ name: "Hum 1", type: "midi", color: "melody", projectId: project.id, order: 0 });
    expect(track.origin).toEqual({ kind: "hum", ideaId: "hum1" });
    expect(project.clips).toHaveLength(1);
    const [clip] = project.clips;
    expect(clip).toMatchObject({ trackId: track.id, type: "midi", startBar: 0, lengthBars: 2 });
    expect(clip.notes!.map(({ pitch, startBeat, duration, velocity }) => [pitch, startBeat, duration, velocity])).toEqual([
      [60, 0, 1, 89],
      [60, 1, 1, 89],
      [67, 2, 1, 89],
      [67, 3, 1, 89],
      [69, 4, 1, 89],
      [69, 5, 1, 89],
      [67, 6, 2, 127],
    ]);
    expect(new Set(clip.notes!.map((n) => n.id)).size).toBe(7);
  });

  it("uses the raw notes when the card is showing raw", () => {
    const project = sketchToProject(sketch, [hum(done(twinkle, { showRaw: true }))]);
    expect(project.clips[0].notes!.map((n) => [n.pitch, n.startBeat, n.duration, n.velocity])).toEqual([[61, 0.1, 0.9, 64]]);
  });

  it("makes one track per transcribed hum, in Sketch order, and skips the rest", () => {
    const minor = done(twinkle, { key: { tonic: 9, mode: "minor" } });
    const project = sketchToProject(sketch, [
      hum(minor, { bpm: 120, click: true }),
      hum({ status: "pending" }),
      hum({ status: "failed", error: "no" }),
      hum(),
      hum(done(twinkle)),
    ]);
    expect(project.tracks.map((t) => t.name)).toEqual(["Hum 1", "Hum 2"]);
    expect(project.tracks.map((t) => t.order)).toEqual([0, 1]);
    expect(project.clips.map((c) => c.trackId)).toEqual(project.tracks.map((t) => t.id));
    // Tempo and key come from the first transcribed hum.
    expect(project.bpm).toBe(120);
    expect(project.key).toBe("A");
    expect(project.scale).toBe("minor");
  });

  it("measures a free take at the reference tempo", () => {
    expect(sketchToProject(sketch, [hum(done(twinkle))]).bpm).toBe(90);
  });

  it("starts with one empty melody track when nothing is transcribed", () => {
    const project = sketchToProject(sketch, [note, hum({ status: "pending" })]);
    expect(project.tracks).toHaveLength(1);
    expect(project.tracks[0]).toMatchObject({ name: "Melody", type: "midi", color: "melody" });
    expect(project.tracks[0].origin).toBeUndefined();
    expect(project.clips).toEqual([]);
    expect(project.bpm).toBe(90);
    expect(project.key).toBe("C");
  });

  it("turns a beat take into a drum track playing its hits on the drum machine", () => {
    const beat = hum(beatDone(backbeat), beatTake(110));
    const project = sketchToProject(sketch, [beat]);
    expect(project.tracks).toHaveLength(1);
    const [track] = project.tracks;
    expect(track).toMatchObject({ name: "Beat 1", type: "drum", color: "drums", instrumentPreset: "hum-drums" });
    expect(track.origin).toEqual({ kind: "hum", ideaId: beat.id });
    const [clip] = project.clips;
    expect(clip).toMatchObject({ trackId: track.id, type: "drum", startBar: 0, lengthBars: 1 });
    expect(clip.notes!.map((n) => [n.pitch, n.startBeat, n.velocity])).toEqual([
      [36, 0, 127],
      [42, 0.5, 64],
      [38, 1, 102],
      [42, 1.5, 64],
    ]);
  });

  it("makes a project from a Sketch with only beats, with no empty melody track", () => {
    const project = sketchToProject(sketch, [hum(beatDone(backbeat), beatTake(100))]);
    expect(project.tracks.map((t) => t.type)).toEqual(["drum"]);
    expect(project.bpm).toBe(100);
    expect(project.key).toBe("C");
  });

  it("takes the tempo from the first take, beat or melody, and the key from the first melody", () => {
    const minor = done(twinkle, { key: { tonic: 9, mode: "minor" } });
    const project = sketchToProject(sketch, [hum(beatDone(backbeat), beatTake(120)), hum(minor, { bpm: 100, click: true })]);
    expect(project.tracks.map((t) => t.name)).toEqual(["Beat 1", "Hum 1"]);
    expect(project.bpm).toBe(120);
    expect(project.key).toBe("A");
    expect(project.scale).toBe("minor");
  });

  it("plays a hum on the instrument chosen for it, in that instrument's role", () => {
    const project = sketchToProject(sketch, [
      hum(done(twinkle)),
      hum(done(twinkle), undefined, "strings"),
      hum(done(twinkle), undefined, "bass"),
      hum(done(twinkle), undefined, "electric-piano"),
      hum(done(twinkle), undefined, "piano"),
    ]);
    expect(project.tracks.map((t) => [t.instrumentPreset, t.color])).toEqual([
      ["hum-piano", "melody"],
      ["hum-strings", "melody"],
      ["hum-bass", "bass"],
      ["hum-electric-piano", "keys"],
      ["hum-piano", "melody"],
    ]);
  });

  it("gives an empty hum a one bar clip", () => {
    const project = sketchToProject(sketch, [hum(done([]))]);
    expect(project.clips[0]).toMatchObject({ lengthBars: 1, notes: [] });
  });
});

describe("refreshing a hum's track", () => {
  const notesOf = (project: ReturnType<typeof sketchToProject>, trackName: string) => {
    const track = project.tracks.find((t) => t.name === trackName)!;
    return project.clips.filter((c) => c.trackId === track.id).flatMap((c) => c.notes!.map((n) => n.pitch));
  };

  it("finds nothing stale right after the arrangement is made", () => {
    const ideas = [hum(done(twinkle)), hum({ status: "pending" })];
    const project = sketchToProject(sketch, ideas);
    expect(staleHums({ project, heard: heardOf(ideas) }, ideas)).toEqual([]);
  });

  it("finds a hum transcribed again, or switched between clean and raw, since the arrangement was made", () => {
    const first = hum(done(twinkle));
    const second = hum(done(twinkle));
    const project = sketchToProject(sketch, [first, second]);
    const heard = heardOf([first, second]);
    const retranscribed = { ...first, transcription: done(twinkle.slice(0, 3)) };
    const switched = { ...second, transcription: done(twinkle, { showRaw: true }) };
    expect(staleHums({ project, heard }, [retranscribed, switched]).map((i) => i.id)).toEqual([first.id, second.id]);
  });

  it("finds a hum transcribed after the arrangement was made", () => {
    const early = hum(done(twinkle));
    const late = hum({ status: "pending" });
    const project = sketchToProject(sketch, [early, late]);
    const heard = heardOf([early, late]);
    const nowHeard = { ...late, transcription: done(twinkle) };
    expect(staleHums({ project, heard }, [early, nowHeard]).map((i) => i.id)).toEqual([late.id]);
  });

  it("replaces only that hum's notes, keeping edits to every other track", () => {
    const first = hum(done(twinkle));
    const second = hum(done(twinkle));
    const project = sketchToProject(sketch, [first, second]);
    const editedOther = {
      ...project,
      clips: project.clips.map((c) => (c.trackId === project.tracks[1].id ? { ...c, notes: c.notes!.slice(0, 1) } : c)),
    };
    const retranscribed = { ...first, transcription: done([{ pitch: 72, start: 0, duration: 1, velocity: 1 }]) };

    const refreshed = refreshHum(editedOther, retranscribed);
    expect(notesOf(refreshed, "Hum 1")).toEqual([72]);
    expect(notesOf(refreshed, "Hum 2")).toEqual([60]);
    expect(refreshed.tracks).toEqual(editedOther.tracks);
  });

  it("finds a beat whose hits changed since the arrangement was made", () => {
    const beat = hum(beatDone(backbeat), beatTake());
    const project = sketchToProject(sketch, [beat]);
    const heard = heardOf([beat]);
    const regridded = { ...beat, transcription: beatDone(backbeat.slice(0, 2)) };
    expect(staleHums({ project, heard }, [beat])).toEqual([]);
    expect(staleHums({ project, heard }, [regridded]).map((i) => i.id)).toEqual([beat.id]);
  });

  it("finds a hum whose instrument changed, and plays its track on the new one", () => {
    const first = hum(done(twinkle));
    const project = sketchToProject(sketch, [first]);
    const heard = heardOf([first]);
    const asBass = { ...first, instrument: "bass" as const };

    const [stale] = staleHums({ project, heard }, [asBass]);
    expect(stale.id).toBe(first.id);
    const refreshed = refreshHum(project, stale);
    expect(refreshed.tracks[0]).toMatchObject({ name: "Hum 1", instrumentPreset: "hum-bass", color: "bass" });
    expect(notesOf(refreshed, "Hum 1")).toEqual(notesOf(project, "Hum 1"));
  });

  it("doesn't count choosing piano for a hum that already played as piano as a change", () => {
    const first = hum(done(twinkle));
    const project = sketchToProject(sketch, [first]);
    expect(staleHums({ project, heard: heardOf([first]) }, [{ ...first, instrument: "piano" }])).toEqual([]);
  });

  it("adds a new beat as a drum track", () => {
    const project = sketchToProject(sketch, [hum(done(twinkle))]);
    const beat = hum(beatDone(backbeat), beatTake()) as HeardIdea;
    const refreshed = refreshHum(project, beat);
    expect(refreshed.tracks.map((t) => [t.name, t.type])).toEqual([
      ["Hum 1", "midi"],
      ["Beat 1", "drum"],
    ]);
  });

  it("adds a new track for a hum the arrangement doesn't have yet", () => {
    const first = hum(done(twinkle));
    const project = sketchToProject(sketch, [first]);
    const newer = hum(done([{ pitch: 64, start: 0, duration: 1, velocity: 1 }])) as HeardIdea;

    const refreshed = refreshHum(project, newer);
    expect(refreshed.tracks.map((t) => t.name)).toEqual(["Hum 1", "Hum 2"]);
    expect(refreshed.tracks[1]).toMatchObject({ order: 1, origin: { kind: "hum", ideaId: newer.id } });
    expect(notesOf(refreshed, "Hum 2")).toEqual([64]);
  });
});
