"use client";

import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import RecordPlugin from "wavesurfer.js/dist/plugins/record.esm.js";
import { Microphone, Stop } from "@phosphor-icons/react";
import { analyseRecording } from "@/audio/analyse";
import { formatDuration } from "@/audio/formatDuration";
import { diagnoseMicFailure } from "@/audio/micErrorMessage";
import { pickRecordingMime } from "@/audio/recordingFormat";
import { waveformBars } from "@/audio/waveformStyle";
import { tokenColor } from "@/ui/tokenColor";
import type { VoiceInput } from "@/sketches/types";

type Status = "idle" | "starting" | "recording" | "saving";
type Props = {
  /** Saves the hum. `stillMounted` is false when the recorder was closed mid-take, so callers can skip navigation. */
  onSave: (voice: VoiceInput, stillMounted: boolean) => Promise<void>;
};

const statusText: Record<Status, string> = {
  idle: "Tap to hum an idea",
  starting: "Starting the mic",
  recording: "Recording, tap to stop and save",
  saving: "Saving your hum",
};

export function Recorder({ onSave }: Props) {
  const waveRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const recordRef = useRef<RecordPlugin | null>(null);
  const elapsedRef = useRef(0);
  const mountedRef = useRef(true);
  const savingRef = useRef(false);
  /** Audio so far, in 1 s chunks, so a take interrupted by a locked screen can still be saved. */
  const chunksRef = useRef<Blob[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Phones suspend a hidden page (screen lock, app switch) and may never deliver the recorder's final data.
  // Save what's been recorded so far as soon as the page is hidden.
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === "hidden" && recordRef.current?.isRecording()) saveSoFar();
    };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", onHidden);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", onHidden);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Leaving the page mid-take still keeps the hum: stopping fires record-end, whose handler saves and then
      // releases the mic. Tearing down first would drop record-end and lose the take.
      const record = recordRef.current;
      if (record?.isRecording() || record?.isPaused()) record.stopRecording();
      else if (!savingRef.current) teardown();
    };
  }, []);


  function teardown() {
    recordRef.current?.stopMic();
    wsRef.current?.destroy();
    wsRef.current = null;
    recordRef.current = null;
  }

  async function start() {
    if (!waveRef.current) return;
    setError(null);
    setElapsed(0);
    elapsedRef.current = 0;
    setStatus("starting");
    const ws = WaveSurfer.create({
      container: waveRef.current,
      ...waveformBars,
      waveColor: tokenColor("accent"),
      interact: false,
    });
    const mime = pickRecordingMime();
    const record = ws.registerPlugin(
      RecordPlugin.create({
        mimeType: mime,
        scrollingWaveform: true,
        renderRecordedAudio: false,
        mediaRecorderTimeslice: 1000,
      }),
    );
    chunksRef.current = [];
    wsRef.current = ws;
    recordRef.current = record;
    record.on("record-progress", (ms) => {
      elapsedRef.current = ms / 1000;
      if (mountedRef.current) setElapsed(ms / 1000);
    });
    record.on("record-data-available", (chunk) => chunk.size && chunksRef.current.push(chunk));
    record.on("record-end", (blob) => {
      // If the take was already saved from chunks (page hidden), teardown cleared recordRef: don't save it twice.
      if (recordRef.current === record) void save(blob, mime);
    });
    try {
      await record.startRecording();
      if (mountedRef.current) setStatus("recording");
    } catch (e) {
      teardown();
      const message = await diagnoseMicFailure(e);
      if (!mountedRef.current) return;
      setStatus("idle");
      setError(message);
    }
  }

  function stop() {
    savingRef.current = true;
    setStatus("saving");
    recordRef.current?.stopRecording();
  }

  /** Saves the chunks recorded so far and releases the mic, without waiting for the recorder to finish. */
  function saveSoFar() {
    const chunks = chunksRef.current;
    if (!chunks.length) return void recordRef.current?.stopRecording();
    const mime = chunks[0].type || pickRecordingMime();
    savingRef.current = true;
    if (mountedRef.current) setStatus("saving");
    void save(new Blob(chunks, { type: mime }), mime);
  }

  async function save(blob: Blob, requestedMime: string | undefined) {
    savingRef.current = true;
    teardown();
    const mime = blob.type || requestedMime || "audio/webm";
    // If decoding fails, keep the hum anyway with the timer's length and no waveform.
    const analysis = await analyseRecording(blob).catch(() => ({ durationSec: elapsedRef.current, peaks: [] }));
    try {
      await onSave({ kind: "voice", blob, mime, ...analysis }, mountedRef.current);
    } catch {
      if (mountedRef.current) setError("The hum couldn't be saved to this browser's storage. Try recording again.");
    } finally {
      savingRef.current = false;
      if (mountedRef.current) setStatus("idle");
    }
  }

  const live = status === "recording" || status === "starting";

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className={`flex w-full items-center gap-3 rounded-2xl bg-surface p-3 ${live ? "" : "hidden"}`}>
        <span className="font-mono text-sm text-ink tabular-nums">{formatDuration(elapsed)}</span>
        <div ref={waveRef} className="h-12 flex-1" aria-hidden />
      </div>
      <button
        type="button"
        onClick={live ? stop : start}
        disabled={status === "starting" || status === "saving"}
        aria-pressed={live}
        className="inline-flex size-24 items-center justify-center rounded-full bg-accent text-accent-ink transition duration-300 ease-soft hover:opacity-90 active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink disabled:opacity-50"
      >
        {live ? <Stop size={32} weight="fill" aria-hidden /> : <Microphone size={32} weight="fill" aria-hidden />}
        <span className="sr-only">{live ? "Stop and save recording" : "Record"}</span>
      </button>
      <p className="text-sm text-ink-muted" aria-live="polite">
        {statusText[status]}
      </p>
      {error && (
        <p role="alert" className="text-sm text-accent">
          {error}
        </p>
      )}
    </div>
  );
}
