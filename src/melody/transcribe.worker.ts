/// <reference lib="webworker" />
import * as tf from "@tensorflow/tfjs";
import { voiceRangeHz } from "./types";
import { addPitchBendsToNoteEvents, BasicPitch, noteFramesToTime, outputToNotesPoly } from "@spotify/basic-pitch";

/** What the worker is sent: a take decoded to mono at basic-pitch's 22050 Hz. */
export type TranscribeRequest = { id: number; samples: Float32Array };
/** Notes in seconds, as basic-pitch hears them. */
export type HeardNote = { pitch: number; startSec: number; durationSec: number; amplitude: number };
/** The share of the take heard so far, sent as the model works through it, then the notes or an error. */
export type TranscribeProgress = { id: number; progress: number };
export type TranscribeResponse = { id: number; notes: HeardNote[] } | { id: number; error: string };

// TF.js 3's browser timer checks `!window`, which throws in a worker. It only needs a truthy global.
(self as unknown as { window: typeof self }).window ??= self;


let basicPitch: Promise<BasicPitch> | undefined;

function load(): Promise<BasicPitch> {
  basicPitch ??= (async () => {
    // WebGL in a worker needs OffscreenCanvas; fall back to the CPU where there's none.
    if (!(await tf.setBackend("webgl").catch(() => false))) await tf.setBackend("cpu");
    await tf.ready();
    return new BasicPitch(tf.loadGraphModel("/models/basic-pitch/model.json"));
  })();
  return basicPitch;
}

/** Some phone GPUs start WebGL fine but can't compile the model's shaders mid-run. Move to the CPU for good. */
async function fallBackToCpu(): Promise<boolean> {
  if (tf.getBackend() === "cpu") return false;
  basicPitch = (async () => {
    await tf.setBackend("cpu");
    await tf.ready();
    return new BasicPitch(tf.loadGraphModel("/models/basic-pitch/model.json"));
  })();
  return true;
}

async function hear(samples: Float32Array, onProgress: (heard: number) => void): Promise<HeardNote[]> {
  const model = await load();
  const frames: number[][] = [];
  const onsets: number[][] = [];
  const contours: number[][] = [];
  await model.evaluateModel(
    samples,
    (f, o, c) => {
      frames.push(...f);
      onsets.push(...o);
      contours.push(...c);
    },
    onProgress,
  );
  const events = outputToNotesPoly(frames, onsets, 0.5, 0.3, 5, true, voiceRangeHz.high, voiceRangeHz.low);
  return noteFramesToTime(addPitchBendsToNoteEvents(contours, events)).map((n) => ({
    pitch: n.pitchMidi,
    startSec: n.startTimeSeconds,
    durationSec: n.durationSeconds,
    amplitude: n.amplitude,
  }));
}

// Errors outside a request (a library failing to load) would otherwise leave every request waiting forever.
self.addEventListener("unhandledrejection", (e) => {
  self.postMessage({ id: -1, error: String(e.reason) } satisfies TranscribeResponse);
});

self.onmessage = async ({ data }: MessageEvent<TranscribeRequest>) => {
  try {
    const onProgress = (progress: number) => self.postMessage({ id: data.id, progress } satisfies TranscribeProgress);
    let notes: HeardNote[];
    try {
      notes = await hear(data.samples, onProgress);
    } catch (err) {
      if (!(await fallBackToCpu())) throw err;
      notes = await hear(data.samples, onProgress);
    }
    self.postMessage({ id: data.id, notes } satisfies TranscribeResponse);
  } catch (err) {
    self.postMessage({ id: data.id, error: err instanceof Error ? err.message : String(err) } satisfies TranscribeResponse);
  }
};
