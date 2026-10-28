"use client";

import { takeOf } from "@/melody/client";
import type { VoiceIdea } from "@/sketches/types";
import { postDescription } from "@/studio/direction/client";
import type { DescribeContext } from "@/studio/direction/context";
import type { DescribeError } from "@/studio/direction/describe";
import { defaultStyle } from "@/studio/generate/style";
import { NOTE_NAMES } from "@/studio/music";
import { defaultInstrument, type InstrumentId } from "./instruments";

/**
 * Asks Claude (through Describe it's route) which instrument the songwriter's words mean for one hum, when the keyword
 * reader found none: "something dreamy and 80s". Only the words and this hum's tempo and key are sent, and only the
 * answer's instrument for this hum is used; anything else Claude read is ignored.
 */
export async function askClaudeForInstrument(
  idea: VoiceIdea,
  words: string,
  signal?: AbortSignal,
): Promise<{ instrument: InstrumentId | undefined } | { error: DescribeError }> {
  const t = idea.transcription;
  const key = t?.status === "done" && t.kind !== "beat" ? t.key : { tonic: 0, mode: "major" as const };
  const context: DescribeContext = {
    bpm: takeOf(idea).bpm,
    key: NOTE_NAMES[key.tonic],
    scale: key.mode,
    style: defaultStyle,
    tracks: [{ id: idea.id, name: "This hum", role: "melody", kind: "hummed melody", instrument: idea.instrument ?? defaultInstrument }],
  };
  const result = await postDescription({ description: `Play this hum as: ${words}`, context }, signal);
  if (!result.ok) return { error: result.error };
  return { instrument: result.direction.instruments?.find((i) => i.trackId === idea.id)?.instrument };
}
