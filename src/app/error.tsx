"use client";

import { useEffect } from "react";
import { Button } from "@/components/Button";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col items-start gap-4 px-4 py-8">
      <h1 className="text-2xl font-semibold text-ink">Couldn&apos;t open your ideas</h1>
      <p className="text-base text-ink-muted">
        hum keeps everything in this browser&apos;s storage, and reading it failed. Private browsing or blocked site
        data can cause this. Nothing has been deleted.
      </p>
      <Button onClick={() => retry()}>Try again</Button>
    </main>
  );
}
