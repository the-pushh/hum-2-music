import { instrumentIds, instruments, type InstrumentId } from "./instruments";

/** Lowercase words, without punctuation: "Not piano, strings!" → ["not", "piano", "strings"]. */
function wordsOf(text: string): string[] {
  return text.toLowerCase().split(/[^a-z]+/).filter(Boolean);
}

/** Every instrument's names as word lists, longest first, so "electric piano" is tried before "piano". */
const names = instrumentIds
  .flatMap((id) => instruments[id].words.map((name) => ({ id, words: wordsOf(name) })))
  .sort((a, b) => b.words.length - a.words.length);

/**
 * The instrument a songwriter named, typed or spoken ("I want it as a piano", "make this the bassline"), or nothing if
 * no instrument's name is in it. Names match whole words. When several are named, the last one wins, so a correction
 * ("not piano, strings") takes effect.
 */
export function readInstruction(text: string): InstrumentId | undefined {
  const words = wordsOf(text);
  let found: { id: InstrumentId; end: number } | undefined;
  for (let end = 1; end <= words.length; end++) {
    const match = names.find((name) => name.words.length <= end && name.words.every((w, i) => words[end - name.words.length + i] === w));
    if (match) found = { id: match.id, end };
  }
  return found?.id;
}
