import type { Place } from "@/sketches/types";

/** Every idea and sketch card is this wide on the canvas, as an idea was in the grid. */
export const CARD_WIDTH = 240;
/** The room kept between pieces that hum places itself. */
export const CARD_GAP = 24;
/** The page view leaves this much room at the screen's left edge, and above the page, as the pages had. */
const PAGE_GUTTER = 16;
const PAGE_TOP = 32;

/**
 * The class for parts of a canvas piece that work their own gestures: a piano roll, a drum grid, a scrolling timeline.
 * Pressing on them never moves the piece or pans the page, and scrolling over them scrolls them.
 */
export const canvasControl = "canvas-control";

export type Size = { w: number; h: number };
export type Rect = Place & Size;
/** How the canvas is shown: where its origin sits on screen, and how far it's zoomed. */
export type View = Place & { scale: number };

/** How wide a card is that spans this many columns of the grid. */
export function spanWidth(span: number, gap: number) {
  return span * CARD_WIDTH + (span - 1) * gap;
}

/**
 * Cards in order, each into the shortest of `columns` columns, like the old grid, starting at `top`. A card with a
 * `span` takes that many columns side by side, wherever they end highest (one column, when there's only one).
 * Returns each card's place by id.
 */
export function columnLayout(
  cards: { id: string; h: number; span?: number }[],
  columns: number,
  { gap = CARD_GAP, top = 0 }: { gap?: number; top?: number } = {},
): Record<string, Place> {
  const bottoms = Array<number>(Math.max(1, columns)).fill(top);
  const places: Record<string, Place> = {};
  for (const { id, h, span = 1 } of cards) {
    const width = Math.min(span, bottoms.length);
    let col = 0;
    let y = Infinity;
    for (let c = 0; c + width <= bottoms.length; c++) {
      const below = Math.max(...bottoms.slice(c, c + width));
      if (below < y) [col, y] = [c, below];
    }
    places[id] = { x: col * (CARD_WIDTH + gap), y };
    bottoms.fill(y + h + gap, col, col + width);
  }
  return places;
}

/**
 * A page's sections one under another, as the page laid them out: each at the left edge of a page `width` wide, or at
 * its right edge with `align: "end"`. Returns their places and where the last one ends.
 */
export function stack(
  pieces: { id: string; size: Size; align?: "end" }[],
  { width, gap, top = 0 }: { width: number; gap: number; top?: number },
): { places: Record<string, Place>; bottom: number } {
  const places: Record<string, Place> = {};
  let y = top;
  pieces.forEach(({ id, size, align }, i) => {
    if (i > 0) y += gap;
    places[id] = { x: align === "end" ? width - size.w : 0, y };
    y += size.h;
  });
  return { places, bottom: y };
}

const clear = (spot: Rect, taken: Rect[], gap: number) =>
  taken.every((t) => spot.x >= t.x + t.w + gap || t.x >= spot.x + spot.w + gap || spot.y >= t.y + t.h + gap || t.y >= spot.y + spot.h + gap);

/**
 * The place nearest to `near` (the card's centre) where a card of this size touches no other card, keeping `gap`.
 * Looks on a grid out to a few screens away; past that, the card goes below everything.
 */
export function freeSpot(taken: Rect[], { w, h }: Size, near: Place, gap = CARD_GAP): Place {
  const step = CARD_GAP;
  const reach = 60;
  const origin = { x: Math.round(near.x - w / 2), y: Math.round(near.y - h / 2) };
  const candidates: (Place & { d: number })[] = [];
  for (let i = -reach; i <= reach; i++) {
    for (let j = -reach; j <= reach; j++) candidates.push({ x: origin.x + i * step, y: origin.y + j * step, d: i * i + j * j });
  }
  candidates.sort((a, b) => a.d - b.d);
  const spot = candidates.find((c) => clear({ x: c.x, y: c.y, w, h }, taken, gap));
  if (spot) return { x: spot.x, y: spot.y };
  return { x: origin.x, y: Math.max(...taken.map((t) => t.y + t.h)) + gap };
}

/**
 * The view the page opens at, and Reset canvas returns to: actual size, from the top of everything on it, like the page
 * before it was a canvas. Centred when it fits the screen, otherwise from its left edge.
 */
export function pageView(pieces: Rect[], viewport: Size): View {
  if (pieces.length === 0) return { x: PAGE_GUTTER, y: PAGE_TOP, scale: 1 };
  const left = Math.min(...pieces.map((p) => p.x));
  const top = Math.min(...pieces.map((p) => p.y));
  const width = Math.max(...pieces.map((p) => p.x + p.w)) - left;
  const x = width <= viewport.w - 2 * PAGE_GUTTER ? (viewport.w - width) / 2 - left : PAGE_GUTTER - left;
  return { x, y: PAGE_TOP - top, scale: 1 };
}
