import type { InstrumentId } from "@/instruments/instruments";
import type { Take, Transcription } from "@/melody/types";
import type { Project } from "@/studio/types";

/** Where a piece of a page sits on its canvas: its top left corner, in canvas pixels. */
export type Place = { x: number; y: number };

/**
 * Where everything on one page's canvas sits, by piece: "home", "sketch:<id>" or "studio:<id>". A piece is a section
 * of the page (its title, the capture bar) or a card (an Idea or a Sketch, by its id). Pieces not in it yet are laid out
 * by hum.
 */
export type Layout = { id: string; places: Record<string, Place> };

export type Sketch = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
};

export type NoteInput = { kind: "note"; text: string };

export type VoiceInput = {
  kind: "voice";
  blob: Blob;
  /** The recorder's format: audio/mp4 on Safari, usually audio/webm elsewhere. */
  mime: string;
  durationSec: number;
  /** Normalised 0..1 amplitudes, so the card can draw the waveform without decoding the audio. Empty if analysis failed. */
  peaks: number[];
  /** Tempo, click and chosen key at recording time. Missing on takes from before M2, which count as free takes. */
  take?: Take;
  /** The notes hum heard in the take. Missing until it has been transcribed. */
  transcription?: Transcription;
  /** What a melody plays as. Missing until the songwriter picks one, which plays as piano. */
  instrument?: InstrumentId;
};

/** A rich-text document as the lyrics editor saves it (Tiptap/ProseMirror JSON). */
export type LyricsDoc = { type: "doc"; content?: unknown[] };

export type LyricsInput = { kind: "lyrics"; doc: LyricsDoc };

/** A picture for the moodboard, stored as-is or scaled down. */
export type ImageInput = { kind: "image"; blob: Blob; w: number; h: number };

/** Where a saved link points. Links can no longer be captured, but sketches from M1 still hold them. */
export type LinkProvider = "youtube" | "spotify" | "web";

/** A saved reference. Title, description and thumbnail come from oEmbed or the unfurl route when available. */
export type LinkInput = {
  kind: "link";
  url: string;
  provider: LinkProvider;
  title?: string;
  description?: string;
  thumb?: string;
  /** Who made it, as the provider reports it (channel, artist). */
  author?: string;
};

/** A palette swatch, as "#rrggbb". */
export type ColorInput = { kind: "color"; hex: string };

/** Everything a capture can add to a sketch. */
export type IdeaInput = NoteInput | VoiceInput | LyricsInput | ImageInput | LinkInput | ColorInput;

export type Idea = IdeaInput & {
  id: string;
  sketchId: string;
  order: number;
  createdAt: number;
};

export type VoiceIdea = Extract<Idea, { kind: "voice" }>;

/** A Sketch's studio arrangement, saved whenever the studio changes it. One per Sketch. */
export type Arrangement = {
  sketchId: string;
  project: Project;
  /** Each hum's notes as they were when its track was made, by voice Idea id, so a newer transcription can be offered. */
  heard: Record<string, string>;
  savedAt: number;
};

export type ArrangementInput = Pick<Arrangement, "project" | "heard">;
