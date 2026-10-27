import { Suspense } from "react";
import { SketchScreen } from "@/components/SketchScreen";

async function SketchFromParams({ params }: { params: PageProps<"/s/[id]">["params"] }) {
  const { id } = await params;
  return <SketchScreen id={id} />;
}

export default function SketchPage(props: PageProps<"/s/[id]">) {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-5xl px-4 py-8" aria-busy />}>
      <SketchFromParams params={props.params} />
    </Suspense>
  );
}
