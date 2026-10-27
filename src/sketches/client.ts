"use client";

import { openSketchStore, type SketchStore } from "./store";
import type { IdeaInput } from "./types";

let store: SketchStore | undefined;
let persistRequested = false;

/** The browser's one Sketch store. Opened lazily so nothing touches IndexedDB during server rendering. */
export function sketchStore(): SketchStore {
  store ??= openSketchStore();
  return store;
}

/** Captures an idea, then asks the browser not to evict hum's data (Safari clears unpersisted storage after ~7 days). */
export async function captureIdea(openSketchId: string | null, input: IdeaInput) {
  const result = await sketchStore().capture(openSketchId, input);
  if (!persistRequested) {
    persistRequested = true;
    void navigator.storage?.persist?.().catch(() => {});
  }
  return result;
}
