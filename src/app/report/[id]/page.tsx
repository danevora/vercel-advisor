import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { loadReport } from '@/lib/blob';
import { CheckCard } from '@/components/check-card';
import type { Check } from '@/lib/schemas';

/**
 * Streaming render: the static shell (header, chrome) renders immediately
 * while the <Suspense> boundary below isolates the dynamic Blob read. This
 * gives the same perceived-load behavior as PPR — only the report data
 * blocks the streamed response.
 */

const CATEGORIES: { key: Check['category']; label: string }[] = [
  { key: 'rendering', label: 'Rendering' },
  { key: 'edge-compat', label: 'Edge Compatibility' },
  { key: 'caching', label: 'Caching' },
  { key: 'bundle', label: 'Bundle' },
];

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-16 text-zinc-100">
      <div className="mx-auto w-full max-w-3xl">
        {/* Static shell — rendered at build time, served from CDN edge */}
        <div className="mb-1 font-mono text-xs uppercase tracking-widest text-zinc-500">
          vercel advisor · report
        </div>

        {/* Dynamic content — streams in from Blob */}
        <Suspense fallback={<ReportSkeleton />}>
          <ReportContent id={id} />
        </Suspense>

        <footer className="mt-16 border-t border-zinc-900 pt-6 font-mono text-xs text-zinc-600">
          <a href="/" className="hover:text-zinc-300">
            ← run another analysis
          </a>
        </footer>
      </div>
    </main>
  );
}

async function ReportContent({ id }: { id: string }) {
  const report = await loadReport(id);
  if (!report) notFound();

  const byCategory = CATEGORIES.map((cat) => ({
    ...cat,
    checks: report.checks.filter((c) => c.category === cat.key),
  })).filter((g) => g.checks.length > 0);

  const counts = {
    pass: report.checks.filter((c) => c.status === 'pass').length,
    warning: report.checks.filter((c) => c.status === 'warning').length,
    fail: report.checks.filter((c) => c.status === 'fail').length,
  };

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">
        {report.owner}/{report.repo}
      </h1>
      <div className="mt-1 flex items-center gap-3 text-xs font-mono text-zinc-500">
        <span>branch: {report.defaultBranch}</span>
        <span>·</span>
        <span>model: {report.modelId}</span>
        <span>·</span>
        <span>{new Date(report.createdAt).toLocaleString()}</span>
      </div>

      <p className="mt-6 max-w-2xl text-sm leading-relaxed text-zinc-300">
        {report.summary}
      </p>

      <div className="mt-6 flex gap-2 font-mono text-xs">
        <span className="rounded bg-emerald-500/10 px-2 py-1 text-emerald-300">
          {counts.pass} pass
        </span>
        <span className="rounded bg-amber-500/10 px-2 py-1 text-amber-300">
          {counts.warning} warn
        </span>
        <span className="rounded bg-rose-500/10 px-2 py-1 text-rose-300">
          {counts.fail} fail
        </span>
      </div>

      <div className="mt-8 space-y-8">
        {byCategory.map((group) => (
          <section key={group.key}>
            <h2 className="mb-3 text-xs font-mono uppercase tracking-widest text-zinc-500">
              {group.label}
            </h2>
            <div className="grid gap-3">
              {group.checks.map((c, i) => (
                <CheckCard
                  key={i}
                  check={c}
                  repo={
                    report.defaultBranch
                      ? {
                          owner: report.owner,
                          repo: report.repo,
                          branch: report.defaultBranch,
                        }
                      : undefined
                  }
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

function ReportSkeleton() {
  return (
    <>
      <div className="mt-2 h-8 w-72 animate-pulse rounded bg-zinc-800" />
      <div className="mt-2 h-3 w-48 animate-pulse rounded bg-zinc-900" />
      <div className="mt-6 h-4 w-full animate-pulse rounded bg-zinc-900" />
      <div className="mt-2 h-4 w-2/3 animate-pulse rounded bg-zinc-900" />
      <div className="mt-8 grid gap-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-lg border border-zinc-900 bg-zinc-900/50"
          />
        ))}
      </div>
    </>
  );
}
