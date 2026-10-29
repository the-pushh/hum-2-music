"use client";

import { DotsThree, GridFour, Minus, PianoKeys, Plus } from "@phosphor-icons/react";
import { isTrackAudible } from "@/studio/audio/scheduler";
import { isClaudePart } from "@/studio/generate/parts";
import { useProjectStore } from "@/studio/store/project";
import { usePlaybackStore } from "@/studio/store/playback";
import { arrangementBars, playedBars } from "@/studio/transport";
import type { Clip, Track } from "@/studio/types";
import { Playhead } from "./Playhead";
import { StylePicker } from "./StylePicker";
import { roleBg } from "./roleColors";
import { TrackSettings } from "./TrackSettings";

/** Pixels per bar along the timeline. */
const barPx = 128;
const minTempo = 40;
const maxTempo = 200;

type Props = { title: string; selectedTrackId: string | null; onSelect: (trackId: string) => void };

/**
 * The arrangement as a timeline: a column of track cards on the left, and on the right a bar ruler, the loop, and
 * each track's clips along a lane, with the playhead running down all of them. The lanes scroll sideways on a phone.
 */
export function Timeline({ title, selectedTrackId, onSelect }: Props) {
  const project = useProjectStore((s) => s.project);
  const setBpm = useProjectStore((s) => s.setBpm);
  const addTrack = useProjectStore((s) => s.addTrack);
  const loop = usePlaybackStore((s) => s.loopEnabled);
  const toggleLoop = usePlaybackStore((s) => s.toggleLoop);
  if (!project) return null;

  const tracks = [...project.tracks].sort((a, b) => a.order - b.order);
  const bars = arrangementBars(project) + 1;
  const beatsPerBar = project.timeSignature[0];
  const looped = playedBars(project);

  return (
    <section aria-label="Arrangement" className="flex flex-col gap-3 rounded-3xl bg-surface p-2">
      <div className="flex flex-wrap items-center justify-between gap-2 px-2 pt-2">
        <h1 className="text-2xl font-semibold text-ink">{title}</h1>
        <StylePicker />
      </div>
      <div className="flex">
        {/* Track cards */}
        <div className="flex w-1/2 shrink-0 flex-col gap-1 pr-1 sm:w-1/4">
          <div className="flex h-16 items-end gap-1 pb-1">
            <button type="button" popoverTarget="studio-tempo" className={chip}>
              {project.bpm} bpm
            </button>
            <span className={chip}>
              {project.key.replace("#", "♯")} {project.scale}
            </span>
            <span className={chip}>
              {project.timeSignature[0]}/{project.timeSignature[1]}
            </span>
          </div>
          {tracks.map((track) => (
            <TrackCard key={track.id} track={track} tracks={project.tracks} selected={track.id === selectedTrackId} onSelect={() => onSelect(track.id)} />
          ))}
          <div className="pt-2">
            <button type="button" popoverTarget="studio-add-track" className="inline-flex size-10 items-center justify-center rounded-full bg-raised text-ink transition duration-300 ease-soft hover:bg-line active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
              <Plus size={20} aria-hidden />
              <span className="sr-only">Add a track</span>
            </button>
          </div>
        </div>

        {/* Ruler and lanes */}
        <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="relative flex flex-col gap-1" style={{ width: bars * barPx }}>
            {Array.from({ length: bars + 1 }, (_, b) => (
              <div key={b} aria-hidden className="pointer-events-none absolute top-6 bottom-0 w-px bg-line" style={{ left: b * barPx }} />
            ))}
            <div className="flex h-16 flex-col">
              <div className="relative h-6" aria-hidden>
                {Array.from({ length: bars * beatsPerBar }, (_, i) => (
                  <div
                    key={i}
                    className={`absolute bottom-0 w-px ${i % beatsPerBar === 0 ? "h-3 bg-ink-muted" : "h-1 bg-line"}`}
                    style={{ left: (i / beatsPerBar) * barPx }}
                  />
                ))}
                {Array.from({ length: bars }, (_, b) => (
                  <span key={b} className="absolute top-0 pl-1 font-mono text-xs text-ink-muted" style={{ left: b * barPx }}>
                    {b + 1}
                  </span>
                ))}
              </div>
              <div className="relative flex-1 py-1">
                <button
                  type="button"
                  onClick={toggleLoop}
                  aria-pressed={loop}
                  aria-label={loop ? `Looping ${looped} bars, tap to stop looping` : "Loop"}
                  className={`absolute inset-y-1 left-0 flex items-center justify-between rounded-lg px-1 transition duration-300 ease-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${loop ? "bg-line" : "bg-raised opacity-50 hover:opacity-100"}`}
                  style={{ width: looped * barPx }}
                >
                  <span className="h-4 w-0.5 rounded-full bg-ink" aria-hidden />
                  <span className="h-4 w-0.5 rounded-full bg-ink" aria-hidden />
                </button>
              </div>
            </div>
            {tracks.map((track) => (
              <Lane
                key={track.id}
                track={track}
                clips={project.clips.filter((c) => c.trackId === track.id)}
                beatsPerBar={beatsPerBar}
                audible={isTrackAudible(track, project.tracks)}
                onSelect={() => onSelect(track.id)}
              />
            ))}
            <Playhead barPx={barPx} />
          </div>
        </div>
      </div>

      <div id="studio-tempo" popover="auto" className="m-auto rounded-2xl bg-raised p-4 text-ink backdrop:bg-canvas/60">
        <p className="pb-3 text-sm font-semibold text-ink-muted">Tempo</p>
        <div className="flex items-center gap-2">
          <button type="button" className={round} disabled={project.bpm <= minTempo} onClick={() => setBpm(Math.max(minTempo, project.bpm - 5))}>
            <Minus size={20} aria-hidden />
            <span className="sr-only">Slower</span>
          </button>
          <span className="min-w-24 text-center font-mono text-2xl tabular-nums" aria-live="polite">
            {project.bpm} bpm
          </span>
          <button type="button" className={round} disabled={project.bpm >= maxTempo} onClick={() => setBpm(Math.min(maxTempo, project.bpm + 5))}>
            <Plus size={20} aria-hidden />
            <span className="sr-only">Faster</span>
          </button>
        </div>
      </div>

      <div id="studio-add-track" popover="auto" className="m-auto rounded-2xl bg-raised p-2 text-ink backdrop:bg-canvas/60">
        <div className="flex flex-col gap-1">
          {(
            [
              ["midi", "melody", "Melody track", PianoKeys],
              ["drum", "drums", "Drum track", GridFour],
            ] as const
          ).map(([type, color, label, Icon]) => (
            <button
              key={type}
              type="button"
              popoverTarget="studio-add-track"
              popoverTargetAction="hide"
              onClick={() => onSelect(addTrack(type, `${label.split(" ")[0]} ${tracks.length + 1}`, color).id)}
              className="inline-flex items-center gap-3 rounded-lg px-3 py-2 text-base font-semibold text-ink transition duration-300 ease-soft hover:bg-line active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              <span className={`inline-flex size-8 items-center justify-center rounded-full text-canvas ${roleBg[color]}`}>
                <Icon size={16} aria-hidden />
              </span>
              {label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

const chip = "inline-flex h-8 items-center rounded-lg bg-raised px-2 font-mono text-sm text-ink transition duration-300 ease-soft hover:bg-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

const round =
  "inline-flex size-10 items-center justify-center rounded-full bg-surface text-ink transition duration-300 ease-soft hover:bg-line active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50";

/** A small round button on a track card, dark on the track's color. */
const cardButton =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-canvas/10 text-xs font-semibold text-canvas transition duration-300 ease-soft hover:bg-canvas/20 active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-canvas";

function TrackCard({ track, tracks, selected, onSelect }: { track: Track; tracks: Track[]; selected: boolean; onSelect: () => void }) {
  const updateTrack = useProjectStore((s) => s.updateTrack);
  const audible = isTrackAudible(track, tracks);
  const Icon = track.type === "drum" ? GridFour : PianoKeys;
  const settingsId = `track-settings-${track.id}`;

  return (
    <div
      className={`flex h-24 flex-col justify-between gap-1 rounded-2xl p-2 text-canvas transition duration-300 ease-soft sm:flex-row sm:items-center ${roleBg[track.color]} ${
        selected ? "outline-2 outline-offset-2 outline-ink" : ""
      } ${audible ? "" : "opacity-60"}`}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 text-left focus-visible:outline-2 focus-visible:outline-canvas sm:self-stretch"
      >
        <Icon size={16} aria-hidden className="shrink-0" />
        <span className="truncate text-sm font-semibold">{track.name}</span>
        {isClaudePart(track) && (
          <span className="shrink-0 rounded-full bg-canvas/10 px-2 py-0.5 text-xs font-semibold">
            <span className="sr-only">, written by </span>Claude
          </span>
        )}
        <span className="sr-only">, edit notes</span>
      </button>
      <div className="flex gap-1 self-end sm:self-auto">
      <button
        type="button"
        aria-pressed={!!track.solo}
        onClick={() => updateTrack(track.id, { solo: !track.solo })}
        className={`${cardButton} aria-pressed:bg-canvas aria-pressed:text-ink`}
      >
        S<span className="sr-only">olo {track.name}</span>
      </button>
      <button
        type="button"
        aria-pressed={track.muted}
        onClick={() => updateTrack(track.id, { muted: !track.muted })}
        className={`${cardButton} aria-pressed:bg-accent aria-pressed:text-accent-ink`}
      >
        M<span className="sr-only">ute {track.name}</span>
      </button>
      <button type="button" popoverTarget={settingsId} className={cardButton}>
        <DotsThree size={20} weight="bold" aria-hidden />
        <span className="sr-only">{track.name} settings</span>
      </button>
      </div>
      <TrackSettings id={settingsId} track={track} audible={audible} />
    </div>
  );
}

function Lane({ track, clips, beatsPerBar, audible, onSelect }: { track: Track; clips: Clip[]; beatsPerBar: number; audible: boolean; onSelect: () => void }) {
  return (
    <div className="relative h-24">
      {clips.map((clip) => (
        <button
          key={clip.id}
          type="button"
          onClick={onSelect}
          aria-label={`${clip.name} on ${track.name}, edit notes`}
          className={`absolute inset-y-0 overflow-hidden rounded-2xl text-left transition duration-300 ease-soft hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${roleBg[track.color]} ${
            audible ? "" : "opacity-40"
          }`}
          style={{ left: clip.startBar * barPx, width: clip.lengthBars * barPx - 2 }}
        >
          <span className="absolute top-1 left-3 text-xs font-semibold text-canvas opacity-70">{clip.name}</span>
          <ClipNotes clip={clip} beatsPerBar={beatsPerBar} />
        </button>
      ))}
    </div>
  );
}

/** A clip's notes as thin dark lines: pitch up, time across. */
function ClipNotes({ clip, beatsPerBar }: { clip: Clip; beatsPerBar: number }) {
  const notes = clip.notes ?? [];
  if (!notes.length) return null;
  const beats = clip.lengthBars * beatsPerBar;
  const low = Math.min(...notes.map((n) => n.pitch));
  const high = Math.max(...notes.map((n) => n.pitch));
  // At least two octaves tall, so a narrow melody draws as thin lines rather than thick bars.
  const rows = Math.max(24, high - low + 1);
  const top = high + Math.floor((rows - (high - low + 1)) / 2);
  return (
    <div aria-hidden className="absolute inset-x-3 top-6 bottom-2">
      <svg className="size-full" viewBox={`0 0 ${beats} ${rows}`} preserveAspectRatio="none">
        {notes.map((n) => (
          <rect key={n.id} x={n.startBeat} y={top - n.pitch} width={Math.max(0.12, n.duration - 0.06)} height={1} className="fill-canvas opacity-40" />
        ))}
      </svg>
    </div>
  );
}
