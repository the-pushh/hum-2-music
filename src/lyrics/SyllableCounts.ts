import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { lineSyllables } from "./syllables";

/** Tags every lyric line with its syllable count; CSS shows it in the margin (see .lyrics in globals.css). */
export const SyllableCounts = Extension.create({
  name: "syllableCounts",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("syllableCounts"),
        props: {
          decorations(state) {
            const marks: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (node.type.name !== "paragraph") return true;
              const count = lineSyllables(node.textContent);
              if (count !== null) marks.push(Decoration.node(pos, pos + node.nodeSize, { "data-syllables": String(count) }));
              return false;
            });
            return DecorationSet.create(state.doc, marks);
          },
        },
      }),
    ];
  },
});
