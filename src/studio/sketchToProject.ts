import { takeOf } from "@/melody/client";
import { referenceBpm, type BeatHeard, type MelodyHeard, type Note as HumNote } from "@/melody/types";
import type { ArrangementInput, Idea, Sketch, VoiceIdea } from "@/sketches/types";
import { defaultInstrument, instrumentPreset, instruments } from "@/instruments/instruments";
import { humPresets } from "./audio/humVoices";
import { NOTE_NAMES } from "./music";
import type { Clip, Note, Project, Track } from "./types";

const beatsPerBar = 4;

/** A voice Idea with notes or hits to show: heard, and not still pending or failed. */
export type HeardIdea = VoiceIdea & { transcription: MelodyHeard | BeatHeard };

const isHeard = (idea: Idea): idea is HeardIdea => idea.kind === "voice" && idea.transcription?.status === "done";
const isBeatHeard = (idea: HeardIdea): idea is VoiceIdea & { transcription: BeatHeard } => idea.transcription.kind === "beat";

/**
 * A studio Project built from a Sketch: each heard take becomes a track with one clip of its notes, clean or raw as the
 * card shows them. A melody becomes a melody track, a beat a drum track. Tempo comes from the first heard take; key and
 * scale from the first heard melody.
 */
export function sketchToProject(sketch: Sketch, ideas: Idea[], now = Date.now()): Project {
  const projectId = crypto.randomUUID();
  const heard = ideas.filter(isHeard).sort((a, b) => a.order - b.order);
  const first = heard[0];
  const firstMelody = heard.find((idea) => !isBeatHeard(idea))?.transcription as MelodyHeard | undefined;
  const tracks: Track[] = [];
  const clips: Clip[] = [];

  heard.forEach((idea, order) => {
    const track = humTrack(projectId, idea, order, tracks);
    tracks.push(track);
    clips.push(humClip(track.id, idea));
  });
  if (!tracks.length) tracks.push(melodyTrack(projectId, "Melody", 0));

  return {
    id: projectId,
    name: sketch.title,
    bpm: first ? takeOf(first).bpm : referenceBpm,
    key: NOTE_NAMES[firstMelody?.key.tonic ?? 0],
    scale: firstMelody?.key.mode ?? "major",
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
    instrumentPreset: humPresets.piano,
    order,
  };
}

/** A heard take's track, numbered after the takes of its kind already in `tracks`: Hum 1, Hum 2… and Beat 1, Beat 2… */
function humTrack(projectId: string, idea: HeardIdea, order: number, tracks: Track[]): Track {
  const beat = isBeatHeard(idea);
  const number = tracks.filter((t) => t.origin?.kind === "hum" && (t.type === "drum") === beat).length + 1;
  const origin = { kind: "hum", ideaId: idea.id } as const;
  if (!beat) return { ...melodyTrack(projectId, `Hum ${number}`, order), ...soundOf(idea), origin };
  return {
    ...melodyTrack(projectId, `Beat ${number}`, order),
    type: "drum",
    color: "drums",
    volume: 0.75,
    instrumentPreset: humPresets.drums,
    origin,
  };
}

/** The preset and role a melody hum's track takes from the instrument chosen for it. */
function soundOf(idea: HeardIdea): Pick<Track, "instrumentPreset" | "color"> {
  const id = idea.instrument ?? defaultInstrument;
  return { instrumentPreset: instrumentPreset(id), color: instruments[id].role };
}

/** One clip at bar 0 holding the hum's notes, long enough for the last one. */
function humClip(trackId: string, idea: HeardIdea): Clip {
  const { raw, clean, showRaw } = idea.transcription;
  const notes = (showRaw ? raw : clean).map(toStudioNote);
  const end = Math.max(0, ...notes.map((n) => n.startBeat + n.duration));
  return {
    id: crypto.randomUUID(),
    trackId,
    type: isBeatHeard(idea) ? "drum" : "midi",
    name: isBeatHeard(idea) ? "Beat" : "Hum",
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

/**
 * What a take's track is made from, as a string to compare: its notes, clean or raw as the card shows them, and the
 * instrument it plays as. Piano adds nothing, so arrangements saved before instruments could be chosen stay current.
 */
function fingerprint(idea: HeardIdea): string {
  const { raw, clean, showRaw } = idea.transcription;
  const notes = (showRaw ? raw : clean).map((n) => `${n.pitch}:${n.start}:${n.duration}:${n.velocity}`).join(" ");
  const instrument = idea.instrument ?? defaultInstrument;
  return instrument === defaultInstrument ? notes : `${notes}|${instrument}`;
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

/**
 * Replaces a take's track notes with its latest ones, and a melody's instrument with its latest choice, or adds a track
 * for it. Every other track is left as it is.
 */
export function refreshHum(project: Project, idea: HeardIdea): Project {
  const existing = project.tracks.find((t) => t.origin?.kind === "hum" && t.origin.ideaId === idea.id);
  if (existing) {
    return {
      ...project,
      tracks: isBeatHeard(idea) ? project.tracks : project.tracks.map((t) => (t.id === existing.id ? { ...t, ...soundOf(idea) } : t)),
      clips: [...project.clips.filter((c) => c.trackId !== existing.id), humClip(existing.id, idea)],
    };
  }
  const order = Math.max(-1, ...project.tracks.map((t) => t.order)) + 1;
  const track = humTrack(project.id, idea, order, project.tracks);
  return { ...project, tracks: [...project.tracks, track], clips: [...project.clips, humClip(track.id, idea)] };
}
