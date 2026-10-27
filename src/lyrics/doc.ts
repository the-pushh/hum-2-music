import type { LyricsDoc } from "@/sketches/types";
import { partLabel, type SongPart } from "./parts";

type Node = { type?: string; text?: string; attrs?: { part?: SongPart }; content?: Node[] };

/** A new lyrics doc: one empty verse, ready to type into. */
export function emptyLyrics(): LyricsDoc {
  return { type: "doc", content: [{ type: "section", attrs: { part: "verse" }, content: [{ type: "paragraph" }] }] };
}

function text(node: Node): string {
  return node.text ?? (node.content ?? []).map(text).join("");
}

/** The doc as readable lines, with part labels, for the card preview. */
export function lyricsLines(doc: LyricsDoc): string[] {
  return ((doc.content ?? []) as Node[]).flatMap((node) =>
    node.type === "section"
      ? [`[${partLabel[node.attrs?.part ?? "verse"]}]`, ...(node.content ?? []).map(text)]
      : [text(node)],
  );
}
