export type Rhymes = { perfect: string[]; near: string[] };

type DatamuseWord = { word: string };

async function datamuse(rel: "rel_rhy" | "rel_nry", word: string, max: number, signal: AbortSignal): Promise<string[]> {
  const res = await fetch(`https://api.datamuse.com/words?${rel}=${encodeURIComponent(word)}&max=${max}`, { signal });
  if (!res.ok) throw new Error(`Datamuse ${res.status}`);
  return ((await res.json()) as DatamuseWord[]).map((w) => w.word);
}

/** Rhymes for a word from Datamuse (free, keyless, CORS-enabled). Near rhymes are looser, so fewer of them. */
export async function fetchRhymes(word: string, signal: AbortSignal): Promise<Rhymes> {
  const [perfect, near] = await Promise.all([
    datamuse("rel_rhy", word, 30, signal),
    datamuse("rel_nry", word, 12, signal),
  ]);
  return { perfect, near: near.filter((w) => !perfect.includes(w)) };
}
