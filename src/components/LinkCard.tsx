"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ArrowSquareOut, Play } from "@phosphor-icons/react";
import type { Idea, LinkInput } from "@/sketches/types";

// The player pulls in provider SDKs, so only load it when someone presses play.
const ReactPlayer = dynamic(() => import("react-player"), { ssr: false });

const providerLabel = { youtube: "YouTube", spotify: "Spotify", web: "Link" } as const;

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function LinkCard({ idea }: { idea: Idea & LinkInput }) {
  const [playing, setPlaying] = useState(false);
  const media = idea.provider !== "web";

  return (
    <article className="flex flex-col gap-3 rounded-2xl bg-surface p-2">
      {playing ? (
        <div className={`overflow-hidden rounded-lg ${idea.provider === "youtube" ? "aspect-video" : "h-20"}`}>
          <ReactPlayer src={idea.url} playing controls width="100%" height="100%" />
        </div>
      ) : (
        idea.thumb && (
          // eslint-disable-next-line @next/next/no-img-element -- third-party thumbnail, any host
          <img
            src={idea.thumb}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className="aspect-video w-full rounded-lg bg-raised object-cover"
          />
        )
      )}
      <div className="flex items-start gap-2 px-2 pb-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-xs font-semibold text-ink-muted uppercase">{providerLabel[idea.provider]}</span>
          <a
            href={idea.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-start gap-1 rounded-sm text-base font-semibold text-ink transition duration-300 ease-soft hover:text-ink-muted active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <span className="line-clamp-2 break-words">{idea.title ?? hostOf(idea.url)}</span>
            <ArrowSquareOut size={16} className="mt-1 shrink-0" aria-hidden />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
          {(idea.author || idea.description) && (
            <span className="line-clamp-2 text-sm text-ink-muted">{idea.author ?? idea.description}</span>
          )}
        </div>
        {media && !playing && (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-ink text-canvas transition duration-300 ease-soft hover:bg-ink-muted active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <Play size={20} weight="fill" aria-hidden />
            <span className="sr-only">Play {idea.title ?? "link"} here</span>
          </button>
        )}
      </div>
    </article>
  );
}
