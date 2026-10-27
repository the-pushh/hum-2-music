import { LinkSimple, Microphone, NotePencil, Palette, TextAa, ImageSquare, type Icon } from "@phosphor-icons/react";
import { formatDuration } from "@/audio/formatDuration";
import { lyricsLines } from "@/lyrics/doc";
import type { Idea } from "@/sketches/types";

/** A one-line description of any idea, for compact lists (arranging, confirming deletes). */
export function ideaSummary(idea: Idea): { icon: Icon; label: string } {
  switch (idea.kind) {
    case "note":
      return { icon: NotePencil, label: idea.text };
    case "voice":
      return { icon: Microphone, label: `Hum, ${formatDuration(idea.durationSec)}` };
    case "lyrics":
      return { icon: TextAa, label: lyricsLines(idea.doc).find((l) => l.trim() && !l.startsWith("[")) ?? "Empty lyrics" };
    case "image":
      return { icon: ImageSquare, label: "Picture" };
    case "link":
      return { icon: LinkSimple, label: idea.title ?? idea.url };
    case "color":
      return { icon: Palette, label: `Color ${idea.hex}` };
  }
}
