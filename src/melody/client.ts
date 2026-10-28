"use client";

import { sketchStore } from "@/sketches/client";
import type { VoiceIdea } from "@/sketches/types";
import { cleanup } from "./cleanup";
import { transcribe } from "./transcribe";
import { defaultCleanupSettings, referenceBpm, type CleanupSettings, type Take } from "./types";

const inFlight = new Set<string>();

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
  inFlight.add(idea.id);
  const store = sketchStore();
  try {
    await store.setTranscription(idea.id, { status: "pending" });
    const take = takeOf(idea);
    const raw = await transcribe(idea.blob, take.bpm);
    const settings: CleanupSettings = { ...defaultCleanupSettings, key: take.key ?? "auto" };
    const { notes, key } = cleanup(raw, settings, take);
    await store.setTranscription(idea.id, { status: "done", raw, clean: notes, key, settings, showRaw: false });
  } catch (err) {
    console.error(err);
    const error = err instanceof Error && /decode/i.test(err.message) ? "This recording couldn't be read." : "Couldn't hear the notes.";
    await store.setTranscription(idea.id, { status: "failed", error }).catch(() => {});
  } finally {
    inFlight.delete(idea.id);
  }
}

/** Re-runs cleanup from the stored raw notes with new settings. No transcription needed, so it's instant. */
export async function changeCleanup(idea: VoiceIdea, changes: Partial<CleanupSettings> & { showRaw?: boolean }): Promise<void> {
  const t = idea.transcription;
  if (t?.status !== "done") return;
  const { showRaw = t.showRaw, ...settingChanges } = changes;
  const settings = { ...t.settings, ...settingChanges };
  const { notes, key } = cleanup(t.raw, settings, takeOf(idea));
  await sketchStore().setTranscription(idea.id, { ...t, clean: notes, key, settings, showRaw });
}
