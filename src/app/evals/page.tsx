import { FIXTURES } from '@/lib/evals/fixtures';

/**
 * Evals page is intentionally static. The eval runner is a separate API
 * endpoint you trigger manually (or via CI). Running evals on every page
 * view would burn tokens for no reason.
 *
 * In a production deployment this page would show historical run results
 * stored in Vercel Postgres or KV. For the assessment we keep it simple
 * and just list the fixtures + how to run.
 */
export default function EvalsPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-16 text-zinc-100">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-1 font-mono text-xs uppercase tracking-widest text-zinc-500">
          vercel advisor · evals
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Eval test set
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">
          This is the regression test set for the agent. Each fixture is a
          real public repo with expected findings. Run{' '}
          <code className="rounded bg-zinc-900 px-1 py-0.5 font-mono text-xs">
            POST /api/evals
          </code>{' '}
          to score the current agent against all fixtures.
        </p>

        <div className="mt-8 space-y-4">
          {FIXTURES.map((fx) => (
            <article
              key={fx.id}
              className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4"
            >
              <header className="flex items-center justify-between">
                <h2 className="font-mono text-sm font-medium text-zinc-200">
                  {fx.id}
                </h2>
                {fx.expectClean ? (
                  <span className="rounded bg-emerald-500/10 px-2 py-0.5 font-mono text-xs text-emerald-300">
                    expect clean
                  </span>
                ) : null}
              </header>
              <a
                href={fx.repoUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block font-mono text-xs text-zinc-500 hover:text-zinc-300"
              >
                {fx.repoUrl}
              </a>
              <p className="mt-2 text-sm text-zinc-400">{fx.description}</p>
              {fx.expectedFindings.length > 0 ? (
                <ul className="mt-3 space-y-1">
                  {fx.expectedFindings.map((ef, i) => (
                    <li
                      key={i}
                      className="rounded bg-black/30 px-2 py-1 font-mono text-xs text-zinc-400"
                    >
                      <span className="text-zinc-200">{ef.category}</span> →{' '}
                      &ldquo;{ef.keyword}&rdquo;{' '}
                      <span className="text-zinc-600">— {ef.reason}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}
        </div>

        <footer className="mt-12 border-t border-zinc-900 pt-6 font-mono text-xs text-zinc-600">
          <a href="/" className="hover:text-zinc-300">
            ← home
          </a>
        </footer>
      </div>
    </main>
  );
}
