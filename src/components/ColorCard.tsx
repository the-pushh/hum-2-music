import type { ColorInput, Idea } from "@/sketches/types";
import { readableInk } from "@/ui/readableInk";

export function ColorCard({ idea }: { idea: Idea & ColorInput }) {
  const ink = readableInk(idea.hex) === "dark" ? "text-canvas" : "text-ink";
  return (
    <article
      className="flex aspect-square items-end rounded-2xl border border-line p-4"
      style={{ backgroundColor: idea.hex }}
      aria-label={`Colour ${idea.hex}`}
    >
      <span className={`font-mono text-sm font-semibold uppercase ${ink}`}>{idea.hex}</span>
    </article>
  );
}
