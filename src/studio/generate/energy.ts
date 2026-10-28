import type { Style } from "./style";

/** How much harder or softer each energy plays than medium. */
const velocityScale: Record<Style["energy"], number> = { low: 0.8, medium: 1, high: 1.15 };

/** A part's velocity at a Style's energy, kept to MIDI's 1–127. Medium plays as written. */
export function atEnergy(velocity: number, energy: Style["energy"]): number {
  return Math.min(127, Math.max(1, Math.round(velocity * velocityScale[energy])));
}
