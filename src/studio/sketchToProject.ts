import { takeOf } from "@/melody/client";
import { referenceBpm, type Note as HumNote } from "@/melody/types";
import type { Idea, Sketch, VoiceIdea } from "@/sketches/types";
import { NOTE_NAMES } from "./music";
import type { Clip, Note, Project, Track } from "./types";

const beatsPerBar = 4;

/** A voice Idea with notes to show: transcribed, and not still pending or failed. */
type HeardIdea = VoiceIdea & { transcription: Extract<VoiceIdea["transcription"], { status: "done" }> };

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
    const track = melodyTrack(projectId, `Hum ${order + 1}`, order);
    track.origin = { kind: "hum", ideaId: idea.id };
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

/** One clip at bar 0 holding the hum's notes, long enough for the last one. */
export function humClip(trackId: string, idea: HeardIdea): Clip {
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
