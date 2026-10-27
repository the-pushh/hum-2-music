/**
 * One object URL per Idea, created on first use and kept until the Idea is deleted.
 * Creating and revoking URLs inside components breaks under StrictMode's double effects
 * (the first cleanup revokes a URL the remounted component still uses).
 */
const urls = new Map<string, string>();

export function objectUrlFor(ideaId: string, blob: Blob): string {
  let url = urls.get(ideaId);
  if (!url) {
    url = URL.createObjectURL(blob);
    urls.set(ideaId, url);
  }
  return url;
}

export function releaseObjectUrl(ideaId: string) {
  const url = urls.get(ideaId);
  if (url) URL.revokeObjectURL(url);
  urls.delete(ideaId);
}
