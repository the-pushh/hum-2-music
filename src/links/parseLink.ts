export type LinkProvider = "youtube" | "spotify" | "web";

/** A pasted link, normalised. Media links carry the oEmbed endpoint that describes them (title, thumbnail). */
export type LinkTarget = { url: string; provider: "youtube" | "spotify"; oembed: string } | { url: string; provider: "web" };

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com"]);

function isYoutubeMedia(u: URL): boolean {
  if (u.hostname === "youtu.be") return u.pathname.length > 1;
  if (!YOUTUBE_HOSTS.has(u.hostname)) return false;
  return (u.pathname === "/watch" && u.searchParams.has("v")) || u.pathname.startsWith("/shorts/");
}

function isSpotifyMedia(u: URL): boolean {
  return u.hostname === "open.spotify.com" && /^\/(intl-[a-z-]+\/)?(track|album|playlist)\/\w+/i.test(u.pathname);
}

/** Turns pasted text into a link hum can save, or null if it isn't an http(s) address. */
export function parseLink(raw: string): LinkTarget | null {
  const text = raw.trim();
  if (!text || /\s/.test(text)) return null;
  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(text);
  // A bare address like "youtu.be/abc" gets https; anything with another scheme (javascript:, ftp:) is refused.
  if (!hasScheme && !/^[\w-]+(\.[\w-]+)+(\/|$)/.test(text)) return null;

  let u: URL;
  try {
    u = new URL(hasScheme ? text : `https://${text}`);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;

  const url = hasScheme ? text : u.href;
  if (isYoutubeMedia(u)) return { url, provider: "youtube", oembed: `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}` };
  if (isSpotifyMedia(u)) return { url, provider: "spotify", oembed: `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}` };
  return { url, provider: "web" };
}
