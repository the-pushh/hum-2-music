import { describe, expect, it } from "vitest";
import type { Note as HumNote, Transcription } from "@/melody/types";
import type { Idea, Sketch, VoiceIdea } from "@/sketches/types";
import { sketchToProject } from "./sketchToProject";

const sketch: Sketch = { id: "s1", title: "Twinkle", createdAt: 1, updatedAt: 2 };

/** The first phrase of Twinkle Twinkle, as cleanup leaves it: quarter notes, then a half note. */
const twinkle: HumNote[] = [60, 60, 67, 67, 69, 69].map((pitch, i) => ({ pitch, start: i, duration: 1, velocity: 0.7 }));
twinkle.push({ pitch: 67, start: 6, duration: 2, velocity: 1 });

const done = (clean: HumNote[], extra: Partial<Extract<Transcription, { status: "done" }>> = {}): Transcription => ({
  status: "done",
  raw: [{ pitch: 61, start: 0.1, duration: 0.9, velocity: 0.5 }],
  clean,
  key: { tonic: 0, mode: "major" },
  settings: { key: "auto", snap: true, grid: 8 },
  showRaw: false,
  ...extra,
});

let order = 0;
function hum(transcription?: Transcription, take?: VoiceIdea["take"]): VoiceIdea {
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

  it("gives an empty hum a one bar clip", () => {
    const project = sketchToProject(sketch, [hum(done([]))]);
    expect(project.clips[0]).toMatchObject({ lengthBars: 1, notes: [] });
  });
});
