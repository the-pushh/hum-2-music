import { captureIdea, sketchStore } from "@/sketches/client";
import type { LinkInput } from "@/sketches/types";
import { fetchOEmbed } from "./oembed";
import type { LinkTarget } from "./parseLink";

/**
 * Saves the link straight away (so it's never lost, even offline), then fills in its preview.
 * A failed preview leaves a plain URL card.
 */
export async function captureLink(openSketchId: string | null, target: LinkTarget) {
  const link: LinkInput = { kind: "link", url: target.url, provider: target.provider };
  const result = await captureIdea(openSketchId, link);
  void fetchPreview(target)
    .then((preview) => sketchStore().updateIdea(result.idea.id, { ...link, ...preview }))
    .catch(() => {});
  return result;
}

type Unfurled = { title?: string; description?: string; image?: string; siteName?: string };

async function fetchPreview(target: LinkTarget): Promise<Partial<LinkInput>> {
  if (target.provider !== "web") return fetchOEmbed(target);
  // Other sites don't allow browser requests for their HTML, so hum's own route reads the page.
  const res = await fetch(`/api/unfurl?url=${encodeURIComponent(target.url)}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`unfurl ${res.status}`);
  const page = (await res.json()) as Unfurled;
  return { title: page.title, description: page.description, thumb: page.image, author: page.siteName };
}
