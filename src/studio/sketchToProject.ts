import { takeOf } from "@/melody/client";
import { referenceBpm, type Note as HumNote } from "@/melody/types";
import type { ArrangementInput, Idea, Sketch, VoiceIdea } from "@/sketches/types";
import { NOTE_NAMES } from "./music";
import type { Clip, Note, Project, Track } from "./types";

const beatsPerBar = 4;

/** A voice Idea with notes to show: transcribed, and not still pending or failed. */
export type HeardIdea = VoiceIdea & { transcription: Extract<VoiceIdea["transcription"], { status: "done" }> };

const isHeard = (idea: Idea): idea is HeardIdea => idea.kind === "voice" && idea.transcription?.status === "done";

/**
 * A studio Project built from a Sketch: each transcribed hum becomes a melody track with one clip of its notes,
 * clean or raw as the card shows them. Tempo and key come from the first transcribed hum.
 */
export function sketchToProject(sketch: Sketch, ideas: Idea[], now = Date.now()): Project {
  const projectId = crypto.randomUUID();
  const heard = ideas.filter(isHeard).sort((a, b) => a.order - b.order);
  const first = heard[0];
  const tracks: Track[] = [];
  const clips: Clip[] = [];

  heard.forEach((idea, order) => {
    const track = humTrack(projectId, idea, order);
    tracks.push(track);
    clips.push(humClip(track.id, idea));
  });
  if (!tracks.length) tracks.push(melodyTrack(projectId, "Melody", 0));

  return {
    id: projectId,
    name: sketch.title,
    bpm: first ? takeOf(first).bpm : referenceBpm,
    key: NOTE_NAMES[first?.transcription.key.tonic ?? 0],
    scale: first?.transcription.key.mode ?? "major",
    timeSignature: [beatsPerBar, 4],
    tracks,
    clips,
    createdAt: now,
    updatedAt: now,
  };
}

function melodyTrack(projectId: string, name: string, order: number): Track {
  return {
    id: crypto.randomUUID(),
    projectId,
    name,
    type: "midi",
    color: "melody",
    volume: 0.8,
    pan: 0,
    muted: false,
    solo: false,
    armed: false,
    instrumentPreset: "grand-piano",
    order,
  };
}

function humTrack(projectId: string, idea: HeardIdea, order: number): Track {
  return { ...melodyTrack(projectId, `Hum ${order + 1}`, order), origin: { kind: "hum", ideaId: idea.id } };
}

/** One clip at bar 0 holding the hum's notes, long enough for the last one. */
function humClip(trackId: string, idea: HeardIdea): Clip {
  const { raw, clean, showRaw } = idea.transcription;
  const notes = (showRaw ? raw : clean).map(toStudioNote);
  const end = Math.max(0, ...notes.map((n) => n.startBeat + n.duration));
  return {
    id: crypto.randomUUID(),
    trackId,
    type: "midi",
    name: "Hum",
    startBar: 0,
    lengthBars: Math.max(1, Math.ceil(end / beatsPerBar)),
    notes,
  };
}

/** hum's velocity is 0–1; the studio's is MIDI's 1–127. */
function toStudioNote({ pitch, start, duration, velocity }: HumNote): Note {
  return {
    id: crypto.randomUUID(),
    pitch,
    startBeat: start,
    duration,
    velocity: Math.min(127, Math.max(1, Math.round(velocity * 127))),
  };
}

/** The notes a hum's track is made from, as a string to compare: clean or raw, whichever the card shows. */
function fingerprint({ transcription: { raw, clean, showRaw } }: HeardIdea): string {
  return (showRaw ? raw : clean).map((n) => `${n.pitch}:${n.start}:${n.duration}:${n.velocity}`).join(" ");
}

/** What each transcribed hum sounded like, to save with an arrangement. */
export function heardOf(ideas: Idea[]): Record<string, string> {
  return Object.fromEntries(ideas.filter(isHeard).map((idea) => [idea.id, fingerprint(idea)]));
}

/** Transcribed hums whose notes have changed, or that are new, since the arrangement was saved. */
export function staleHums(arrangement: ArrangementInput, ideas: Idea[]): HeardIdea[] {
  return ideas
    .filter(isHeard)
    .filter((idea) => arrangement.heard[idea.id] !== fingerprint(idea))
    .sort((a, b) => a.order - b.order);
}

/** Replaces a hum's track notes with its latest ones, or adds a track for it. Every other track is left as it is. */
export function refreshHum(project: Project, idea: HeardIdea): Project {
  const existing = project.tracks.find((t) => t.origin?.kind === "hum" && t.origin.ideaId === idea.id);
  if (existing) {
    return {
      ...project,
      clips: [...project.clips.filter((c) => c.trackId !== existing.id), humClip(existing.id, idea)],
    };
  }
  const humCount = project.tracks.filter((t) => t.origin?.kind === "hum").length;
  const order = Math.max(-1, ...project.tracks.map((t) => t.order)) + 1;
  const track = { ...humTrack(project.id, idea, order), name: `Hum ${humCount + 1}` };
  return { ...project, tracks: [...project.tracks, track], clips: [...project.clips, humClip(track.id, idea)] };
}
