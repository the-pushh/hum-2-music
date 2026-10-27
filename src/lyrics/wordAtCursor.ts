import type { Editor } from "@tiptap/core";

/** The selected text, or the word the cursor sits in or just after. Empty when there's no word there. */
export function wordAtCursor(editor: Editor): string {
  const { from, to, $from } = editor.state.selection;
  if (from !== to) return editor.state.doc.textBetween(from, to, " ").trim();
  const text = $from.parent.textContent;
  const offset = $from.parentOffset;
  const before = text.slice(0, offset).match(/[\p{L}']+$/u)?.[0] ?? "";
  const after = text.slice(offset).match(/^[\p{L}']+/u)?.[0] ?? "";
  return before + after;
}
