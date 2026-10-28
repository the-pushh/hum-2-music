"use client";

import { takeOf } from "@/melody/client";
import type { VoiceIdea } from "@/sketches/types";
import type { DescribeContext } from "@/studio/direction/context";
import type { DescribeError, DescribeResult } from "@/studio/direction/describe";
import { defaultStyle } from "@/studio/generate/style";
import { defaultInstrument, type InstrumentId } from "./instruments";

/**
 * Asks Claude (through Describe it's route) which instrument the songwriter's words mean for one hum, when the keyword
 * reader found none: "something dreamy and 80s". Only the words and this hum's tempo are sent.
 */
export async function askClaudeForInstrument(
  idea: VoiceIdea,
  words: string,
  signal?: AbortSignal,
): Promise<{ instrument: InstrumentId | undefined } | { error: DescribeError | "offline" }> {
  const t = idea.transcription;
  const context: DescribeContext = {
    bpm: takeOf(idea).bpm,
    key: "C",
    scale: t?.status === "done" && t.kind !== "beat" ? t.key.mode : "major",
    style: defaultStyle,
    tracks: [{ id: idea.id, name: "This hum", role: "melody", kind: "hummed melody", instrument: idea.instrument ?? defaultInstrument }],
  };
  try {
    const response = await fetch("/api/describe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ description: `What instrument should this hum play as? ${words}`, context }),
      signal,
    });
    const result: DescribeResult = response.ok ? await response.json() : { ok: false, error: "upstream" };
    if (!result.ok) return { error: result.error };
    return { instrument: result.direction.instruments?.find((i) => i.trackId === idea.id)?.instrument };
  } catch {
    return { error: "offline" };
  }
}
