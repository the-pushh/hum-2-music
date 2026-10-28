"use client";

import { useEffect, useState } from "react";
import { ArrowClockwise, GridFour } from "@phosphor-icons/react";
import { playBeat } from "@/audio/takePlayer";
import { changeBeatCleanup, hearBeatIdea, isHearingBeat } from "@/beat/client";
import { drumPitch } from "@/beat/hearBeat";
import { takeOf } from "@/melody/client";
import type { Grid } from "@/melody/types";
import type { VoiceIdea } from "@/sketches/types";
import { Button } from "./Button";
import { Choice } from "./Choice";
import { HitStrip } from "./HitStrip";
import { PlayTakeButton } from "./PlayTakeButton";

/** The hits hum heard in a beat take: hearing status, a kick, snare and hat strip, and the drum machine to play them on. */
export function BeatPanel({ idea }: { idea: VoiceIdea }) {
  const t = idea.transcription;
  const [error, setError] = useState(false);

  // Hearing left pending by a closed tab or reload never finishes on its own: start it again.
  useEffect(() => {
    if (t?.status === "pending" && !isHearingBeat(idea.id)) void hearBeatIdea(idea);
  }, [t?.status, idea.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!t) {
    return (
      <Button variant="secondary" className="self-start text-sm" onClick={() => void hearBeatIdea(idea)}>
        <GridFour size={16} aria-hidden />
        Hear the hits
      </Button>
    );
  }

  if (t.status === "pending") {
    return (
      <div className="flex flex-col gap-2" aria-live="polite">
        <div className="h-12 w-full animate-pulse rounded-sm bg-canvas/10" aria-hidden />
        <span className="text-xs opacity-70">Hearing the hits</span>
      </div>
    );
  }

  if (t.status === "failed") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span role="alert" className="text-xs font-semibold">
          {t.error} Try beatboxing closer to the mic.
        </span>
        <Button variant="secondary" className="text-sm" onClick={() => void hearBeatIdea(idea)}>
          <ArrowClockwise size={16} aria-hidden />
          Try again
        </Button>
      </div>
    );
  }

  if (t.kind !== "beat") return null;
  const hits = t.showRaw ? t.raw : t.clean;
  const count = (pitch: number) => hits.filter((h) => h.pitch === pitch).length;
  const summary = `${count(drumPitch.kick)} kicks, ${count(drumPitch.snare)} snares, ${count(drumPitch.hat)} hi-hats`;

  function change(changes: { grid?: Grid; showRaw?: boolean }) {
    setError(false);
    changeBeatCleanup(idea, changes).catch(() => setError(true));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-semibold">{takeOf(idea).bpm} BPM</span>
        <span className="opacity-70 tabular-nums">{hits.length} hits</span>
      </div>
      <HitStrip hits={hits} label={summary} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PlayTakeButton label="Play on drums" instrument="drums" play={(onEnded) => playBeat(hits, takeOf(idea).bpm, onEnded)} />
        <div className="flex flex-wrap items-center gap-2">
          {takeOf(idea).click && (
            <Choice
              label="Hits"
              value={t.showRaw}
              onChange={(showRaw) => change({ showRaw })}
              options={[
                { value: false, label: "Snapped" },
                { value: true, label: "Raw" },
              ]}
            />
          )}
          {!t.showRaw && takeOf(idea).click && (
            <Choice<Grid>
              label="Grid"
              value={t.grid}
              onChange={(grid) => change({ grid })}
              options={[
                { value: 8, label: "1/8" },
                { value: 16, label: "1/16" },
              ]}
            />
          )}
        </div>
      </div>
      {error && (
        <span role="alert" className="text-xs font-semibold">
          Couldn&apos;t save that change.
        </span>
      )}
    </div>
  );
}
