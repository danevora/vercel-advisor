/**
 * PPR static shell — renders instantly from the edge before the dynamic
 * report data is fetched. This is the LCP-friendly skeleton the user sees
 * during the brief Blob read.
 */
export default function Loading() {
  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-16 text-zinc-100">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-1 h-3 w-32 animate-pulse rounded bg-zinc-800" />
        <div className="mt-2 h-8 w-72 animate-pulse rounded bg-zinc-800" />
        <div className="mt-4 h-4 w-full animate-pulse rounded bg-zinc-900" />
        <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-zinc-900" />
        <div className="mt-8 grid gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-lg border border-zinc-900 bg-zinc-900/50"
            />
          ))}
        </div>
      </div>
    </main>
  );
}
