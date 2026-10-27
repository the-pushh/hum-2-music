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
};

/** What a capture adds. Later tickets extend this union (lyrics, image, link, color). */
export type IdeaInput = NoteInput | VoiceInput;

export type Idea = IdeaInput & {
  id: string;
  sketchId: string;
  order: number;
  createdAt: number;
};

export type VoiceIdea = Extract<Idea, { kind: "voice" }>;
