import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { instrumentIds, type InstrumentId } from "@/instruments/instruments";
import { styleChoices } from "@/studio/generate/style";
import { readDescription, type DescribeResult } from "@/studio/direction/describe";
import { NOTE_NAMES } from "@/studio/music";
import { TRACK_ROLES } from "@/studio/types";

const requestSchema = z.object({
  description: z.string().max(500),
  context: z.object({
    bpm: z.number(),
    key: z.enum(NOTE_NAMES),
    scale: z.enum(["major", "minor"]),
    style: z.object({
      drums: z.enum(styleChoices.drums),
      chords: z.enum(styleChoices.chords),
      chordRhythm: z.enum(styleChoices.chordRhythm),
      bass: z.enum(styleChoices.bass),
      energy: z.enum(styleChoices.energy),
    }),
    tracks: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          role: z.enum(TRACK_ROLES),
          kind: z.enum(["hummed melody", "hummed beat", "generated", "added by hand"]),
          instrument: z.enum(instrumentIds as [InstrumentId, ...InstrumentId[]]).optional(),
        }),
      )
      .max(32),
  }),
});

/** Claude answers in a few seconds; past this the studio says so rather than leaving the songwriter waiting. */
const timeoutMs = 20_000;

/**
 * Reads a description of the song into a Direction with Claude. The key stays on the server (ANTHROPIC_API_KEY in
 * .env.local); only the words and the arrangement's settings are sent.
 */
export async function POST(request: Request): Promise<Response> {
  const body = requestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "bad-request" }, { status: 400 });
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return Response.json({ ok: false, error: "not-configured" } satisfies DescribeResult);
  }

  const client = new Anthropic({ timeout: timeoutMs, maxRetries: 1 });
  const result = await readDescription(body.data, (params, options) => client.beta.messages.parse(params, options), request.signal);
  return Response.json(result);
}
