import type { Clip, Note, Project, Track, TrackOrigin } from "@/studio/types";
import { generateBass, type PartNote } from "./bass";
import { generateChords } from "./chords";
import { generateDrums } from "./drums";
import { melodyOf, planFor, type Plan } from "./plan";

type Part = Extract<TrackOrigin, { kind: "generated" }>["part"];

/** What each generated part sounds like and where it sits. */
const parts: Record<Part, Pick<Track, "name" | "type" | "color" | "instrumentPreset" | "volume">> = {
  chords: { name: "Chords", type: "midi", color: "keys", instrumentPreset: "warm-pad", volume: 0.55 },
  bass: { name: "Bass", type: "midi", color: "bass", instrumentPreset: "synth-bass", volume: 0.7 },
  drums: { name: "Drums", type: "drum", color: "drums", instrumentPreset: "hum-drums", volume: 0.75 },
};

const isGenerated = (t: Track) => t.origin?.kind === "generated";

/**
 * Writes chords, bass and drums for the arrangement's melody as ordinary tracks marked as generated. Running it again rewrites only
 * the generated tracks' notes, keeping their mixer settings; the melody and anything added by hand stay as they are.
 */
export function withGeneratedParts(project: Project): Project {
  const plan = planFor(project);
  const chords = generateChords(plan, melodyOf(project));
  const written: Record<Part, Note[]> = {
    chords: chords.flatMap((c) => c.pitches.map((pitch) => note({ pitch, startBeat: c.bar * plan.beatsPerBar, duration: plan.beatsPerBar, velocity: 80 }))),
    bass: generateBass(plan, chords).map(note),
    drums: generateDrums(plan).map(note),
  };

  const previous = (part: Part) => project.tracks.find((t) => t.origin?.kind === "generated" && t.origin.part === part);
  const kept = project.tracks.filter((t) => !isGenerated(t));
  const keptIds = new Set(kept.map((t) => t.id));
  const tracks = [...kept];
  const clips = project.clips.filter((c) => keptIds.has(c.trackId));
  let order = Math.max(-1, ...kept.map((t) => t.order));

  for (const part of Object.keys(parts) as Part[]) {
    if (!written[part].length) continue;
    const track: Track = previous(part) ?? {
      ...parts[part],
      id: crypto.randomUUID(),
      projectId: project.id,
      pan: 0,
      muted: false,
      solo: false,
      armed: false,
      order: 0,
      origin: { kind: "generated", part },
    };
    tracks.push({ ...track, order: ++order });
    clips.push(clipFor(track, plan, written[part]));
  }
  return { ...project, tracks, clips };
}

function clipFor(track: Track, plan: Plan, notes: Note[]): Clip {
  return {
    id: crypto.randomUUID(),
    trackId: track.id,
    type: track.type === "drum" ? "drum" : "midi",
    name: track.name,
    startBar: 0,
    lengthBars: plan.bars,
    notes,
  };
}

function note(n: PartNote): Note {
  return { id: crypto.randomUUID(), ...n };
}
