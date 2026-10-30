/** The idea page's shape while it opens, so opening an idea never shows a blank screen. */
export function SketchSkeleton() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8" aria-busy aria-label="Opening the idea">
      <div className="flex flex-col gap-3" aria-hidden>
        <div className="h-4 w-24 animate-pulse rounded-full bg-surface" />
        <div className="h-8 w-1/2 max-w-xs animate-pulse rounded-lg bg-surface" />
      </div>
      <div className="mx-auto h-24 w-full max-w-xl animate-pulse rounded-3xl bg-surface" aria-hidden />
      <div className="h-24 w-full animate-pulse rounded-2xl bg-surface" aria-hidden />
    </main>
  );
}
