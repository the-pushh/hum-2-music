import type Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { claudeErrorOf, type ClaudeCallError } from "@/studio/claude/errors";
import type { WriteRequest } from "./request";
import { maxNotesPerPart, tidyParts, type TidyParts } from "./tidy";

export type { WriteRequest } from "./request";

/** The longest arrangement Claude writes for. Longer ones are refused before calling it. */
export const maxBars = 32;

export type WriteError = ClaudeCallError | "declined" | "too-long" | "nothing-to-write" | "bad-request";
export type WriteResult = { ok: true; parts: TidyParts; summary: string } | { ok: false; error: WriteError };

/** The one Claude call this needs, so tests can stand in for it. */
export type ParseParts = (
  params: Anthropic.Beta.Messages.MessageCreateParamsNonStreaming,
  options?: { signal?: AbortSignal },
) => Promise<Pick<Anthropic.Beta.Messages.BetaMessage, "stop_reason"> & { parsed_output: unknown }>;

/** Notes as Claude writes them. Loose on purpose: tidyParts makes them playable, so one stray note doesn't sink a take. */
const note = z.object({ pitch: z.number(), startBeat: z.number(), duration: z.number(), velocity: z.number() });
const part = z.array(note).max(maxNotesPerPart * 2);
const replySchema = z.object({
  /** One short line the songwriter sees after the parts land, e.g. "Pulsing sevenths, a walking bass, a half time groove". */
  summary: z.string(),
  chords: part.optional(),
  bass: part.optional(),
  drums: part.optional(),
});

const system = `You write backing parts for a songwriter's hummed melody in a music app called hum. You are given the song's plan (tempo, key, scale, beats per bar, number of bars, and a Style), the melody as notes, any hummed drum beat as hits, which parts to write, and an optional note from the songwriter. Write only the parts asked for.

Notes: pitch is a MIDI number, startBeat and duration are in beats from the start of the song, velocity is 1 to 127. Stay inside the song: every note starts before bars × beatsPerBar.

- chords: chord voicings, around C3 to G5. Harmonize the melody: where the melody sits on strong beats should be a chord tone or a clear passing note. Passing chords and chromatic colour are welcome when they suit the Style.
- bass: around E1 to G3. Lock to the kick (the hummed beat's 36s if there is one, otherwise your own drums), lead into chord changes, and move more in later bars than earlier ones.
- drums: General MIDI drum pitches only: 36 kick, 38 snare, 39 clap, 42 closed hi hat, 46 open hi hat, 49 crash, 51 ride, 41 43 45 47 48 50 toms. Make it groove, not loop: small variations every few bars, and a fill into the last bar.

The Style is a starting point for feel and density (energy low means sparse and soft, high means busy and loud). The songwriter's note overrides it where they conflict.

The summary is one short line naming what you wrote, without hyphens, like "Pulsing sevenths, a walking bass, a half time groove with a fill".`;

/**
 * Asks Claude to write parts for the arrangement, then tidies them so hum can play them. Only notes and the song's
 * settings are sent. Every failure comes back as a typed error the studio can explain, never a throw.
 */
export async function writeParts(request: WriteRequest, parse: ParseParts, signal?: AbortSignal): Promise<WriteResult> {
  if (!request.parts.length) return { ok: false, error: "nothing-to-write" };
  if (request.plan.bars > maxBars) return { ok: false, error: "too-long" };
  try {
    const response = await parse(
      {
        model: "claude-opus-5-5",
        // Room for sixteenth hats over 32 bars plus chords and bass, as JSON.
        max_tokens: 32000,
        // Writing music is a creative task: more thought than reading a description.
        output_config: { effort: "medium", format: betaZodOutputFormat(replySchema) },
        // If Claude's safety classifiers decline, the API retries on Anthropic's recommended fallback model.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system,
        messages: [{ role: "user", content: JSON.stringify(request) }],
      },
      { signal },
    );
    if (response.stop_reason === "refusal") return { ok: false, error: "declined" };
    const reply = replySchema.safeParse(response.parsed_output);
    if (!reply.success) return { ok: false, error: "invalid-output" };
    const asked = Object.fromEntries(request.parts.map((p) => [p, reply.data[p] ?? []]));
    const parts = tidyParts(request.plan, asked);
    return parts ? { ok: true, parts, summary: reply.data.summary } : { ok: false, error: "invalid-output" };
  } catch (err) {
    return { ok: false, error: claudeErrorOf(err) };
  }
}
