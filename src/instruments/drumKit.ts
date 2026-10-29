/** General MIDI drum pitches to the LM-2's samples. Pitches not here are silent. */
const lm2: Record<number, string> = {
  35: "kick-alt",
  36: "kick",
  37: "stick-m",
  38: "snare-m",
  39: "clap",
  40: "snare-h",
  41: "tom-ll",
  42: "hhclosed",
  43: "tom-l",
  44: "hhclosed-short",
  45: "tom-m",
  46: "hhopen",
  47: "tom-m",
  48: "tom-h",
  49: "crash",
  50: "tom-hh",
  51: "ride",
  52: "crash",
  53: "ride",
  54: "tambourine",
  55: "crash",
  56: "cowbell",
  57: "crash",
  59: "ride",
  62: "conga-h",
  63: "conga-m",
  64: "conga-l",
  69: "cabasa",
  70: "cabasa",
};

/** The LM-2 sample for a General MIDI drum pitch, or nothing if it has none. Pure, so it runs anywhere. */
export function drumSample(pitch: number): string | undefined {
  return lm2[pitch];
}
