import type { Idea } from "@/sketches/types";
import { ideaBg } from "@/ui/ideaColors";
import { ColorCard } from "./ColorCard";
import { ImageCard } from "./ImageCard";
import { LinkCard } from "./LinkCard";
import { LyricsCard } from "./LyricsCard";
import { VoiceCard } from "./VoiceCard";

export function IdeaCard({ data }: { data: Idea }) {
  switch (data.kind) {
    case "note":
      return (
        <article className={`flex flex-col gap-1 rounded-2xl p-4 text-canvas ${ideaBg.note}`}>
          <span className="text-xs font-semibold uppercase opacity-70">Note</span>
          <p className="whitespace-pre-wrap text-base">{data.text}</p>
        </article>
      );
    case "voice":
      return <VoiceCard idea={data} />;
    case "lyrics":
      return <LyricsCard idea={data} />;
    case "image":
      return <ImageCard idea={data} />;
    case "link":
      return <LinkCard idea={data} />;
    case "color":
      return <ColorCard idea={data} />;
  }
}
