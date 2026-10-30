"use client";

import { hearBeatIdea } from "@/beat/client";
import { isBeat, transcribeIdea } from "@/melody/client";
import { sketchStore } from "@/sketches/client";
import type { VoiceIdea } from "@/sketches/types";
import { analyseRecording } from "./analyse";

const finishing = new Set<string>();

/** Whether a just-saved take is still having its waveform worked out, before hum starts hearing it. */
export function isFinishing(ideaId: string) {
  return finishing.has(ideaId);
}

/**
 * Everything a take needs after it's saved, one at a time, so its page opens the moment recording stops: first its
 * real length and waveform, then the notes or hits hum hears in it. Each step decodes the whole take, so they take
 * turns rather than racing each other and the page.
 */
export async function finishTake(idea: VoiceIdea): Promise<void> {
  finishing.add(idea.id);
  try {
    const waveform = await analyseRecording(idea.blob);
    await sketchStore().setWaveform(idea.id, waveform);
  } catch {
    // The card decodes the take itself to draw it, and the timer's length stands.
  } finally {
    finishing.delete(idea.id);
  }
  await (isBeat(idea) ? hearBeatIdea(idea) : transcribeIdea(idea));
}
