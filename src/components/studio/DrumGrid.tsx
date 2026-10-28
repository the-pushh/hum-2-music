"use client";

import { DRUM_PITCH } from "@/studio/music";
import { useProjectStore } from "@/studio/store/project";
import { arrangementBars, previewNote } from "@/studio/transport";
import type { Clip, Note, Track } from "@/studio/types";

/** The kit's rows, top to bottom, on General MIDI pitches. */
const rows = [
  { name: "Crash", pitch: DRUM_PITCH.crash },
  { name: "Open hat", pitch: DRUM_PITCH.openHat },
  { name: "Hat", pitch: DRUM_PITCH.closedHat },
  { name: "High tom", pitch: DRUM_PITCH.highTom },
  { name: "Low tom", pitch: DRUM_PITCH.lowTom },
  { name: "Clap", pitch: DRUM_PITCH.handClap },
  { name: "Snare", pitch: DRUM_PITCH.snare },
  { name: "Kick", pitch: DRUM_PITCH.kick },
];

/** Sixteenth-note steps. */
const stepBeats = 0.25;
const normal = 96;
const accent = 127;

/** Program drums on a step grid. A tap cycles a step: off, hit, accented hit, off. */
export function DrumGrid({ track }: { track: Track }) {
  const project = useProjectStore((s) => s.project)!;
  const { addClip, addNote, updateNote, deleteNote } = useProjectStore.getState();
  const clip = project.clips.find((c) => c.trackId === track.id);
  const beatsPerBar = project.timeSignature[0];
  const bars = Math.max(arrangementBars(project), clip?.lengthBars ?? 0);
  const steps = (bars * beatsPerBar) / stepBeats;

  const hitAt = (pitch: number, step: number): Note | undefined =>
    clip?.notes?.find((n) => n.pitch === pitch && Math.abs(n.startBeat - step * stepBeats) < stepBeats / 2);

  function toggle(pitch: number, step: number) {
    const hit = hitAt(pitch, step);
    const target: Clip = clip ?? addClip(track.id, "drum", 0, bars);
    if (!hit) {
      addNote(target.id, { pitch, startBeat: step * stepBeats, duration: stepBeats, velocity: normal });
      void previewNote(track, pitch, stepBeats);
    } else if (hit.velocity < accent) {
      updateNote(target.id, hit.id, { velocity: accent });
      void previewNote(track, pitch, stepBeats);
    } else {
      deleteNote(target.id, hit.id);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-ink-muted">Tap a step to add a hit, again to accent it, and once more to clear it.</p>
      <div className="overflow-x-auto rounded-lg bg-canvas select-none">
        <table className="border-separate border-spacing-0.5">
          <tbody>
            {rows.map((row) => (
              <tr key={row.pitch}>
                <th scope="row" className="sticky left-0 z-10 bg-surface px-2 text-left text-xs font-semibold whitespace-nowrap text-ink-muted">
                  {row.name}
                </th>
                {Array.from({ length: steps }, (_, step) => {
                  const hit = hitAt(row.pitch, step);
                  const onBeat = Math.floor((step * stepBeats) % beatsPerBar) % 2 === 0;
                  return (
                    <td key={step} className="p-0">
                      <button
                        type="button"
                        onClick={() => toggle(row.pitch, step)}
                        aria-pressed={!!hit}
                        aria-label={`${row.name}, bar ${Math.floor((step * stepBeats) / beatsPerBar) + 1} step ${(step % (beatsPerBar / stepBeats)) + 1}${hit && hit.velocity >= accent ? ", accented" : ""}`}
                        className={`block size-8 rounded-sm transition duration-300 ease-soft active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                          hit ? `bg-drums ${hit.velocity >= accent ? "opacity-100" : "opacity-60"}` : onBeat ? "bg-raised hover:bg-line" : "bg-surface hover:bg-line"
                        }`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
