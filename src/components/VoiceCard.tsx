"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useWavesurfer } from "@wavesurfer/react";
import { Pause, Play } from "@phosphor-icons/react";
import { startedPlaying, stoppedPlaying } from "@/audio/exclusivePlayback";
import { isFinishing } from "@/audio/finishTake";
import { formatDuration } from "@/audio/formatDuration";
import { waveformBars } from "@/audio/waveformStyle";
import { tokenColor } from "@/ui/tokenColor";
import type { VoiceIdea } from "@/sketches/types";
import { isBeat } from "@/melody/client";
import { beatBg, ideaBg, onColorButton } from "@/ui/ideaColors";
import { BeatPanel } from "./BeatPanel";
import { MelodyPanel } from "./MelodyPanel";

const SEEK_STEP_SEC = 5;

/** A recorded take: a hummed melody (lime) or a vocalized beat (cyan), with its waveform and what hum heard in it. */
export function VoiceCard({ idea }: { idea: VoiceIdea }) {
  const beat = isBeat(idea);
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  // A voice Idea's audio never changes for a given id, and its peaks only once: when a just-saved take's waveform
  // arrives. So everything below is keyed on idea.id and whether there are peaks. Live queries hand back fresh objects
  // on every read, and wavesurfer rebuilds itself whenever an option changes identity, so depending on the objects
  // themselves loops forever.
  const { blob, peaks: rawPeaks, durationSec } = idea;
  const hasPeaks = rawPeaks.length > 0;
  const peaks = useMemo(() => (hasPeaks ? [rawPeaks] : undefined), [idea.id, hasPeaks]); // eslint-disable-line react-hooks/exhaustive-deps
  // A take saved a moment ago gets its waveform shortly: show a skeleton till then rather than decoding it twice.
  const waiting = !hasPeaks && isFinishing(idea.id);
  // Dark on the card's lime: the unplayed part faint, the played part solid.
  const colors = useMemo(() => ({ wave: `${tokenColor("canvas")}59`, progress: tokenColor("canvas"), cursor: tokenColor("canvas") }), []);

  const { wavesurfer, isPlaying, currentTime } = useWavesurfer({
    container: containerRef,
    peaks,
    duration: durationSec,
    ...waveformBars,
    waveColor: colors.wave,
    progressColor: colors.progress,
    cursorColor: colors.cursor,
  });

  // wavesurfer owns the blob's object URL, not a memoised URL.createObjectURL: StrictMode re-runs effects,
  // and a memoised URL gets revoked by the first cleanup while the memo keeps handing it back.
  useEffect(() => {
    if (!waiting) wavesurfer?.loadBlob(blob, peaks, durationSec).catch(() => setFailed(true));
  }, [wavesurfer, idea.id, waiting]); // eslint-disable-line react-hooks/exhaustive-deps

  // One hum at a time: playing this card pauses whichever hum was already playing.
  useEffect(() => {
    if (!wavesurfer) return;
    const unsubscribe = [
      wavesurfer.on("play", () => startedPlaying(wavesurfer)),
      wavesurfer.on("pause", () => stoppedPlaying(wavesurfer)),
      wavesurfer.on("finish", () => stoppedPlaying(wavesurfer)),
    ];
    return () => {
      unsubscribe.forEach((off) => off());
      stoppedPlaying(wavesurfer);
    };
  }, [wavesurfer]);

  function seekBy(deltaSec: number) {
    if (!wavesurfer) return;
    wavesurfer.setTime(Math.min(durationSec, Math.max(0, wavesurfer.getCurrentTime() + deltaSec)));
  }

  function onWaveKey(e: KeyboardEvent) {
    const moves: Record<string, () => void> = {
      ArrowLeft: () => seekBy(-SEEK_STEP_SEC),
      ArrowRight: () => seekBy(SEEK_STEP_SEC),
      Home: () => wavesurfer?.setTime(0),
      End: () => wavesurfer?.setTime(durationSec),
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    move();
  }

  return (
    <article className={`flex flex-col gap-3 rounded-2xl p-3 text-canvas ${beat ? beatBg : ideaBg.voice}`}>
      <span className="px-1 text-xs font-semibold uppercase opacity-70">{beat ? "Beat" : "Hum"}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={failed || waiting}
          onClick={() => wavesurfer?.playPause().catch(() => setFailed(true))}
          className={onColorButton}
        >
          {isPlaying ? <Pause size={20} weight="fill" aria-hidden /> : <Play size={20} weight="fill" aria-hidden />}
          <span className="sr-only">
            {isPlaying ? "Pause" : "Play"} {beat ? "beat" : "hum"}
          </span>
        </button>
        <div className="relative flex min-w-0 flex-1 flex-col gap-1">
          {waiting && <div className="absolute inset-x-0 top-0 h-12 animate-pulse rounded-lg bg-canvas/10" aria-hidden />}
          <div
            ref={containerRef}
            role="slider"
            tabIndex={0}
            aria-label="Playback position"
            aria-valuemin={0}
            aria-valuemax={Math.round(durationSec)}
            aria-valuenow={Math.round(currentTime)}
            aria-valuetext={`${formatDuration(currentTime)} of ${formatDuration(durationSec)}`}
            onKeyDown={onWaveKey}
            className="h-12 w-full cursor-pointer rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-canvas"
          />
          {failed ? (
            <span role="alert" className="text-xs font-semibold">
              This browser can&apos;t play this recording. It may have been made on another device.
            </span>
          ) : (
            <span className="font-mono text-xs opacity-70 tabular-nums">
              {formatDuration(currentTime)} / {formatDuration(durationSec)}
            </span>
          )}
        </div>
      </div>
      {beat ? <BeatPanel idea={idea} /> : <MelodyPanel idea={idea} />}
    </article>
  );
}
