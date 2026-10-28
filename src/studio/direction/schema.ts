import { z } from "zod";
import { instrumentIds, type InstrumentId } from "@/instruments/instruments";
import { styleChoices } from "@/studio/generate/style";
import { NOTE_NAMES } from "@/studio/music";

/** The parts of a Style a description can change; each is optional, so a Direction names only what changes. */
const styleChanges = z.object({
  drums: z.enum(styleChoices.drums).optional(),
  chords: z.enum(styleChoices.chords).optional(),
  chordRhythm: z.enum(styleChoices.chordRhythm).optional(),
  bass: z.enum(styleChoices.bass).optional(),
  energy: z.enum(styleChoices.energy).optional(),
});

/**
 * What hum read from a songwriter's description of their song: only what should change. The same schema shapes
 * Claude's structured output and validates it on the way back.
 */
export const directionSchema = z.object({
  /** False when nothing in the words maps to a change hum can make. */
  understood: z.boolean(),
  /** One short line hum shows back before anything changes, e.g. "72 BPM · half-time drums · low energy". */
  summary: z.string(),
  bpm: z.number().int().min(40).max(200).optional(),
  /** The new tonic, e.g. "D". */
  key: z.enum(NOTE_NAMES).optional(),
  scale: z.enum(["major", "minor"]).optional(),
  style: styleChanges.optional(),
  /** Hummed melody tracks to play on another instrument, by track id from the arrangement Claude was given. */
  instruments: z
    .array(z.object({ trackId: z.string(), instrument: z.enum(instrumentIds as [InstrumentId, ...InstrumentId[]]) }))
    .optional(),
});

export type Direction = z.infer<typeof directionSchema>;
