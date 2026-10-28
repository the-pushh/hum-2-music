"use client";

import type { TranscribeRequest, TranscribeResponse } from "./transcribe.worker";
import type { Note } from "./types";

const modelRate = 22050;

let worker: Worker | undefined;
let nextId = 0;
const waiting = new Map<number, { resolve: (r: TranscribeResponse) => void }>();

function transcriber(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./transcribe.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = ({ data }: MessageEvent<TranscribeResponse>) => {
      if (data.id === -1 && "error" in data) return failAll(data.error);
      waiting.get(data.id)?.resolve(data);
      waiting.delete(data.id);
    };
    worker.onerror = (e) => failAll(e.message || "The transcriber didn't start");
  }
  return worker;
}

/** A broken worker fails every request waiting on it; the next request starts a fresh one. */
function failAll(error: string) {
  waiting.forEach(({ resolve }, id) => resolve({ id, error }));
  waiting.clear();
  worker?.terminate();
  worker = undefined;
}

/** Decodes a take and mixes it down to mono at the model's sample rate. AudioContext isn't available in workers, so this runs here. */
async function decodeForModel(blob: Blob): Promise<Float32Array> {
  const ctx = new AudioContext();
  try {
    const audio = await ctx.decodeAudioData(await blob.arrayBuffer());
    const offline = new OfflineAudioContext(1, Math.max(1, Math.ceil(audio.duration * modelRate)), modelRate);
    const source = offline.createBufferSource();
    source.buffer = audio;
    source.connect(offline.destination);
    source.start();
    return (await offline.startRendering()).getChannelData(0);
  } finally {
    void ctx.close();
  }
}

/** Hears the notes in a take, in beats at the take's tempo. Runs the model in a worker so the app keeps responding. */
export async function transcribe(blob: Blob, bpm: number): Promise<Note[]> {
  const samples = await decodeForModel(blob);
  const id = nextId++;
  const response = await new Promise<TranscribeResponse>((resolve) => {
    waiting.set(id, { resolve });
    transcriber().postMessage({ id, samples } satisfies TranscribeRequest, [samples.buffer]);
  });
  if ("error" in response) throw new Error(response.error);
  const beatsPerSec = bpm / 60;
  return response.notes
    .map((n) => ({ pitch: n.pitch, start: n.startSec * beatsPerSec, duration: n.durationSec * beatsPerSec, velocity: n.amplitude }))
    .sort((a, b) => a.start - b.start);
}
