"use client";

import { useState } from "react";
import { Headphones, MusicNote, Plus, SpeakerSimpleX, Trash, GridFour } from "@phosphor-icons/react";
import { isTrackAudible } from "@/studio/audio/scheduler";
import { useProjectStore } from "@/studio/store/project";
import { arrangementBars } from "@/studio/transport";
import type { Clip, Project, Track } from "@/studio/types";
import { ConfirmDialog } from "../ConfirmDialog";
import { iconButton } from "./iconButton";
import { Playhead } from "./Playhead";
import { roleBg, roleFill } from "./roleColors";

type Props = { selectedTrackId: string | null; onSelect: (trackId: string) => void };

/** Every track: its name, mute, solo, volume, and its clips along the arrangement. Tap a track to edit it. */
export function TrackList({ selectedTrackId, onSelect }: Props) {
  const project = useProjectStore((s) => s.project);
  const addTrack = useProjectStore((s) => s.addTrack);
  const [deleting, setDeleting] = useState<Track | null>(null);
  const deleteTrack = useProjectStore((s) => s.deleteTrack);

  if (!project) return null;
  const tracks = [...project.tracks].sort((a, b) => a.order - b.order);
  const bars = arrangementBars(project);

  return (
    <section aria-label="Tracks" className="flex flex-col gap-2">
      {tracks.map((track) => (
        <TrackRow
          key={track.id}
          track={track}
          project={project}
          bars={bars}
          selected={track.id === selectedTrackId}
          onSelect={() => onSelect(track.id)}
          onDelete={() => setDeleting(track)}
        />
      ))}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={addButton} onClick={() => onSelect(addTrack("midi", `Melody ${tracks.length + 1}`, "melody").id)}>
          <Plus size={16} aria-hidden />
          Melody track
        </button>
        <button type="button" className={addButton} onClick={() => onSelect(addTrack("drum", `Drums ${tracks.length + 1}`, "drums").id)}>
          <Plus size={16} aria-hidden />
          Drum track
        </button>
      </div>
      {deleting && (
        <ConfirmDialog
          title={`Delete ${deleting.name}?`}
          body="Its notes go with it. You can undo this."
          confirmLabel="Delete track"
          onConfirm={() => {
            deleteTrack(deleting.id);
            setDeleting(null);
          }}
          onCancel={() => setDeleting(null)}
        />
      )}
    </section>
  );
}

const addButton =
  "inline-flex items-center gap-2 rounded-lg bg-raised px-3 py-2 text-sm font-semibold text-ink transition duration-300 ease-soft hover:bg-line active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

type RowProps = {
  track: Track;
  project: Project;
  bars: number;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
};

function TrackRow({ track, project, bars, selected, onSelect, onDelete }: RowProps) {
  const updateTrack = useProjectStore((s) => s.updateTrack);
  const updateSoloMute = (changes: Partial<Track>) => updateTrack(track.id, changes);
  const audible = isTrackAudible(track, project.tracks);
  const clips = project.clips.filter((c) => c.trackId === track.id);
  const Icon = track.type === "drum" ? GridFour : MusicNote;

  return (
    <div
      className={`flex flex-col gap-2 rounded-2xl p-2 transition duration-300 ease-soft ${selected ? "bg-raised" : "bg-surface"}`}
    >
      <div className="flex items-center gap-1">
        <span className={`size-3 shrink-0 rounded-full ${roleBg[track.color]}`} aria-hidden />
        <input
          value={track.name}
          onChange={(e) => updateTrack(track.id, { name: e.target.value })}
          onBlur={(e) => !e.target.value.trim() && updateTrack(track.id, { name: "Untitled" })}
          aria-label="Track name"
          className="min-w-0 flex-1 rounded-md bg-transparent px-2 py-1 text-base font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        />
        <button type="button" className={iconButton} aria-pressed={track.muted} onClick={() => updateSoloMute({ muted: !track.muted })}>
          <SpeakerSimpleX size={20} aria-hidden />
          <span className="sr-only">Mute {track.name}</span>
        </button>
        <button type="button" className={iconButton} aria-pressed={!!track.solo} onClick={() => updateSoloMute({ solo: !track.solo })}>
          <Headphones size={20} aria-hidden />
          <span className="sr-only">Solo {track.name}</span>
        </button>
        <button type="button" className={iconButton} onClick={onDelete}>
          <Trash size={20} aria-hidden />
          <span className="sr-only">Delete {track.name}</span>
        </button>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={track.volume}
          onChange={(e) => updateTrack(track.id, { volume: Number(e.target.value) })}
          aria-label={`${track.name} volume`}
          className="w-20 shrink-0 accent-ink"
        />
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={selected}
          aria-label={`Edit ${track.name}`}
          className={`relative h-12 flex-1 overflow-hidden rounded-lg bg-canvas transition duration-300 ease-soft hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${audible ? "" : "opacity-50"}`}
        >
          <Icon size={16} aria-hidden className="absolute top-1 left-1 text-ink-muted" />
          {clips.map((clip) => (
            <ClipNotes key={clip.id} clip={clip} bars={bars} fill={roleFill[track.color]} beatsPerBar={project.timeSignature[0]} />
          ))}
          <Playhead bars={bars} />
        </button>
      </div>
    </div>
  );
}

/** A clip's notes, drawn where the clip sits in the arrangement: pitch up, time across. */
function ClipNotes({ clip, bars, fill, beatsPerBar }: { clip: Clip; bars: number; fill: string; beatsPerBar: number }) {
  const notes = clip.notes ?? [];
  const beats = clip.lengthBars * beatsPerBar;
  const low = Math.min(...notes.map((n) => n.pitch), 127);
  const high = Math.max(...notes.map((n) => n.pitch), 0);
  const span = Math.max(1, high - low + 1);
  return (
    <svg
      aria-hidden
      className="absolute inset-y-1"
      style={{ left: `${(clip.startBar / bars) * 100}%`, width: `${(clip.lengthBars / bars) * 100}%` }}
      viewBox={`0 0 ${beats} ${span}`}
      preserveAspectRatio="none"
    >
      {notes.map((n) => (
        <rect key={n.id} x={n.startBeat} y={high - n.pitch} width={Math.max(0.1, n.duration - 0.05)} height={1} className={fill} />
      ))}
    </svg>
  );
}
