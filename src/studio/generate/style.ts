/**
 * How an Arrangement's generated parts play: the drum feel, the chords' colour and rhythm, the bass line, and how hard
 * it all hits. Hummed tracks don't follow it; only Generators do.
 */
export type Style = {
  drums: "pop-rock" | "four-on-the-floor" | "half-time" | "boom-bap" | "none";
  chords: "triads" | "sevenths" | "none";
  chordRhythm: "held" | "pulsing";
  bass: "roots" | "octaves" | "walking" | "none";
  energy: "low" | "medium" | "high";
};

/** What M3 generates: arrangements saved before Styles existed sound exactly as they did. */
export const defaultStyle: Style = { drums: "pop-rock", chords: "triads", chordRhythm: "held", bass: "roots", energy: "medium" };

/** Every choice of each part of a Style, in the order the picker shows them. */
export const styleChoices = {
  drums: ["pop-rock", "four-on-the-floor", "half-time", "boom-bap", "none"],
  chords: ["triads", "sevenths", "none"],
  chordRhythm: ["held", "pulsing"],
  bass: ["roots", "octaves", "walking", "none"],
  energy: ["low", "medium", "high"],
} as const satisfies { [K in keyof Style]: readonly Style[K][] };

/** How each choice reads in the picker and the Style chip. */
export const styleLabel: Record<Style[keyof Style], string> = {
  "pop-rock": "Pop/rock",
  "four-on-the-floor": "Four on the floor",
  "half-time": "Half-time",
  "boom-bap": "Boom bap",
  none: "None",
  triads: "Triads",
  sevenths: "Sevenths",
  held: "Held",
  pulsing: "Pulsing",
  roots: "Roots",
  octaves: "Octaves",
  walking: "Walking",
  low: "Low",
  medium: "Medium",
  high: "High",
};
