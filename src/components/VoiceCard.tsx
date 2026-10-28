"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useWavesurfer } from "@wavesurfer/react";
import { Pause, Play } from "@phosphor-icons/react";
import { startedPlaying, stoppedPlaying } from "@/audio/exclusivePlayback";
import { formatDuration } from "@/audio/formatDuration";
import { waveformBars } from "@/audio/waveformStyle";
import { tokenColor } from "@/ui/tokenColor";
import type { VoiceIdea } from "@/sketches/types";
import { ideaBg, onColorButton } from "@/ui/ideaColors";
import { MelodyPanel } from "./MelodyPanel";

const SEEK_STEP_SEC = 5;

export function VoiceCard({ idea }: { idea: VoiceIdea }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  // A voice Idea's audio and peaks never change for a given id, so everything below is keyed on idea.id.
  // Live queries hand back fresh objects on every read, and wavesurfer rebuilds itself whenever an option
  // changes identity, so depending on the objects themselves loops forever.
  const { blob, peaks: rawPeaks, durationSec } = idea;
  const peaks = useMemo(() => (rawPeaks.length ? [rawPeaks] : undefined), [idea.id]); // eslint-disable-line react-hooks/exhaustive-deps
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
    wavesurfer?.loadBlob(blob, peaks, durationSec).catch(() => setFailed(true));
  }, [wavesurfer, idea.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
    <article className={`flex flex-col gap-3 rounded-2xl p-3 text-canvas ${ideaBg.voice}`}>
      <span className="px-1 text-xs font-semibold uppercase opacity-70">Hum</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={failed}
          onClick={() => wavesurfer?.playPause().catch(() => setFailed(true))}
          className={onColorButton}
        >
          {isPlaying ? <Pause size={20} weight="fill" aria-hidden /> : <Play size={20} weight="fill" aria-hidden />}
          <span className="sr-only">{isPlaying ? "Pause" : "Play"} hum</span>
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
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
      <MelodyPanel idea={idea} />
    </article>
  );
}
