import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
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
    expect(sketch.title).toBe("Sketch, 27 Oct");
    expect(await store.listSketches()).toEqual([sketch]);
    expect(await store.listIdeas(sketch.id)).toEqual([idea]);
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
});
