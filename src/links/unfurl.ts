import { lookup } from "node:dns/promises";
import ogs from "open-graph-scraper";
import { isPublicAddress } from "./publicAddress";
import { parseLink } from "./parseLink";

export type Unfurled = { title?: string; description?: string; image?: string; siteName?: string };

const TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 4;
const MAX_BYTES = 1_000_000;

export class UnfurlError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 422 | 502,
  ) {
    super(message);
  }
}

/** Refuses hosts that resolve to private or local addresses, so the route can't be used to probe the server's network. */
async function assertPublicHost(url: URL, signal: AbortSignal) {
  const aborted = new Promise<never>((_, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }));
  const addresses = await Promise.race([lookup(url.hostname, { all: true }), aborted]).catch((e) => {
    if (signal.aborted) throw e;
    return [];
  });
  if (!addresses.length || !addresses.every((a) => isPublicAddress(a.address))) {
    throw new UnfurlError("That address isn't on the public internet.", 422);
  }
}

/** Fetches a page's HTML, checking every redirect hop against the public-address guard. */
async function fetchHtml(start: URL, signal: AbortSignal): Promise<{ html: string; finalUrl: URL }> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new UnfurlError("Redirected to a non web address.", 422);
    await assertPublicHost(url, signal);
    const res = await fetch(url, {
      redirect: "manual",
      signal,
      headers: { "user-agent": "humbot/1.0 (link previews)", accept: "text/html,application/xhtml+xml" },
    });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      await res.body?.cancel();
      url = new URL(location, url);
      continue;
    }
    if (!res.ok) throw new UnfurlError(`The page answered ${res.status}.`, 502);
    if (!(res.headers.get("content-type") ?? "").includes("html")) throw new UnfurlError("That link isn't a web page.", 422);
    return { html: await readCapped(res), finalUrl: url };
  }
  throw new UnfurlError("Too many redirects.", 502);
}

async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
  }
  await reader.cancel().catch(() => {});
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/** Title, description, image and site name for a web page, from its Open Graph / meta tags. */
export async function unfurl(raw: string): Promise<Unfurled> {
  const target = parseLink(raw);
  if (!target) throw new UnfurlError("That isn't a web address.", 400);

  const { html, finalUrl } = await fetchHtml(new URL(target.url), AbortSignal.timeout(TIMEOUT_MS));
  const { result } = await ogs({ html });
  const image = result.ogImage?.[0]?.url ?? result.twitterImage?.[0]?.url;
  const imageUrl = image ? new URL(image, finalUrl) : undefined;

  return {
    title: result.ogTitle ?? result.twitterTitle ?? result.dcTitle,
    description: result.ogDescription ?? result.twitterDescription,
    image: imageUrl?.protocol === "https:" ? imageUrl.href : undefined,
    siteName: result.ogSiteName ?? finalUrl.hostname.replace(/^www\./, ""),
  };
}
