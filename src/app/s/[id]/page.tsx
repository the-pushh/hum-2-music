import { Suspense } from "react";
import { SketchFromUrl } from "@/components/SketchScreen";
import { SketchSkeleton } from "@/components/SketchSkeleton";

// The id is read in the browser, so the page needs nothing from the server and opens without a round trip.
export default function SketchPage() {
  return (
    <Suspense fallback={<SketchSkeleton />}>
      <SketchFromUrl />
    </Suspense>
  );
}
