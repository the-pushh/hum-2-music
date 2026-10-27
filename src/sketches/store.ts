import Dexie, { type EntityTable } from "dexie";
import type { Idea, IdeaInput, Sketch } from "./types";

type HumDb = Dexie & {
  sketches: EntityTable<Sketch, "id">;
  ideas: EntityTable<Idea, "id">;
};

const dayMonth = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

type Options = { name?: string; now?: () => number };

export function openSketchStore({ name = "hum", now = Date.now }: Options = {}) {
  const db = new Dexie(name) as HumDb;
  db.version(1).stores({
    sketches: "id, updatedAt",
    ideas: "id, sketchId, [sketchId+order]",
  });

  async function createSketch(title: string): Promise<Sketch> {
    const t = now();
    const sketch: Sketch = { id: crypto.randomUUID(), title, createdAt: t, updatedAt: t };
    await db.sketches.add(sketch);
    return sketch;
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

  async function removeIdea(id: string): Promise<void> {
    await db.ideas.delete(id);
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

  return { createSketch, getSketch, listSketches, addIdea, getIdea, listIdeas, updateIdea, removeIdea, capture };
}

export type SketchStore = ReturnType<typeof openSketchStore>;
