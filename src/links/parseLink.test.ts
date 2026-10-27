import { describe, expect, it } from "vitest";
import { parseLink } from "./parseLink";

const youtubeOembed = (url: string) => `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`;
const spotifyOembed = (url: string) => `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;

describe("parseLink", () => {
  it.each([
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s",
    "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/shorts/aqz-KE-bpKQ",
    "https://youtu.be/dQw4w9WgXcQ?si=abc",
    "https://music.youtube.com/watch?v=dQw4w9WgXcQ",
  ])("recognises YouTube link %s", (url) => {
    expect(parseLink(url)).toEqual({ url, provider: "youtube", oembed: youtubeOembed(url) });
  });

  it.each([
    "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
    "https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3?si=x",
    "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
    "https://open.spotify.com/intl-de/track/4uLU6hMCjMI75M1A2tKUQC",
  ])("recognises Spotify link %s", (url) => {
    expect(parseLink(url)).toEqual({ url, provider: "spotify", oembed: spotifyOembed(url) });
  });

  it("treats other http(s) links as plain web links", () => {
    expect(parseLink("https://www.pinterest.com/pin/123/")).toEqual({ url: "https://www.pinterest.com/pin/123/", provider: "web" });
    expect(parseLink("http://example.com/a?b=c")).toEqual({ url: "http://example.com/a?b=c", provider: "web" });
  });

  it("adds https to a pasted address without a scheme", () => {
    expect(parseLink("  youtu.be/dQw4w9WgXcQ ")?.url).toBe("https://youtu.be/dQw4w9WgXcQ");
    expect(parseLink("example.com/song")).toEqual({ url: "https://example.com/song", provider: "web" });
  });

  it("does not treat YouTube or Spotify pages that aren't media as media", () => {
    expect(parseLink("https://www.youtube.com/@someartist")?.provider).toBe("web");
    expect(parseLink("https://open.spotify.com/artist/0OdUWJ0sBjDrqHygGUXeCF")?.provider).toBe("web");
  });

  it.each(["javascript:alert(1)", "ftp://example.com/file", "file:///etc/hosts", "data:text/html,hi", "just some words", ""])(
    "rejects %j",
    (raw) => {
      expect(parseLink(raw)).toBeNull();
    },
  );
});
