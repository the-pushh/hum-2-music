import Dexie, { type EntityTable } from "dexie";
import type { Transcription } from "@/melody/types";
import type { Arrangement, ArrangementInput, Idea, IdeaInput, Sketch, VoiceIdea } from "./types";

type HumDb = Dexie & {
  sketches: EntityTable<Sketch, "id">;
  ideas: EntityTable<Idea, "id">;
  arrangements: EntityTable<Arrangement, "sketchId">;
};

const dayMonth = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

type Options = { name?: string; now?: () => number };

export function openSketchStore({ name = "hum", now = Date.now }: Options = {}) {
  const db = new Dexie(name) as HumDb;
  db.version(1).stores({
    sketches: "id, updatedAt",
    ideas: "id, sketchId, [sketchId+order]",
  });
  db.version(2).stores({ arrangements: "sketchId" });

  async function createSketch(title: string): Promise<Sketch> {
    const t = now();
    const sketch: Sketch = { id: crypto.randomUUID(), title, createdAt: t, updatedAt: t };
    await db.sketches.add(sketch);
    return sketch;
  }

  /** Renames a sketch. A blank name is ignored, so a sketch always has a title. */
  async function renameSketch(id: string, title: string): Promise<void> {
    const trimmed = title.trim();
    if (!trimmed) return;
    await db.sketches.update(id, { title: trimmed, updatedAt: now() });
  }

  /** Deletes a sketch with every idea in it and its arrangement. */
  async function deleteSketch(id: string): Promise<void> {
    await db.transaction("rw", db.sketches, db.ideas, db.arrangements, async () => {
      await db.ideas.where("sketchId").equals(id).delete();
      await db.arrangements.delete(id);
      await db.sketches.delete(id);
    });
  }

  function listSketches(): Promise<Sketch[]> {
    return db.sketches.orderBy("updatedAt").reverse().toArray();
  }

  function getSketch(id: string): Promise<Sketch | undefined> {
    return db.sketches.get(id);
  }

  async function addIdea(sketchId: string, input: IdeaInput): Promise<Idea> {
    return db.transaction("rw", db.sketches, db.ideas, async () => {
      const t = now();
      const last = await ideasInOrder(sketchId).last();
      const idea: Idea = { ...input, id: crypto.randomUUID(), sketchId, order: (last?.order ?? -1) + 1, createdAt: t };
      await db.ideas.add(idea);
      await db.sketches.update(sketchId, { updatedAt: t });
      return idea;
    });
  }

  function ideasInOrder(sketchId: string) {
    return db.ideas.where("[sketchId+order]").between([sketchId, Dexie.minKey], [sketchId, Dexie.maxKey]);
  }

  function listIdeas(sketchId: string): Promise<Idea[]> {
    return ideasInOrder(sketchId).toArray();
  }

  function getIdea(id: string): Promise<Idea | undefined> {
    return db.ideas.get(id);
  }

  /** Replaces an idea's content (same kind), keeping its place in the sketch. */
  async function updateIdea(id: string, input: IdeaInput): Promise<void> {
    await db.transaction("rw", db.sketches, db.ideas, async () => {
      const idea = await db.ideas.get(id);
      if (!idea) throw new Error(`Idea ${id} not found`);
      if (idea.kind !== input.kind) throw new Error(`Idea ${id} is ${idea.kind}, not ${input.kind}`);
      const { sketchId, order, createdAt } = idea;
      await db.ideas.put({ ...input, id, sketchId, order, createdAt });
      await db.sketches.update(sketchId, { updatedAt: now() });
    });
  }

  /** Sets a voice idea's transcription without touching its audio. Not an edit, so the sketch keeps its place in the list. */
  async function setTranscription(id: string, transcription: Transcription): Promise<void> {
    await db.transaction("rw", db.ideas, async () => {
      const idea = await db.ideas.get(id);
      if (!idea) throw new Error(`Idea ${id} not found`);
      if (idea.kind !== "voice") throw new Error(`Idea ${id} is ${idea.kind}, not voice`);
      const voice: VoiceIdea = { ...idea, transcription };
      await db.ideas.put(voice);
    });
  }

  /** Moves an idea to a position in its sketch (clamped to the ends) and renumbers the rest 0..n-1. */
  async function moveIdea(id: string, toIndex: number): Promise<void> {
    await db.transaction("rw", db.sketches, db.ideas, async () => {
      const idea = await db.ideas.get(id);
      if (!idea) throw new Error(`Idea ${id} not found`);
      const rest = (await listIdeas(idea.sketchId)).filter((i) => i.id !== id);
      const at = Math.max(0, Math.min(toIndex, rest.length));
      const reordered = [...rest.slice(0, at), idea, ...rest.slice(at)];
      await db.ideas.bulkUpdate(reordered.map((i, order) => ({ key: i.id, changes: { order } })));
      await db.sketches.update(idea.sketchId, { updatedAt: now() });
    });
  }

  async function removeIdea(id: string): Promise<void> {
    await db.ideas.delete(id);
  }

  function getArrangement(sketchId: string): Promise<Arrangement | undefined> {
    return db.arrangements.get(sketchId);
  }

  /** Saves the studio's arrangement for a sketch, replacing the last one, and moves the sketch to the top. */
  async function saveArrangement(sketchId: string, input: ArrangementInput): Promise<void> {
    await db.transaction("rw", db.sketches, db.arrangements, async () => {
      if (!(await getSketch(sketchId))) throw new Error(`Sketch ${sketchId} not found`);
      const t = now();
      await db.arrangements.put({ ...input, sketchId, savedAt: t });
      await db.sketches.update(sketchId, { updatedAt: t });
    });
  }

  /** Adds an idea to the open sketch, or starts a new one when nothing is open. All or nothing. */
  function capture(openSketchId: string | null, input: IdeaInput): Promise<{ sketch: Sketch; idea: Idea }> {
    return db.transaction("rw", db.sketches, db.ideas, async () => {
      const sketchId = openSketchId ?? (await createSketch(`Sketch, ${dayMonth.format(now())}`)).id;
      if (!(await getSketch(sketchId))) throw new Error(`Sketch ${sketchId} not found`);
      const idea = await addIdea(sketchId, input);
      return { sketch: (await getSketch(sketchId))!, idea };
    });
  }

  return { createSketch, getSketch, renameSketch, deleteSketch, listSketches, addIdea, getIdea, listIdeas, updateIdea, setTranscription, moveIdea, removeIdea, capture, getArrangement, saveArrangement };
}

export type SketchStore = ReturnType<typeof openSketchStore>;
