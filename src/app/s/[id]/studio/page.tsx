import { Suspense } from "react";
import { StudioScreen } from "@/components/studio/StudioScreen";

async function StudioFromParams({ params }: { params: PageProps<"/s/[id]/studio">["params"] }) {
  const { id } = await params;
  return <StudioScreen sketchId={id} />;
}

export default function StudioPage(props: PageProps<"/s/[id]/studio">) {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-5xl px-4 py-8" aria-busy />}>
      <StudioFromParams params={props.params} />
    </Suspense>
  );
}
