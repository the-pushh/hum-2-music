import type { Place } from "@/sketches/types";

/** Every idea card is this wide on the canvas, as it was in the grid. */
export const CARD_WIDTH = 240;
/** The room kept between cards that hum places itself. */
export const CARD_GAP = 24;
/** The room kept around the cards when the view is fitted to them. */
const VIEW_PADDING = 48;

export type Size = { w: number; h: number };
export type Rect = Place & Size;
/** How the canvas is shown: where its origin sits on screen, and how far it's zoomed. */
export type View = Place & { scale: number };

/**
 * The first layout for a sketch's cards: in order, each into the shortest of `columns` columns, like the old grid.
 * Returns each card's place by id.
 */
export function columnLayout(cards: { id: string; h: number }[], columns: number): Record<string, Place> {
  const bottoms = Array<number>(Math.max(1, columns)).fill(0);
  const places: Record<string, Place> = {};
  for (const { id, h } of cards) {
    const col = bottoms.indexOf(Math.min(...bottoms));
    places[id] = { x: col * (CARD_WIDTH + CARD_GAP), y: bottoms[col] };
    bottoms[col] += h + CARD_GAP;
  }
  return places;
}

const clear = (spot: Rect, taken: Rect[]) =>
  taken.every(
    (t) =>
      spot.x >= t.x + t.w + CARD_GAP || t.x >= spot.x + spot.w + CARD_GAP || spot.y >= t.y + t.h + CARD_GAP || t.y >= spot.y + spot.h + CARD_GAP,
  );

/**
 * The place nearest to `near` (the card's centre) where a card of this size touches no other card, keeping a gap.
 * Looks on a grid out to a few screens away; past that, the card goes below everything.
 */
export function freeSpot(taken: Rect[], { w, h }: Size, near: Place): Place {
  const step = CARD_GAP;
  const reach = 60;
  const origin = { x: Math.round(near.x - w / 2), y: Math.round(near.y - h / 2) };
  const candidates: (Place & { d: number })[] = [];
  for (let i = -reach; i <= reach; i++) {
    for (let j = -reach; j <= reach; j++) candidates.push({ x: origin.x + i * step, y: origin.y + j * step, d: i * i + j * j });
  }
  candidates.sort((a, b) => a.d - b.d);
  const spot = candidates.find((c) => clear({ x: c.x, y: c.y, w, h }, taken));
  if (spot) return { x: spot.x, y: spot.y };
  return { x: origin.x, y: Math.max(...taken.map((t) => t.y + t.h)) + CARD_GAP };
}

/** The view that shows every card, centred, no closer than actual size and no further out than `minScale`. */
export function fitView(cards: Rect[], viewport: Size, { minScale = 0.2 }: { minScale?: number } = {}): View {
  if (cards.length === 0) return { x: VIEW_PADDING, y: VIEW_PADDING, scale: 1 };
  const left = Math.min(...cards.map((c) => c.x));
  const top = Math.min(...cards.map((c) => c.y));
  const width = Math.max(...cards.map((c) => c.x + c.w)) - left;
  const height = Math.max(...cards.map((c) => c.y + c.h)) - top;
  const fit = Math.min((viewport.w - 2 * VIEW_PADDING) / width, (viewport.h - 2 * VIEW_PADDING) / height);
  const scale = Math.max(minScale, Math.min(1, fit));
  return { x: (viewport.w - width * scale) / 2 - left * scale, y: (viewport.h - height * scale) / 2 - top * scale, scale };
}
