import { Suspense } from "react";
import { LyricsScreen } from "@/components/LyricsScreen";

async function LyricsFromParams({ params }: { params: PageProps<"/s/[id]/lyrics/[ideaId]">["params"] }) {
  const { id, ideaId } = await params;
  return <LyricsScreen sketchId={id} ideaId={ideaId} />;
}

export default function LyricsPage(props: PageProps<"/s/[id]/lyrics/[ideaId]">) {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-2xl px-4 py-8" aria-busy />}>
      <LyricsFromParams params={props.params} />
    </Suspense>
  );
}
