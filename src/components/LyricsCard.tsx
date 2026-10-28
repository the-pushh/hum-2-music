import Link from "next/link";
import { lyricsLines } from "@/lyrics/doc";
import type { Idea, LyricsInput } from "@/sketches/types";
import { ideaBg } from "@/ui/ideaColors";

const PREVIEW_LINES = 6;

export function LyricsCard({ idea }: { idea: Idea & LyricsInput }) {
  const lines = lyricsLines(idea.doc).filter((l) => l.trim());
  const sung = lines.filter((l) => !l.startsWith("["));
  return (
    <Link
      href={`/s/${idea.sketchId}/lyrics/${idea.id}`}
      className={`flex flex-col gap-1 rounded-2xl p-4 text-canvas transition duration-300 ease-soft hover:opacity-90 active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${ideaBg.lyrics}`}
    >
      <span className="text-xs font-semibold uppercase opacity-70">Lyrics</span>
      {sung.length === 0 ? (
        <span className="text-base opacity-70">Empty so far. Tap to write.</span>
      ) : (
        lines.slice(0, PREVIEW_LINES).map((line, i) =>
          line.startsWith("[") ? (
            <span key={i} className="pt-2 text-xs opacity-70">
              {line.slice(1, -1)}
            </span>
          ) : (
            <span key={i} className="text-base">
              {line}
            </span>
          ),
        )
      )}
    </Link>
  );
}
