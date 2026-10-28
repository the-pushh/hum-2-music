"use client";

import { takeOf } from "@/melody/client";
import { decodeMono } from "@/melody/transcribe";
import type { BeatHeard, Grid } from "@/melody/types";
import { sketchStore } from "@/sketches/client";
import type { VoiceIdea } from "@/sketches/types";
import { analysisRate, beatFrames, hopSec } from "./analyse";
import { cleanupBeat } from "./cleanupBeat";
import { hearBeat } from "./hearBeat";

/** Beats often move in sixteenths (hi-hats), so they snap finer than melodies by default. */
export const defaultBeatGrid: Grid = 16;

const inFlight = new Set<string>();

export function isHearingBeat(ideaId: string) {
  return inFlight.has(ideaId);
}

/** Hears a beat take's hits and snaps them to the grid, saving progress on the idea as it goes. */
export async function hearBeatIdea(idea: VoiceIdea): Promise<void> {
  if (inFlight.has(idea.id)) return;
  inFlight.add(idea.id);
  const store = sketchStore();
  try {
    await store.setTranscription(idea.id, { status: "pending" });
    const take = takeOf(idea);
    const raw = hearBeat(beatFrames(await decodeMono(idea.blob, analysisRate)), hopSec, take);
    if (!raw.length) {
      await store.setTranscription(idea.id, { status: "failed", error: "Couldn't hear any hits." });
      return;
    }
    const clean = cleanupBeat(raw, defaultBeatGrid, take);
    await store.setTranscription(idea.id, { status: "done", kind: "beat", raw, clean, grid: defaultBeatGrid, showRaw: false });
  } catch (err) {
    console.error(err);
    const error = err instanceof Error && /decode/i.test(err.message) ? "This recording couldn't be read." : "Couldn't hear the beat.";
    await store.setTranscription(idea.id, { status: "failed", error }).catch(() => {});
  } finally {
    inFlight.delete(idea.id);
  }
}

/** Re-snaps from the stored raw hits with a new grid, or switches raw and snapped. Instant: nothing is heard again. */
export async function changeBeatCleanup(idea: VoiceIdea, changes: { grid?: Grid; showRaw?: boolean }): Promise<void> {
  const t = idea.transcription;
  if (t?.status !== "done" || t.kind !== "beat") return;
  const grid = changes.grid ?? t.grid;
  const next: BeatHeard = { ...t, grid, showRaw: changes.showRaw ?? t.showRaw, clean: cleanupBeat(t.raw, grid, takeOf(idea)) };
  await sketchStore().setTranscription(idea.id, next);
}
