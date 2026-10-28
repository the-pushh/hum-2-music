"use client";

import * as Tone from "tone";
import { audioContext } from "./context";

let toneReady: Promise<void> | undefined;

/** Tone runs on hum's AudioContext, so the click, the piano and the studio share one clock. Call it from a tap. */
export async function tone(): Promise<void> {
  toneReady ??= audioContext().then((ctx) => Tone.setContext(new Tone.Context(ctx)));
  await toneReady;
  // Resume on every tap too: phones suspend the context when the page is hidden.
  await audioContext();
}
