import type { Key } from "./types";

const names = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];

/** "C major", "F♯ minor". */
export function keyName(key: Key): string {
  return `${names[key.tonic]} ${key.mode}`;
}

/** Every key, majors first, for pickers. */
export const allKeys: Key[] = (["major", "minor"] as const).flatMap((mode) => names.map((_, tonic) => ({ tonic, mode })));

export function sameKey(a: Key, b: Key) {
  return a.tonic === b.tonic && a.mode === b.mode;
}
