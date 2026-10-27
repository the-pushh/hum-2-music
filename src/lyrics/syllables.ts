import { syllable } from "syllable";

/** A whole line in brackets or parentheses is a section tag like "[Chorus]", not a sung line. */
const SECTION_TAG = /^\s*[[(][^\])]*[\])]\s*$/;

/** Common lyric words the `syllable` package miscounts (it reads "going" as 1, "seeing" as 3). */
const OVERRIDES: Record<string, number> = { going: 2, doing: 2, seeing: 2, fleeing: 2, freeing: 2, agreeing: 3 };

/** Syllables in one lyric line, or null for lines that aren't sung (blank lines and section tags). */
export function lineSyllables(line: string): number | null {
  if (!line.trim() || SECTION_TAG.test(line)) return null;
  return line
    .toLowerCase()
    .split(/[^a-z']+/)
    .filter(Boolean)
    .reduce((sum, word) => sum + (OVERRIDES[word] ?? syllable(word)), 0);
}
