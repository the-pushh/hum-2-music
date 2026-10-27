import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { openSketchStore } from "./store";

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
});
