"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { SONG_PARTS, partLabel, type SongPart } from "./parts";

function SectionView({ node, updateAttributes }: ReactNodeViewProps) {
  const part = node.attrs.part as SongPart;
  return (
    <NodeViewWrapper className="flex flex-col gap-2 rounded-2xl bg-surface p-4" data-part={part}>
      <select
        contentEditable={false}
        value={part}
        onChange={(e) => updateAttributes({ part: e.target.value })}
        aria-label="Song part"
        className="w-fit rounded-lg bg-raised px-2 py-1 text-xs font-semibold text-ink-muted uppercase transition duration-300 ease-soft hover:text-ink active:scale-98 focus-visible:outline-2 focus-visible:outline-ink"
      >
        {SONG_PARTS.map((p) => (
          <option key={p} value={p}>
            {partLabel[p]}
          </option>
        ))}
      </select>
      <NodeViewContent className="lyrics-lines" />
    </NodeViewWrapper>
  );
}

/** A labelled block of lyric lines (verse, chorus, …). Each paragraph inside is one sung line. */
export const SectionNode = Node.create({
  name: "section",
  group: "block",
  content: "paragraph+",
  defining: true,

  addAttributes() {
    return { part: { default: "verse" } };
  },

  parseHTML() {
    return [{ tag: "section[data-part]", getAttrs: (el) => ({ part: (el as HTMLElement).dataset.part }) }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ["section", mergeAttributes(HTMLAttributes, { "data-part": node.attrs.part }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(SectionView);
  },

});
