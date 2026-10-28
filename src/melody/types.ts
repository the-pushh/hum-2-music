/** One note of a melody. Pitch is a MIDI number; start and duration are in beats. */
export type Note = { pitch: number; start: number; duration: number; velocity: number };

/** A key: tonic as a pitch class (0 = C … 11 = B) and its mode. */
export type Key = { tonic: number; mode: "major" | "minor" };

/** Subdivisions per bar of 4/4 to quantize to: eighth or sixteenth notes. */
export type Grid = 8 | 16;

/** How the songwriter wants a transcription cleaned up. */
export type CleanupSettings = {
  /** "auto" detects the key from the notes. */
  key: Key | "auto";
  /** Snap brief out-of-key notes into the key. */
  snap: boolean;
  /** Only used for click takes; free takes keep their timing. */
  grid: Grid;
};

export const defaultCleanupSettings: CleanupSettings = { key: "auto", snap: true, grid: 8 };

/** Roughly C2 to C6: a hummed or sung voice. Anything outside is an overtone or noise. */
export const voiceRangeHz = { low: 60, high: 1100 };

/** A MIDI pitch's pitch class, 0 = C … 11 = B, for any pitch including negative ones. */
export function pitchClass(pitch: number): number {
  return ((pitch % 12) + 12) % 12;
}

/** The tempo free takes are measured against when there was no click. */
export const referenceBpm = 90;

/** What a take is of: a hummed or sung melody, or a vocalized drum beat. */
export type TakeMode = "melody" | "beat";

/** What the recorder knew about a take when it was made. */
export type Take = {
  /** Missing on takes from before M4, which are all melodies. */
  mode?: TakeMode;
  /** The click tempo, or the reference tempo for a free take. */
  bpm: number;
  click: boolean;
  /** The key the songwriter chose before recording, if any. */
  key?: Key;
};

/** The notes hum heard in a melody take. */
export type MelodyHeard = {
  status: "done";
  kind?: "melody";
  raw: Note[];
  clean: Note[];
  /** The key cleanup used: the chosen one, or the detected one. */
  key: Key;
  settings: CleanupSettings;
  /** Show and play the raw notes instead of the cleaned ones. */
  showRaw: boolean;
};

/** The hits hum heard in a beat take, as Notes on General MIDI drum pitches. Beats have no key. */
export type BeatHeard = {
  status: "done";
  kind: "beat";
  raw: Note[];
  clean: Note[];
  /** Clicked takes snap to it; free takes keep their timing. */
  grid: Grid;
  /** Show and play the raw hits instead of the snapped ones. */
  showRaw: boolean;
};

export type Transcription = { status: "pending" } | { status: "failed"; error: string } | MelodyHeard | BeatHeard;
