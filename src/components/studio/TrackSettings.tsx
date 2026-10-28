"use client";

import { useEffect, useRef, useState } from "react";
import { Trash } from "@phosphor-icons/react";
import { playoutManager } from "@/studio/audio/playout";
import { useProjectStore } from "@/studio/store/project";
import type { Track } from "@/studio/types";
import { ConfirmDialog } from "../ConfirmDialog";

/** The popover sheet behind a track's ⋯ button: name, volume and delete. */
export function TrackSettings({ id, track, audible }: { id: string; track: Track; audible: boolean }) {
  const updateTrack = useProjectStore((s) => s.updateTrack);
  const deleteTrack = useProjectStore((s) => s.deleteTrack);
  const ref = useRef<HTMLDivElement>(null);
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <div
        ref={ref}
        id={id}
        popover="auto"
        className="m-auto w-full max-w-sm rounded-2xl bg-raised p-4 text-ink backdrop:bg-canvas/60"
      >
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-semibold text-ink-muted">
            Name
            <input
              // Saved once when you're done, so typing a name is one undo step, not one per letter.
              key={track.name}
              defaultValue={track.name}
              onBlur={(e) => {
                const name = e.target.value.trim() || "Untitled";
                if (name !== track.name) updateTrack(track.id, { name });
                else e.target.value = name;
              }}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              className="rounded-lg bg-surface px-3 py-2 text-base text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-ink-muted">
            Volume
            <VolumeSlider track={track} audible={audible} onCommit={(volume) => updateTrack(track.id, { volume })} />
          </label>
          <button
            type="button"
            onClick={() => {
              ref.current?.hidePopover();
              setConfirming(true);
            }}
            className="inline-flex w-fit items-center gap-2 rounded-lg px-3 py-2 text-base font-semibold text-accent transition duration-300 ease-soft hover:bg-surface active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <Trash size={20} aria-hidden />
            Delete track
          </button>
        </div>
      </div>
      {confirming && (
        <ConfirmDialog
          title={`Delete ${track.name}?`}
          body="Its notes go with it. You can undo this."
          confirmLabel="Delete track"
          onConfirm={() => {
            setConfirming(false);
            deleteTrack(track.id);
          }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}

/** Heard live while dragging and saved once on release, so a drag is one undo step rather than dozens. */
function VolumeSlider({ track, audible, onCommit }: { track: Track; audible: boolean; onCommit: (volume: number) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const dragging = useRef(false);
  // Follow the track's volume when it changes from elsewhere (undo), unless it's being dragged.
  useEffect(() => {
    if (ref.current && !dragging.current) ref.current.value = String(track.volume);
  }, [track.volume]);
  const commit = () => {
    dragging.current = false;
    const volume = Number(ref.current?.value);
    if (volume !== track.volume) onCommit(volume);
  };
  return (
    <input
      ref={ref}
      type="range"
      min={0}
      max={1}
      step={0.01}
      defaultValue={track.volume}
      onInput={(e) => playoutManager.updateTrackVolume(track.id, audible ? Number(e.currentTarget.value) : 0)}
      onPointerDown={() => (dragging.current = true)}
      onPointerUp={commit}
      onKeyUp={commit}
      onBlur={commit}
      className="w-full accent-ink"
    />
  );
}
