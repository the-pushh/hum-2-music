/**
 * The sounds a melody can play as. Each one says where its samples come from, its General MIDI program for export,
 * the role its studio Track takes, and the words that pick it.
 *
 * Sample licences, checked 28 Oct 2026:
 * - piano: smplr's Splendid Grand Piano, as M2.
 * - electric piano: Greg Sullivan's E-Pianos, CC BY 3.0.
 * - everything else: the FluidR3_GM General MIDI soundfont, CC BY 3.0. smplr's default soundfont, MusyngKite, is
 *   CC BY-SA, so the kit is always named.
 */
export type InstrumentId = "piano" | "electric-piano" | "strings" | "bass" | "guitar" | "synth-lead" | "pad" | "flute" | "brass";

export type InstrumentSound = { kind: "grand" } | { kind: "electric"; name: string } | { kind: "soundfont"; name: string };

export type Instrument = {
  label: string;
  sound: InstrumentSound;
  /** General MIDI program number, 0-based. */
  program: number;
  /** The role a Track playing it takes, which sets its color. */
  role: "melody" | "keys" | "bass";
  /** Words and phrases that name it, lowercase. */
  words: string[];
};

export const instruments: Record<InstrumentId, Instrument> = {
  piano: { label: "Piano", sound: { kind: "grand" }, program: 0, role: "keys", words: ["piano", "grand", "grand piano", "acoustic piano"] },
  "electric-piano": {
    label: "Keys",
    sound: { kind: "electric", name: "WurlitzerEP200" },
    program: 4,
    role: "keys",
    words: ["keys", "electric piano", "e piano", "epiano", "rhodes", "wurlitzer", "wurli", "ep"],
  },
  strings: {
    label: "Strings",
    sound: { kind: "soundfont", name: "string_ensemble_1" },
    program: 48,
    role: "melody",
    words: ["strings", "string", "violin", "violins", "viola", "cello", "cellos", "orchestra", "orchestral"],
  },
  bass: {
    label: "Bass",
    sound: { kind: "soundfont", name: "electric_bass_finger" },
    program: 33,
    role: "bass",
    words: ["bass", "bassline", "bass line", "low end", "bass guitar"],
  },
  guitar: {
    label: "Guitar",
    sound: { kind: "soundfont", name: "acoustic_guitar_nylon" },
    program: 24,
    role: "melody",
    words: ["guitar", "acoustic", "acoustic guitar", "nylon", "classical guitar"],
  },
  "synth-lead": {
    label: "Synth",
    sound: { kind: "soundfont", name: "lead_2_sawtooth" },
    program: 81,
    role: "melody",
    words: ["synth", "synth lead", "lead", "synthesizer", "saw", "sawtooth"],
  },
  pad: { label: "Pad", sound: { kind: "soundfont", name: "pad_2_warm" }, program: 89, role: "melody", words: ["pad", "synth pad", "warm pad", "ambient"] },
  flute: { label: "Flute", sound: { kind: "soundfont", name: "flute" }, program: 73, role: "melody", words: ["flute", "flutes", "woodwind", "recorder"] },
  brass: {
    label: "Brass",
    sound: { kind: "soundfont", name: "brass_section" },
    program: 61,
    role: "melody",
    words: ["brass", "horns", "horn", "horn section", "trumpet", "trumpets", "trombone"],
  },
};

export const instrumentIds = Object.keys(instruments) as InstrumentId[];

/** A melody with no choice yet plays as piano. */
export const defaultInstrument: InstrumentId = "piano";
