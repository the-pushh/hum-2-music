"use client";

import * as Tone from "tone";
import { tone } from "@/audio/tone";
import { audioEngine } from "./audio/engine";
import { playoutManager } from "./audio/playout";
import { projectEndBar } from "./audio/scheduler";
import { usePlaybackStore } from "./store/playback";
import type { Project } from "./types";

/** Plays the arrangement from the top, looping over its length. Call it from a tap. */
export async function playProject(project: Project): Promise<void> {
  await tone();
  await audioEngine.initialize();
  await playoutManager.initialize();
  const transport = Tone.getTransport();
  transport.stop();
  audioEngine.setBpm(project.bpm);
  audioEngine.setTimeSignature(...project.timeSignature);
  audioEngine.setLoop(true, 0, Math.max(1, projectEndBar(project)));
  await playoutManager.scheduleProject(project);
  audioEngine.play(0);
  usePlaybackStore.getState().play();
}

export function stopProject(): void {
  if (!audioEngine.isReady()) return;
  audioEngine.stop();
  playoutManager.clearAllScheduled();
  usePlaybackStore.getState().stop();
}
