// Shown while any app route's server work is in flight (Next wraps the segment
// in a Suspense boundary with this as the fallback). A neutral skeleton — a
// heading bar and a few card/line placeholders — so navigation feels instant
// and never flashes an empty frame. Server component; no interactivity.
export default function AppLoading() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse" aria-hidden>
      <div className="h-8 w-56 rounded-md bg-muted" />
      <div className="mt-2 h-4 w-72 rounded bg-muted/70" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-20 rounded-xl bg-muted/60 ring-1 ring-foreground/5"
          />
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="h-48 rounded-xl bg-muted/60 ring-1 ring-foreground/5" />
        <div className="h-48 rounded-xl bg-muted/60 ring-1 ring-foreground/5" />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
