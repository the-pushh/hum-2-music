import type { Idea } from "@/sketches/types";

/**
 * Each kind of idea has a bright color, the same family as the studio's track colors, with dark ink on it.
 * A hum is lime like the melody it becomes. Images and colors show themselves instead.
 */
export const ideaBg: Record<Exclude<Idea["kind"], "image" | "color">, string> = {
  voice: "bg-melody",
  lyrics: "bg-keys",
  note: "bg-vocals",
  link: "bg-drums",
};

/** For the capture chips, including the kinds that have no card color of their own. */
export const captureBg = { ...ideaBg, image: "bg-fx", color: "bg-bass" } as const;

/** A round button sitting on a bright card: dark on the card's color. Pair with sr-only text. */
export const onColorButton =
  "inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-canvas text-ink transition duration-300 ease-soft hover:opacity-90 active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-canvas disabled:opacity-50";
