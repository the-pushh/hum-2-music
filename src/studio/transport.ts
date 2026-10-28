"use client";

import * as Tone from "tone";
import { startedPlaying, stoppedPlaying } from "@/audio/exclusivePlayback";
import { tone } from "@/audio/tone";
import { audioEngine } from "./audio/engine";
import { playoutManager } from "./audio/playout";
import { projectEndBar } from "./audio/scheduler";
import { usePlaybackStore } from "./store/playback";
import { useProjectStore } from "./store/project";
import type { Project } from "./types";

/** Bars the transport covers even when the arrangement is shorter, so an empty studio still has a grid. */
export const minBars = 4;

/** How many bars the arrangement takes, at least `minBars`. */
export function arrangementBars(project: Project): number {
  return Math.max(minBars, projectEndBar(project));
}

let unfollow: (() => void) | null = null;
let stopAtEnd: number | null = null;

/** Applies the arrangement's tempo, loop and notes to the transport. */
async function schedule(project: Project) {
  const transport = Tone.getTransport();
  const bars = arrangementBars(project);
  const loop = usePlaybackStore.getState().loopEnabled;
  audioEngine.setBpm(project.bpm);
  audioEngine.setTimeSignature(...project.timeSignature);
  audioEngine.setLoop(loop, 0, bars);
  if (stopAtEnd !== null) transport.clear(stopAtEnd);
  stopAtEnd = loop ? null : transport.scheduleOnce(() => queueMicrotask(stopProject), audioEngine.barToSeconds(bars));
  await playoutManager.scheduleProject(project);
}

/** The studio as one player, so it and a voice card's hum or piano never play over each other. */
const player = { pause: () => stopProject() };

/**
 * Plays the arrangement from the top. Edits while playing are heard straight away. Call it from a tap.
 * The first play waits for the piano and drum samples, which are cached for offline use after that.
 */
export async function playProject(project: Project): Promise<void> {
  startedPlaying(player);
  await tone();
  await audioEngine.initialize();
  await playoutManager.initialize();
  Tone.getTransport().stop();
  await schedule(project);
  audioEngine.play(0);
  usePlaybackStore.getState().play();
  follow();
}

export function stopProject(): void {
  stoppedPlaying(player);
  unfollow?.();
  unfollow = null;
  if (!audioEngine.isReady()) return;
  audioEngine.stop();
  playoutManager.clearAllScheduled();
  usePlaybackStore.getState().stop();
}

/** While playing, mixer moves apply at once and note, tempo or loop changes are rescheduled. */
function follow() {
  unfollow?.();
  let pending: ReturnType<typeof setTimeout> | undefined;
  const reschedule = () => {
    clearTimeout(pending);
    pending = setTimeout(() => {
      const project = useProjectStore.getState().project;
      if (project && usePlaybackStore.getState().isPlaying) void schedule(project);
    }, 60);
  };
  const offProject = useProjectStore.subscribe((state, previous) => {
    const next = state.project;
    const prev = previous.project;
    if (!next || next === prev) return;
    if (next.tracks !== prev?.tracks) playoutManager.applyMixState(next.tracks);
    if (next.clips !== prev?.clips || next.bpm !== prev?.bpm || next.tracks.length !== prev?.tracks.length) reschedule();
  });
  const offLoop = usePlaybackStore.subscribe((state, previous) => {
    if (state.loopEnabled !== previous.loopEnabled) reschedule();
  });
  unfollow = () => {
    clearTimeout(pending);
    offProject();
    offLoop();
  };
}

/** Where the playhead is, in bars from the start. */
export function playheadBars(): number {
  return audioEngine.isReady() ? audioEngine.getCurrentBar() : 0;
}
