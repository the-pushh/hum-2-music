import type { Idea } from "@/sketches/types";
import { ImageCard } from "./ImageCard";
import { LyricsCard } from "./LyricsCard";
import { VoiceCard } from "./VoiceCard";

export function IdeaCard({ data }: { data: Idea }) {
  switch (data.kind) {
    case "note":
      return (
        <article className="rounded-2xl bg-surface p-4">
          <p className="whitespace-pre-wrap text-base text-ink">{data.text}</p>
        </article>
      );
    case "voice":
      return <VoiceCard idea={data} />;
    case "lyrics":
      return <LyricsCard idea={data} />;
    case "image":
      return <ImageCard idea={data} />;
  }
}
