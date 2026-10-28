import type { Grid, Note, Take } from "@/melody/types";

/**
 * Tightens a beat. A clicked take's hits snap to the grid, and two hits of the same drum on one step become the louder
 * one. A free take had no click to follow, so its timing is kept, like a free melody's.
 */
export function cleanupBeat(raw: Note[], grid: Grid, take: Take): Note[] {
  const sorted = [...raw].sort((a, b) => a.start - b.start);
  if (!take.click) return sorted;
  const step = 4 / grid;
  const bySlot = new Map<string, Note>();
  for (const hit of sorted) {
    const start = Math.max(0, Math.round(hit.start / step) * step);
    const slot = `${hit.pitch}@${start}`;
    const kept = bySlot.get(slot);
    if (!kept || hit.velocity > kept.velocity) bySlot.set(slot, { ...hit, start });
  }
  return [...bySlot.values()].sort((a, b) => a.start - b.start || a.pitch - b.pitch);
}
