import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { styleChoices } from "@/studio/generate/style";
import { NOTE_NAMES } from "@/studio/music";
import { writeParts, type WriteResult } from "@/studio/write/write";

const requestSchema = z.object({
  plan: z.object({
    bpm: z.number().min(40).max(200),
    key: z.enum(NOTE_NAMES),
    scale: z.enum(["major", "minor"]),
    beatsPerBar: z.number().int().min(1).max(12),
    bars: z.number().int().min(1).max(256),
    style: z.object({
      drums: z.enum(styleChoices.drums),
      chords: z.enum(styleChoices.chords),
      chordRhythm: z.enum(styleChoices.chordRhythm),
      bass: z.enum(styleChoices.bass),
      energy: z.enum(styleChoices.energy),
    }),
  }),
  melody: z.array(z.object({ pitch: z.number(), startBeat: z.number(), duration: z.number() })).max(2000),
  beat: z.array(z.object({ pitch: z.number(), startBeat: z.number() })).max(2000),
  parts: z.array(z.enum(["chords", "bass", "drums"])).max(3),
  note: z.string().max(300),
});

/** Writing parts can take a while: past this the studio says it took too long. One try, so the wait isn't doubled. */
const timeoutMs = 120_000;

/**
 * Writes chords, bass and drums for an arrangement with Claude. The key stays on the server (ANTHROPIC_API_KEY in
 * .env.local); only the plan, the melody and beat as notes, and the songwriter's note are sent.
 */
export async function POST(request: Request): Promise<Response> {
  const body = requestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ ok: false, error: "bad-request" } satisfies WriteResult, { status: 400 });
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return Response.json({ ok: false, error: "not-configured" } satisfies WriteResult);
  }

  const client = new Anthropic({ timeout: timeoutMs, maxRetries: 0 });
  // Streamed, since a reply can be long; finalMessage gives the parsed reply once it's all in.
  const result = await writeParts(body.data, (params, options) => client.beta.messages.stream(params, options).finalMessage(), request.signal);
  return Response.json(result);
}
