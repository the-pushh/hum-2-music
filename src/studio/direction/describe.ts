import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { DescribeContext } from "./context";
import { directionSchema, type Direction } from "./schema";

export type { DescribeContext } from "./context";

export type DescribeRequest = { description: string; context: DescribeContext };

export type DescribeError = "empty" | "not-configured" | "offline" | "upstream" | "timeout" | "invalid-output" | "declined";
export type DescribeResult = { ok: true; direction: Direction } | { ok: false; error: DescribeError };

/** The one Claude call this needs, so tests can stand in for it. */
export type ParseDirection = (
  params: Anthropic.Beta.Messages.MessageCreateParamsNonStreaming,
  options?: { signal?: AbortSignal },
) => Promise<{ stop_reason: string | null; parsed_output: unknown }>;

const system = `You help a songwriter shape a song sketch in a music app called hum. They describe what they want in their own words; you turn it into a Direction: only the changes their words ask for.

What you can change:
- bpm: the tempo, 40 to 200. "Slower" or "faster" means about 10 to 20 BPM from the current tempo unless they say how much. "Around 90" means 90.
- key: the tonic, one of C C# D D# E F F# G G# A A# B. "In D" means D. "Up a tone" or "down a semitone" moves from the current key. The whole song moves with it, hummed melodies included.
- scale: major or minor. "Darker", "sadder" or "moody" mean minor; "brighter" or "happier" mean major. Only change it when the words ask for a mood or mode.
- instruments: re-voice the songwriter's hummed melodies, by track id from the arrangement. Only tracks of kind "hummed melody" can be re-voiced. Instruments: piano, electric-piano (keys, Rhodes), strings, bass, guitar, synth-lead, pad, flute, brass. Work out which track they mean from names ("Hum 2"), order ("the first hum") or role ("the melody", "the hook" usually means the first hummed melody).
- style.drums: pop-rock (kick on 1 and 3, snare on 2 and 4), four-on-the-floor (dance, house, disco), half-time (heavy, slow-feeling, trap-like), boom-bap (hip hop), none.
- style.chords: triads (simple, plain), sevenths (lush, jazzy, soulful, dreamy), none.
- style.chordRhythm: held (pads, long chords), pulsing (driving, rhythmic, stabs).
- style.bass: roots (simple), octaves (disco, driving), walking (jazzy, moving), none.
- style.energy: low (chill, soft, laid back, sparse), medium, high (big, loud, busy, energetic).

Leave out anything the words don't ask for. Moods map to style where it's clear ("chill" is low energy; "dancey" is four-on-the-floor). If nothing in the words maps to a change you can make, set understood to false and leave the summary empty.

The summary is one short line the songwriter sees before applying, naming each change in a few words, separated by " · ", like "72 BPM · half-time drums · low energy". Name a re-voiced track as "Hum 1 on strings". Name a key change as "in D", and a mode change as "moved to minor" or "moved to major", so the songwriter knows their melody will change. No other text.`;

/**
 * Reads a songwriter's description of their song into a Direction with Claude. Only the words and the arrangement's
 * settings are sent. Every failure comes back as a typed error the studio can explain, never a throw.
 */
export async function readDescription({ description, context }: DescribeRequest, parse: ParseDirection, signal?: AbortSignal): Promise<DescribeResult> {
  if (!description.trim()) return { ok: false, error: "empty" };
  try {
    const response = await parse(
      {
        model: "claude-opus-5-5",
        max_tokens: 16000,
        // A short, well-specified reading: low effort keeps it quick.
        output_config: { effort: "low", format: betaZodOutputFormat(directionSchema) },
        // If Claude's safety classifiers decline, the API retries on Anthropic's recommended fallback model.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system,
        messages: [{ role: "user", content: JSON.stringify({ description: description.trim(), arrangement: context }) }],
      },
      { signal },
    );
    if (response.stop_reason === "refusal") return { ok: false, error: "declined" };
    const direction = directionSchema.safeParse(response.parsed_output);
    if (!direction.success) return { ok: false, error: "invalid-output" };
    // Instruments may only re-voice hummed melodies the arrangement actually has.
    const voiceable = new Set(context.tracks.filter((t) => t.kind === "hummed melody").map((t) => t.id));
    if (direction.data.instruments?.some((i) => !voiceable.has(i.trackId))) return { ok: false, error: "invalid-output" };
    return { ok: true, direction: direction.data };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) return { ok: false, error: "not-configured" };
    if (err instanceof Anthropic.APIConnectionTimeoutError) return { ok: false, error: "timeout" };
    if (err instanceof Anthropic.APIConnectionError) return { ok: false, error: "offline" };
    if (err instanceof Anthropic.APIError) return { ok: false, error: "upstream" };
    // The SDK's own parse failures, when Claude's output doesn't fit the schema.
    if (err instanceof Anthropic.AnthropicError) return { ok: false, error: "invalid-output" };
    throw err;
  }
}
