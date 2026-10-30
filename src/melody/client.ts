"use client";

import { useSyncExternalStore } from "react";
import { sketchStore } from "@/sketches/client";
import type { VoiceIdea } from "@/sketches/types";
import { cleanup } from "./cleanup";
import { transcribe } from "./transcribe";
import { defaultCleanupSettings, referenceBpm, type CleanupSettings, type Take } from "./types";

/** How far a transcription has got: getting the take and the model ready, then the share of the take heard so far. */
export type TranscribeProgress = { stage: "starting" } | { stage: "hearing"; heard: number };

/** Transcriptions running in this tab, oldest first. Kept in memory: progress is too frequent to save, and dies with the tab. */
const inFlight = new Map<string, TranscribeProgress>();
const listeners = new Set<() => void>();

function setProgress(ideaId: string, progress: TranscribeProgress | undefined) {
  if (progress) inFlight.set(ideaId, progress);
  else inFlight.delete(ideaId);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** The progress of one idea's transcription, or of the latest one started when no idea is given. Undefined when none is running. */
export function useTranscribeProgress(ideaId?: string): TranscribeProgress | undefined {
  const snapshot = () => (ideaId ? inFlight.get(ideaId) : [...inFlight.values()].at(-1));
  return useSyncExternalStore(subscribe, snapshot, () => undefined);
}

/** The take's tempo, click and key. Takes from before M2 were free takes. */
export function takeOf(idea: VoiceIdea): Take {
  return idea.take ?? { bpm: referenceBpm, click: false };
}

/** A vocalized drum beat rather than a hummed melody. */
export function isBeat(idea: VoiceIdea): boolean {
  return takeOf(idea).mode === "beat";
}

export function isTranscribing(ideaId: string) {
  return inFlight.has(ideaId);
}

/** Transcribes a voice idea and cleans up its notes, saving progress on the idea as it goes. */
export async function transcribeIdea(idea: VoiceIdea): Promise<void> {
  if (inFlight.has(idea.id)) return;
  setProgress(idea.id, { stage: "starting" });
  const store = sketchStore();
  try {
    await store.setTranscription(idea.id, { status: "pending" });
    const take = takeOf(idea);
    const raw = await transcribe(idea.blob, take.bpm, (heard) => setProgress(idea.id, { stage: "hearing", heard }));
    const settings: CleanupSettings = { ...defaultCleanupSettings, key: take.key ?? "auto" };
    const { notes, key } = cleanup(raw, settings, take);
    await store.setTranscription(idea.id, { status: "done", raw, clean: notes, key, settings, showRaw: false });
  } catch (err) {
    console.error(err);
    const error = err instanceof Error && /decode/i.test(err.message) ? "This recording couldn't be read." : "Couldn't hear the notes.";
    await store.setTranscription(idea.id, { status: "failed", error }).catch(() => {});
  } finally {
    setProgress(idea.id, undefined);
  }
}

/** Re-runs cleanup from the stored raw notes with new settings. No transcription needed, so it's instant. */
export async function changeCleanup(idea: VoiceIdea, changes: Partial<CleanupSettings> & { showRaw?: boolean }): Promise<void> {
  const t = idea.transcription;
  if (t?.status !== "done" || t.kind === "beat") return;
  const { showRaw = t.showRaw, ...settingChanges } = changes;
  const settings = { ...t.settings, ...settingChanges };
  const { notes, key } = cleanup(t.raw, settings, takeOf(idea));
  await sketchStore().setTranscription(idea.id, { ...t, clean: notes, key, settings, showRaw });
}
