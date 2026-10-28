"use client";

import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { sketchStore } from "@/sketches/client";
import type { Sketch } from "@/sketches/types";
import { heardOf, refreshHum, sketchToProject, staleHums, type HeardIdea } from "./sketchToProject";
import { useProjectStore } from "./store/project";

/** Edits are saved this long after the last one, so a drag saves once rather than every frame. */
const saveDelayMs = 400;

type State =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; sketch: Sketch; stale: HeardIdea[] }
  | { status: "error"; message: string };

/**
 * Opens a Sketch's arrangement in the studio's project store: the saved one, or a new one built from its hums.
 * Every edit after that is saved back to the Sketch store. Hums transcribed since the last save are offered as stale.
 */
export function useArrangement(sketchId: string) {
  const sketch = useLiveQuery(async () => (await sketchStore().getSketch(sketchId)) ?? null, [sketchId]);
  const ideas = useLiveQuery(() => sketchStore().listIdeas(sketchId), [sketchId]);
  const [opened, setOpened] = useState<string | null>(null);
  const [heard, setHeard] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  /** The autosave reads this, so it always saves the latest hums without resubscribing. */
  const heardRef = useRef(heard);
  useEffect(() => {
    heardRef.current = heard;
  }, [heard]);

  // Load once per Sketch.
  useEffect(() => {
    if (!sketch || !ideas || opened === sketchId) return;
    let cancelled = false;
    void (async () => {
      const saved = await sketchStore().getArrangement(sketchId);
      if (cancelled) return;
      const project = saved?.project ?? sketchToProject(sketch, ideas);
      const savedHeard = saved?.heard ?? heardOf(ideas);
      useProjectStore.getState().loadProject(project);
      useProjectStore.temporal.getState().clear();
      setHeard(savedHeard);
      setOpened(sketchId);
      if (!saved) await sketchStore().saveArrangement(sketchId, { project, heard: savedHeard });
    })();
    return () => {
      cancelled = true;
    };
  }, [sketch, ideas, sketchId, opened]);

  // Save every change once loaded.
  useEffect(() => {
    if (opened !== sketchId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = useProjectStore.subscribe((state, previous) => {
      if (!state.project || state.project === previous.project) return;
      const project = state.project;
      clearTimeout(timer);
      timer = setTimeout(() => {
        sketchStore()
          .saveArrangement(sketchId, { project, heard: heardRef.current })
          .then(() => setSaveError(null))
          .catch(() => setSaveError("Your changes couldn't be saved to this browser's storage. Keep the page open and try again."));
      }, saveDelayMs);
    });
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [opened, sketchId]);

  /** Replaces the stale hums' tracks with their latest notes. */
  function refresh(stale: HeardIdea[]) {
    const store = useProjectStore.getState();
    if (!store.project) return;
    const next = { ...heardRef.current, ...heardOf(stale) };
    // Set the ref first: loading the project triggers the autosave, which must save the new hums with it.
    heardRef.current = next;
    setHeard(next);
    store.loadProject(stale.reduce(refreshHum, store.project));
  }

  /** Keeps the tracks as they are and stops offering these hums. */
  function keep(stale: HeardIdea[]) {
    const next = { ...heardRef.current, ...heardOf(stale) };
    heardRef.current = next;
    setHeard(next);
    const project = useProjectStore.getState().project;
    if (!project) return;
    sketchStore()
      .saveArrangement(sketchId, { project, heard: next })
      .catch(() => setSaveError("Your choice couldn't be saved to this browser's storage. Keep the page open and try again."));
  }

  let state: State;
  if (sketch === null) state = { status: "missing" };
  else if (!sketch || !ideas || opened !== sketchId) state = { status: "loading" };
  else state = { status: "ready", sketch, stale: staleHums({ project: useProjectStore.getState().project!, heard }, ideas) };
  if (saveError) state = { status: "error", message: saveError };

  return { state, refresh, keep };
}
