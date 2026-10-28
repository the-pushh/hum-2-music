"use client";

let ctx: AudioContext | undefined;

/**
 * hum's one AudioContext for making sound (piano, click), so they share a clock.
 * Call it from a tap: browsers only let audio start after a user gesture.
 */
export async function audioContext(): Promise<AudioContext> {
  ctx ??= new AudioContext({ latencyHint: "interactive" });
  if (ctx.state !== "running") await ctx.resume();
  return ctx;
}
