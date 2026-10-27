import type { LinkTarget } from "./parseLink";

type Preview = { title?: string; thumb?: string; author?: string };
type OEmbed = { title?: string; thumbnail_url?: string; author_name?: string };

const TIMEOUT_MS = 5000;

/** Title and thumbnail for a YouTube or Spotify link. Both endpoints allow browser requests. */
export async function fetchOEmbed(target: Extract<LinkTarget, { oembed: string }>): Promise<Preview> {
  const res = await fetch(target.oembed, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`oEmbed ${res.status}`);
  const data = (await res.json()) as OEmbed;
  return { title: data.title, thumb: data.thumbnail_url, author: data.author_name };
}
