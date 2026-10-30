import "fake-indexeddb/auto";
import Dexie from "dexie";
import { describe, expect, it } from "vitest";
import type { Project } from "@/studio/types";
import { openSketchStore } from "./store";
import type { LyricsDoc } from "./types";

let n = 0;
function freshStore(start = Date.UTC(2026, 9, 27, 9, 0)) {
  let t = start;
  const store = openSketchStore({ name: `test-${n++}`, now: () => (t += 1000) });
  return store;
}

describe("sketch store", () => {
  it("lists sketches newest first", async () => {
    const store = freshStore();
    const a = await store.createSketch("First");
    const b = await store.createSketch("Second");
    const list = await store.listSketches();
    expect(list.map((s) => s.title)).toEqual(["Second", "First"]);
    expect(list.map((s) => s.id)).toEqual([b.id, a.id]);
  });

  it("lists a sketch's ideas in the order they were added", async () => {
    const store = freshStore();
    const sketch = await store.createSketch("Song");
    await store.addIdea(sketch.id, { kind: "note", text: "rainy bus window" });
    await store.addIdea(sketch.id, { kind: "note", text: "chorus in D?" });
    const other = await store.createSketch("Other");
    await store.addIdea(other.id, { kind: "note", text: "not mine" });

    const ideas = await store.listIdeas(sketch.id);
    expect(ideas.map((i) => i.kind === "note" && i.text)).toEqual(["rainy bus window", "chorus in D?"]);
  });

  it("moves a sketch to the top of the list when an idea is added", async () => {
    const store = freshStore();
    const older = await store.createSketch("Older");
    await store.createSketch("Newer");
    await store.addIdea(older.id, { kind: "note", text: "back to this one" });
    expect((await store.listSketches()).map((s) => s.title)).toEqual(["Older", "Newer"]);
  });

  it("removes an idea", async () => {
    const store = freshStore();
    const sketch = await store.createSketch("Song");
    const keep = await store.addIdea(sketch.id, { kind: "note", text: "keep" });
    const drop = await store.addIdea(sketch.id, { kind: "note", text: "drop" });
    await store.removeIdea(drop.id);
    expect((await store.listIdeas(sketch.id)).map((i) => i.id)).toEqual([keep.id]);
  });

  it("captures into a new sketch with a readable title when none is open", async () => {
    const store = freshStore(new Date(2026, 9, 27, 9, 0).getTime());
    const { sketch, idea } = await store.capture(null, { kind: "note", text: "first thought" });
    expect(sketch.title).toBe("Idea, 27 Oct");
    expect(await store.listSketches()).toEqual([sketch]);
    expect(await store.listIdeas(sketch.id)).toEqual([idea]);
  });

  it("gives a new sketch the id chosen for it ahead of time, so its page can load before the capture is saved", async () => {
    const store = freshStore();
    const { sketch } = await store.capture(null, { kind: "note", text: "first thought" }, "chosen-id");
    expect(sketch.id).toBe("chosen-id");
    expect(await store.listIdeas("chosen-id")).toHaveLength(1);
  });

  it("captures into the open sketch", async () => {
    const store = freshStore();
    const open = await store.createSketch("Open");
    const { sketch } = await store.capture(open.id, { kind: "note", text: "more" });
    expect(sketch.id).toBe(open.id);
    expect(await store.listSketches()).toHaveLength(1);
    expect(await store.listIdeas(open.id)).toHaveLength(1);
  });

  it("gets a sketch by id, and nothing for an unknown id", async () => {
    const store = freshStore();
    const sketch = await store.createSketch("Song");
    expect(await store.getSketch(sketch.id)).toEqual(sketch);
    expect(await store.getSketch("missing")).toBeUndefined();
  });

  it("saves nothing when capturing into a sketch that doesn't exist", async () => {
    const store = freshStore();
    await expect(store.capture("missing", { kind: "note", text: "lost" })).rejects.toThrow();
    expect(await store.listIdeas("missing")).toEqual([]);
    expect(await store.listSketches()).toEqual([]);
  });

  it("keeps a voice idea's audio, format, length and waveform", async () => {
    const store = freshStore();
    const audio = new Blob([new Uint8Array([1, 2, 3, 4])], { type: "audio/webm;codecs=opus" });
    const { sketch } = await store.capture(null, {
      kind: "voice",
      blob: audio,
      mime: "audio/webm;codecs=opus",
      durationSec: 12.5,
      peaks: [0.1, 0.8, 0.4],
    });

    const [idea] = await store.listIdeas(sketch.id);
    expect(idea.kind).toBe("voice");
    if (idea.kind !== "voice") return;
    expect(idea.mime).toBe("audio/webm;codecs=opus");
    expect(idea.durationSec).toBe(12.5);
    expect(idea.peaks).toEqual([0.1, 0.8, 0.4]);
    expect(new Uint8Array(await idea.blob.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 4]));
  });

  it("keeps a beat take's mode, tempo and click", async () => {
    const store = freshStore();
    const audio = new Blob([new Uint8Array([5, 6])], { type: "audio/mp4" });
    const take = { mode: "beat", bpm: 100, click: true } as const;
    const { idea } = await store.capture(null, { kind: "voice", blob: audio, mime: "audio/mp4", durationSec: 9.6, peaks: [], take });

    const read = await store.getIdea(idea.id);
    expect(read?.kind === "voice" && read.take).toEqual({ mode: "beat", bpm: 100, click: true });
  });

  describe("transcription", () => {
    async function voiceIdea(store: ReturnType<typeof freshStore>) {
      const audio = new Blob([new Uint8Array([9, 8, 7])], { type: "audio/mp4" });
      const { idea } = await store.capture(null, { kind: "voice", blob: audio, mime: "audio/mp4", durationSec: 4, peaks: [0.2, 0.6] });
      return idea;
    }

    it("reads a voice idea from before transcription as not transcribed yet", async () => {
      const store = freshStore();
      const idea = await voiceIdea(store);
      const read = await store.getIdea(idea.id);
      expect(read?.kind === "voice" && read.transcription).toBeUndefined();
    });

    it("saves a transcription and reads it back, leaving the audio untouched", async () => {
      const store = freshStore();
      const idea = await voiceIdea(store);
      await store.setTranscription(idea.id, { status: "pending" });
      const done = {
        status: "done" as const,
        raw: [{ pitch: 59.7, start: 0.02, duration: 0.9, velocity: 0.7 }],
        clean: [{ pitch: 60, start: 0, duration: 1, velocity: 0.7 }],
        key: { tonic: 0, mode: "major" as const },
        settings: { key: "auto" as const, snap: true, grid: 8 as const },
        showRaw: false,
      };
      await store.setTranscription(idea.id, done);

      const read = await store.getIdea(idea.id);
      if (read?.kind !== "voice") throw new Error("expected a voice idea");
      expect(read.transcription).toEqual(done);
      expect(read.mime).toBe("audio/mp4");
      expect(read.durationSec).toBe(4);
      expect(read.peaks).toEqual([0.2, 0.6]);
      expect(new Uint8Array(await read.blob.arrayBuffer())).toEqual(new Uint8Array([9, 8, 7]));
    });

    it("fills in a take's waveform after it's saved, keeping its transcription and the sketch's place", async () => {
      const store = freshStore();
      const idea = await voiceIdea(store);
      await store.setTranscription(idea.id, { status: "pending" });
      const before = (await store.getSketch(idea.sketchId))?.updatedAt;
      await store.setWaveform(idea.id, { durationSec: 4.25, peaks: [0.1, 0.9, 0.4] });

      const read = await store.getIdea(idea.id);
      if (read?.kind !== "voice") throw new Error("expected a voice idea");
      expect(read.durationSec).toBe(4.25);
      expect(read.peaks).toEqual([0.1, 0.9, 0.4]);
      expect(read.transcription).toEqual({ status: "pending" });
      expect((await store.getSketch(idea.sketchId))?.updatedAt).toBe(before);
    });

    it("saves the hits heard in a beat and reads them back", async () => {
      const store = freshStore();
      const idea = await voiceIdea(store);
      const heard = {
        status: "done" as const,
        kind: "beat" as const,
        raw: [{ pitch: 36, start: 0.04, duration: 0.25, velocity: 0.9 }],
        clean: [{ pitch: 36, start: 0, duration: 0.25, velocity: 0.9 }],
        grid: 16 as const,
        showRaw: false,
      };
      await store.setTranscription(idea.id, heard);

      const read = await store.getIdea(idea.id);
      expect(read?.kind === "voice" && read.transcription).toEqual(heard);
    });

    it("refuses to transcribe an idea that isn't a voice idea", async () => {
      const store = freshStore();
      const { idea } = await store.capture(null, { kind: "note", text: "hm" });
      await expect(store.setTranscription(idea.id, { status: "pending" })).rejects.toThrow(/not voice/);
    });
  });

  describe("instrument choice", () => {
    it("has no instrument choice until one is made", async () => {
      const store = freshStore();
      const audio = new Blob([new Uint8Array([1])], { type: "audio/mp4" });
      const { idea } = await store.capture(null, { kind: "voice", blob: audio, mime: "audio/mp4", durationSec: 2, peaks: [] });
      const read = await store.getIdea(idea.id);
      expect(read?.kind === "voice" && read.instrument).toBeUndefined();
    });

    it("saves and changes a melody's instrument, moving its sketch to the top", async () => {
      const store = freshStore();
      const audio = new Blob([new Uint8Array([1])], { type: "audio/mp4" });
      const { sketch, idea } = await store.capture(null, { kind: "voice", blob: audio, mime: "audio/mp4", durationSec: 2, peaks: [] });
      await store.createSketch("Newer");

      await store.setInstrument(idea.id, "strings");
      await store.setInstrument(idea.id, "bass");

      const read = await store.getIdea(idea.id);
      expect(read?.kind === "voice" && read.instrument).toBe("bass");
      expect((await store.listSketches())[0].id).toBe(sketch.id);
    });

    it("refuses an instrument for an idea that isn't a voice idea", async () => {
      const store = freshStore();
      const { idea } = await store.capture(null, { kind: "note", text: "hm" });
      await expect(store.setInstrument(idea.id, "piano")).rejects.toThrow(/not voice/);
    });
  });

  it("saves edits to a lyrics idea and moves its sketch to the top", async () => {
    const store = freshStore();
    const { sketch, idea } = await store.capture(null, { kind: "lyrics", doc: { type: "doc", content: [] } });
    await store.createSketch("Newer");
    const doc: LyricsDoc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "rain on the glass" }] }] };

    await store.updateIdea(idea.id, { kind: "lyrics", doc });

    const [saved] = await store.listIdeas(sketch.id);
    expect(saved.kind === "lyrics" && saved.doc).toEqual(doc);
    expect((await store.listSketches())[0].id).toBe(sketch.id);
  });

  it("gets an idea by id, and nothing for an unknown id", async () => {
    const store = freshStore();
    const { idea } = await store.capture(null, { kind: "note", text: "hello" });
    expect(await store.getIdea(idea.id)).toEqual(idea);
    expect(await store.getIdea("missing")).toBeUndefined();
  });

  it("keeps an image idea's picture and size", async () => {
    const store = freshStore();
    const picture = new Blob([new Uint8Array([9, 8, 7])], { type: "image/jpeg" });
    const { sketch } = await store.capture(null, { kind: "image", blob: picture, w: 1600, h: 1200 });

    const [idea] = await store.listIdeas(sketch.id);
    if (idea.kind !== "image") throw new Error(`expected an image idea, got ${idea.kind}`);
    expect([idea.w, idea.h, idea.blob.type]).toEqual([1600, 1200, "image/jpeg"]);
    expect(new Uint8Array(await idea.blob.arrayBuffer())).toEqual(new Uint8Array([9, 8, 7]));
  });

  it("keeps a link idea's address and preview details", async () => {
    const store = freshStore();
    const link = {
      kind: "link" as const,
      url: "https://youtu.be/dQw4w9WgXcQ",
      provider: "youtube" as const,
      title: "Never Gonna Give You Up",
      thumb: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    };
    const { sketch } = await store.capture(null, link);
    expect(await store.listIdeas(sketch.id)).toMatchObject([link]);
  });

  it("keeps a color idea", async () => {
    const store = freshStore();
    const { sketch } = await store.capture(null, { kind: "color", hex: "#ff5a36" });
    expect(await store.listIdeas(sketch.id)).toMatchObject([{ kind: "color", hex: "#ff5a36" }]);
  });

  describe("reordering", () => {
    async function sketchWith(...texts: string[]) {
      const store = freshStore();
      const sketch = await store.createSketch("Song");
      const ideas = [];
      for (const text of texts) ideas.push(await store.addIdea(sketch.id, { kind: "note", text }));
      const order = async () => (await store.listIdeas(sketch.id)).map((i) => (i.kind === "note" ? i.text : i.kind));
      return { store, sketch, ideas, order };
    }

    it("moves an idea to the front", async () => {
      const { store, ideas, order } = await sketchWith("a", "b", "c", "d");
      await store.moveIdea(ideas[2].id, 0);
      expect(await order()).toEqual(["c", "a", "b", "d"]);
    });

    it("moves an idea to the end", async () => {
      const { store, ideas, order } = await sketchWith("a", "b", "c", "d");
      await store.moveIdea(ideas[0].id, 3);
      expect(await order()).toEqual(["b", "c", "d", "a"]);
    });

    it("moves an idea into the middle", async () => {
      const { store, ideas, order } = await sketchWith("a", "b", "c", "d");
      await store.moveIdea(ideas[3].id, 1);
      expect(await order()).toEqual(["a", "d", "b", "c"]);
    });

    it("clamps a position past either end", async () => {
      const { store, ideas, order } = await sketchWith("a", "b", "c");
      await store.moveIdea(ideas[0].id, 99);
      await store.moveIdea(ideas[2].id, -5);
      expect(await order()).toEqual(["c", "b", "a"]);
    });

    it("keeps the order right after ideas are removed", async () => {
      const { store, sketch, ideas, order } = await sketchWith("a", "b", "c", "d", "e");
      await store.removeIdea(ideas[1].id);
      await store.moveIdea(ideas[4].id, 1);
      await store.addIdea(sketch.id, { kind: "note", text: "f" });
      expect(await order()).toEqual(["a", "e", "c", "d", "f"]);
    });

    it("moves the sketch to the top of the recent list", async () => {
      const { store, sketch, ideas } = await sketchWith("a", "b");
      await store.createSketch("Newer");
      await store.moveIdea(ideas[1].id, 0);
      expect((await store.listSketches())[0].id).toBe(sketch.id);
    });
  });

  it("renames Sketches titled the old way, by date, to ideas, and keeps titles the songwriter chose", async () => {
    const name = `test-${n++}`;
    const old = new Dexie(name);
    old.version(1).stores({ sketches: "id, updatedAt", ideas: "id, sketchId, [sketchId+order]" });
    old.version(2).stores({ arrangements: "sketchId" });
    old.version(3).stores({ layouts: "id" });
    await old.table("sketches").bulkAdd([
      { id: "s1", title: "Sketch, 28 Oct", createdAt: 1, updatedAt: 5 },
      { id: "s2", title: "Sketch, 3 Sept for the chorus", createdAt: 2, updatedAt: 6 },
      { id: "s3", title: "Rainy bus", createdAt: 3, updatedAt: 7 },
    ]);
    old.close();

    const store = openSketchStore({ name });
    expect((await store.listSketches()).map((s) => [s.title, s.updatedAt])).toEqual([
      ["Rainy bus", 7],
      ["Sketch, 3 Sept for the chorus", 6],
      ["Idea, 28 Oct", 5],
    ]);
  });

  it.each([4, 5])("cleans up melodies heard before the cleanup changed again, from their raw notes and settings (from v%i)", async (version) => {
    const name = `test-${n++}`;
    const old = new Dexie(name);
    old.version(1).stores({ sketches: "id, updatedAt", ideas: "id, sketchId, [sketchId+order]" });
    old.version(2).stores({ arrangements: "sketchId" });
    old.version(3).stores({ layouts: "id" });
    old.version(version).stores({});
    // A held note the old cleanup left as a flicker between two semitones.
    const raw = [
      { pitch: 64, start: 0, duration: 0.45, velocity: 0.7 },
      { pitch: 65, start: 0.45, duration: 0.3, velocity: 0.7 },
      { pitch: 64, start: 0.75, duration: 0.45, velocity: 0.7 },
    ];
    const settings = { key: "auto" as const, snap: false, grid: 8 as const };
    await old.table("sketches").add({ id: "s1", title: "Hum", createdAt: 1, updatedAt: 1 });
    await old.table("ideas").bulkAdd([
      {
        id: "melody", sketchId: "s1", order: 0, createdAt: 1, kind: "voice", mime: "audio/webm", durationSec: 1, peaks: [],
        blob: new Blob([new Uint8Array([1])]), take: { mode: "melody", bpm: 90, click: false },
        transcription: { status: "done", raw, clean: raw, key: { tonic: 4, mode: "major" }, settings, showRaw: false },
      },
      { id: "note", sketchId: "s1", order: 1, createdAt: 1, kind: "note", text: "untouched" },
    ]);
    old.close();

    const store = openSketchStore({ name });
    const melody = await store.getIdea("melody");
    if (melody?.kind !== "voice" || melody.transcription?.status !== "done") throw new Error("expected a heard melody");
    expect(melody.transcription.clean.map((n) => n.pitch)).toEqual([64]);
    expect(melody.transcription.raw).toEqual(raw);
    expect((await store.getIdea("note"))?.kind).toBe("note");
  });

  describe("layouts", () => {
    it("still reads Sketches, Ideas and arrangements saved before layouts existed", async () => {
      const name = `test-${n++}`;
      const old = new Dexie(name);
      old.version(1).stores({ sketches: "id, updatedAt", ideas: "id, sketchId, [sketchId+order]" });
      old.version(2).stores({ arrangements: "sketchId" });
      await old.table("sketches").add({ id: "s1", title: "From M5", createdAt: 1, updatedAt: 1 });
      await old.table("ideas").add({ id: "i1", sketchId: "s1", order: 0, createdAt: 1, kind: "note", text: "kept" });
      old.close();

      const store = openSketchStore({ name });
      expect((await store.getSketch("s1"))?.title).toBe("From M5");
      expect((await store.listIdeas("s1")).map((i) => i.id)).toEqual(["i1"]);
      expect(await store.getLayout("sketch:s1")).toBeUndefined();
    });

    it("has no layout for a page nothing has been placed on", async () => {
      const store = freshStore();
      expect(await store.getLayout("home")).toBeUndefined();
    });

    it("places a piece anywhere, rounded to whole pixels, keeping the other pieces", async () => {
      const store = freshStore();
      await store.placePiece("home", "capture", { x: 10, y: 20 });
      await store.placePiece("home", "title", { x: -120.4, y: 310.6 });
      expect(await store.getLayout("home")).toEqual({
        id: "home",
        places: { capture: { x: 10, y: 20 }, title: { x: -120, y: 311 } },
      });
    });

    it("moves a piece that was already placed", async () => {
      const store = freshStore();
      await store.placePiece("home", "title", { x: 0, y: 0 });
      await store.placePiece("home", "title", { x: 48, y: 96 });
      expect((await store.getLayout("home"))?.places).toEqual({ title: { x: 48, y: 96 } });
    });

    it("keeps each page's layout apart", async () => {
      const store = freshStore();
      await store.placePiece("home", "title", { x: 1, y: 1 });
      await store.placePiece("sketch:a", "title", { x: 2, y: 2 });
      expect((await store.getLayout("home"))?.places.title).toEqual({ x: 1, y: 1 });
      expect((await store.getLayout("sketch:a"))?.places.title).toEqual({ x: 2, y: 2 });
    });

    it("lays out pieces that have no place yet, leaving placed ones alone", async () => {
      const store = freshStore();
      await store.placePiece("home", "title", { x: 5, y: 5 });
      await store.layOutPieces("home", { title: { x: 999, y: 999 }, capture: { x: 0, y: 120.2 } });
      expect((await store.getLayout("home"))?.places).toEqual({ title: { x: 5, y: 5 }, capture: { x: 0, y: 120 } });
    });

    it("resets a page's layout, leaving other pages alone", async () => {
      const store = freshStore();
      await store.placePiece("sketch:a", "title", { x: 40, y: 80 });
      await store.placePiece("home", "title", { x: 1, y: 1 });
      await store.resetLayout("sketch:a");
      expect(await store.getLayout("sketch:a")).toBeUndefined();
      expect((await store.getLayout("home"))?.places).toEqual({ title: { x: 1, y: 1 } });
    });

    it("doesn't move a sketch up the list when its page is arranged", async () => {
      const store = freshStore();
      const older = await store.createSketch("Older");
      await store.createSketch("Newer");
      await store.placePiece(`sketch:${older.id}`, "title", { x: 0, y: 0 });
      expect((await store.listSketches()).map((s) => s.title)).toEqual(["Newer", "Older"]);
    });

    it("forgets an idea's place when the idea is removed", async () => {
      const store = freshStore();
      const sketch = await store.createSketch("Song");
      const keep = await store.addIdea(sketch.id, { kind: "note", text: "keep" });
      const drop = await store.addIdea(sketch.id, { kind: "note", text: "drop" });
      await store.layOutPieces(`sketch:${sketch.id}`, { [keep.id]: { x: 0, y: 0 }, [drop.id]: { x: 264, y: 0 } });
      await store.removeIdea(drop.id);
      expect((await store.getLayout(`sketch:${sketch.id}`))?.places).toEqual({ [keep.id]: { x: 0, y: 0 } });
    });

    it("forgets a deleted sketch's pages and its place on the home page", async () => {
      const store = freshStore();
      const gone = await store.createSketch("Gone");
      const kept = await store.createSketch("Kept");
      await store.layOutPieces("home", { [gone.id]: { x: 0, y: 0 }, [kept.id]: { x: 264, y: 0 } });
      await store.placePiece(`sketch:${gone.id}`, "title", { x: 0, y: 0 });
      await store.placePiece(`studio:${gone.id}`, "timeline", { x: 0, y: 0 });
      await store.deleteSketch(gone.id);
      expect((await store.getLayout("home"))?.places).toEqual({ [kept.id]: { x: 264, y: 0 } });
      expect(await store.getLayout(`sketch:${gone.id}`)).toBeUndefined();
      expect(await store.getLayout(`studio:${gone.id}`)).toBeUndefined();
    });
  });

  it("renames a sketch, trimming spaces and moving it to the top", async () => {
    const store = freshStore();
    const sketch = await store.createSketch("Sketch, 27 Oct");
    await store.createSketch("Newer");
    await store.renameSketch(sketch.id, "  Bus Window  ");
    const [top] = await store.listSketches();
    expect([top.id, top.title]).toEqual([sketch.id, "Bus Window"]);
  });

  it("keeps the old title when renamed to nothing", async () => {
    const store = freshStore();
    const sketch = await store.createSketch("Keep me");
    await store.renameSketch(sketch.id, "   ");
    expect((await store.getSketch(sketch.id))?.title).toBe("Keep me");
  });

  it("deletes a sketch with all its ideas, leaving other sketches alone", async () => {
    const store = freshStore();
    const { sketch: doomed } = await store.capture(null, { kind: "note", text: "gone" });
    await store.addIdea(doomed.id, { kind: "color", hex: "#000000" });
    const { sketch: kept, idea: keptIdea } = await store.capture(null, { kind: "note", text: "stays" });

    await store.deleteSketch(doomed.id);

    expect(await store.getSketch(doomed.id)).toBeUndefined();
    expect(await store.listIdeas(doomed.id)).toEqual([]);
    expect((await store.listSketches()).map((s) => s.id)).toEqual([kept.id]);
    expect(await store.listIdeas(kept.id)).toEqual([keptIdea]);
  });

  describe("arrangements", () => {
    const project = (name: string): Project => ({
      id: `p-${name}`,
      name,
      bpm: 90,
      key: "C",
      scale: "major",
      timeSignature: [4, 4],
      tracks: [],
      clips: [],
      createdAt: 0,
      updatedAt: 0,
    });

    it("has no arrangement until the studio saves one", async () => {
      const store = freshStore();
      const sketch = await store.createSketch("Song");
      expect(await store.getArrangement(sketch.id)).toBeUndefined();
    });

    it("saves and reads back a Sketch's arrangement, the latest save winning", async () => {
      const store = freshStore();
      const sketch = await store.createSketch("Song");
      await store.saveArrangement(sketch.id, { project: project("first"), heard: { hum1: "60:0:1" } });
      await store.saveArrangement(sketch.id, { project: project("second"), heard: { hum1: "62:0:1" } });

      const saved = await store.getArrangement(sketch.id);
      expect(saved).toMatchObject({ sketchId: sketch.id, project: project("second"), heard: { hum1: "62:0:1" } });
      expect(saved!.savedAt).toBeGreaterThan(0);
    });

    it("keeps each Sketch's arrangement separate", async () => {
      const store = freshStore();
      const a = await store.createSketch("A");
      const b = await store.createSketch("B");
      await store.saveArrangement(a.id, { project: project("a"), heard: {} });
      await store.saveArrangement(b.id, { project: project("b"), heard: {} });
      expect((await store.getArrangement(a.id))!.project.name).toBe("a");
      expect((await store.getArrangement(b.id))!.project.name).toBe("b");
    });

    it("moves the Sketch to the top of the recent list when its arrangement is saved", async () => {
      const store = freshStore();
      const sketch = await store.createSketch("Older");
      await store.createSketch("Newer");
      await store.saveArrangement(sketch.id, { project: project("x"), heard: {} });
      expect((await store.listSketches())[0].id).toBe(sketch.id);
    });

    it("refuses an arrangement for a Sketch that isn't there", async () => {
      const store = freshStore();
      await expect(store.saveArrangement("missing", { project: project("x"), heard: {} })).rejects.toThrow(/not found/);
    });

    it("deletes the arrangement along with its Sketch", async () => {
      const store = freshStore();
      const sketch = await store.createSketch("Song");
      await store.saveArrangement(sketch.id, { project: project("x"), heard: {} });
      await store.deleteSketch(sketch.id);
      expect(await store.getArrangement(sketch.id)).toBeUndefined();
    });

    it("still reads Sketches and Ideas saved before arrangements existed", async () => {
      const name = `test-${n++}`;
      const old = new Dexie(name);
      old.version(1).stores({ sketches: "id, updatedAt", ideas: "id, sketchId, [sketchId+order]" });
      await old.table("sketches").add({ id: "s1", title: "From M2", createdAt: 1, updatedAt: 1 });
      await old.table("ideas").add({ id: "i1", sketchId: "s1", order: 0, createdAt: 1, kind: "note", text: "kept" });
      old.close();

      const store = openSketchStore({ name });
      expect((await store.getSketch("s1"))?.title).toBe("From M2");
      expect((await store.listIdeas("s1")).map((i) => i.id)).toEqual(["i1"]);
      expect(await store.getArrangement("s1")).toBeUndefined();
    });
  });
});
