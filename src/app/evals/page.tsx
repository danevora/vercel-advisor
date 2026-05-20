'use client';

import { useState } from 'react';
import { FIXTURES } from '@/lib/evals/fixtures';
import { AVAILABLE_MODELS, DEFAULT_MODEL_ID } from '@/lib/models';
import type { EvalResult } from '@/lib/evals/score';

type EvalSummary = {
  totalFixtures: number;
  passed: number;
  avgRecall: number;
  hallucinations: number;
  modelId: string;
  timestamp: string;
};

type EvalRun = {
  id: string;
  summary: EvalSummary;
  results: (EvalResult & { error?: string })[];
};

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function RecallBar({ value }: { value: number }) {
  const pctVal = Math.round(value * 100);
  const color =
    pctVal === 100 ? 'bg-emerald-500' : pctVal >= 50 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 rounded-full bg-zinc-800">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pctVal}%` }} />
      </div>
      <span className="font-mono text-xs text-zinc-400">{pct(value)}</span>
    </div>
  );
}

function StatusBadge({ passed }: { passed: boolean }) {
  return passed ? (
    <span className="rounded bg-emerald-500/10 px-2 py-0.5 font-mono text-xs text-emerald-300">
      pass
    </span>
  ) : (
    <span className="rounded bg-rose-500/10 px-2 py-0.5 font-mono text-xs text-rose-300">
      fail
    </span>
  );
}

function RunCard({
  run,
  onCompare,
  isComparing,
}: {
  run: EvalRun;
  onCompare: (id: string) => void;
  isComparing: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const { summary, results } = run;
  const ts = new Date(summary.timestamp).toLocaleTimeString();

  return (
    <div
      className={`rounded-lg border bg-zinc-900/50 p-4 ${isComparing ? 'border-blue-500/50' : 'border-zinc-800'}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-mono text-sm text-zinc-200 truncate">{summary.modelId}</span>
          <span className="text-xs text-zinc-600">{ts}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="font-mono text-xs text-zinc-400">
            {summary.passed}/{summary.totalFixtures} passed
          </span>
          <RecallBar value={summary.avgRecall} />
          {summary.hallucinations > 0 ? (
            <span className="rounded bg-rose-500/10 px-2 py-0.5 font-mono text-xs text-rose-300">
              {summary.hallucinations} hallucination{summary.hallucinations > 1 ? 's' : ''}
            </span>
          ) : null}
          <button
            onClick={() => onCompare(run.id)}
            className={`rounded px-2 py-0.5 font-mono text-xs transition-colors ${
              isComparing
                ? 'bg-blue-500/20 text-blue-300'
                : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {isComparing ? 'comparing' : 'compare'}
          </button>
          <button
            onClick={() => setExpanded((x) => !x)}
            className="font-mono text-xs text-zinc-500 hover:text-zinc-300"
          >
            {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {expanded ? (
        <div className="mt-4 space-y-2">
          {results.map((r) => {
            const fx = FIXTURES.find((f) => f.id === r.fixtureId);
            return (
              <div key={r.fixtureId} className="rounded border border-zinc-800 bg-black/20 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-zinc-300">{r.fixtureId}</span>
                  <div className="flex items-center gap-2">
                    <RecallBar value={r.recall} />
                    <StatusBadge passed={r.passed} />
                  </div>
                </div>
                {r.error ? (
                  <p className="mt-1 font-mono text-xs text-rose-400">{r.error}</p>
                ) : null}
                {r.missed.length > 0 ? (
                  <div className="mt-2">
                    <p className="mb-1 text-xs text-zinc-600">missed:</p>
                    {r.missed.map((m, i) => (
                      <span
                        key={i}
                        className="mr-1 inline-block rounded bg-rose-500/10 px-1.5 py-0.5 font-mono text-xs text-rose-300"
                      >
                        {m.category}/{m.keyword}
                      </span>
                    ))}
                  </div>
                ) : null}
                {r.hallucination && r.unexpectedFails.length > 0 ? (
                  <p className="mt-2 font-mono text-xs text-rose-400">
                    hallucination: {r.unexpectedFails.length} unexpected fail
                    {r.unexpectedFails.length > 1 ? 's' : ''} in clean repo
                  </p>
                ) : null}
                {fx ? (
                  <p className="mt-2 text-xs text-zinc-600">{fx.description}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function ComparisonTable({ runs }: { runs: EvalRun[] }) {
  if (runs.length < 2) return null;

  const fixtureIds = FIXTURES.map((f) => f.id);

  return (
    <div className="mt-8">
      <h2 className="mb-3 text-sm font-medium text-zinc-300">Side-by-side comparison</h2>
      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/80">
              <th className="px-3 py-2 text-left font-mono text-zinc-500">fixture</th>
              {runs.map((r) => (
                <th key={r.id} className="px-3 py-2 text-left font-mono text-zinc-400">
                  {r.summary.modelId.split('/')[1] ?? r.summary.modelId}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-zinc-800/50 bg-black/10">
              <td className="px-3 py-2 font-mono text-zinc-500">avg recall</td>
              {runs.map((r) => (
                <td key={r.id} className="px-3 py-2">
                  <RecallBar value={r.summary.avgRecall} />
                </td>
              ))}
            </tr>
            <tr className="border-b border-zinc-800/50">
              <td className="px-3 py-2 font-mono text-zinc-500">passed</td>
              {runs.map((r) => (
                <td key={r.id} className="px-3 py-2 font-mono text-zinc-300">
                  {r.summary.passed}/{r.summary.totalFixtures}
                </td>
              ))}
            </tr>
            {fixtureIds.map((fid) => {
              const rowResults = runs.map((r) => r.results.find((x) => x.fixtureId === fid));
              return (
                <tr key={fid} className="border-b border-zinc-800/30 last:border-0">
                  <td className="px-3 py-2 font-mono text-zinc-400">{fid}</td>
                  {rowResults.map((r, i) =>
                    r ? (
                      <td key={i} className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <StatusBadge passed={r.passed} />
                          <RecallBar value={r.recall} />
                        </div>
                      </td>
                    ) : (
                      <td key={i} className="px-3 py-2 font-mono text-zinc-600">—</td>
                    ),
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function EvalsPage() {
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL_ID);
  const [selectedFixture, setSelectedFixture] = useState<string>('all');
  const [runs, setRuns] = useState<EvalRun[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  async function runEvals() {
    setRunning(true);
    setError(null);
    try {
      const body: Record<string, string> = { modelId: selectedModel };
      if (selectedFixture !== 'all') body.fixtureId = selectedFixture;

      const res = await fetch('/api/evals', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error ?? 'Eval run failed');
      }

      const data = await res.json();
      const newRun: EvalRun = {
        id: `${Date.now()}`,
        summary: data.summary,
        results: data.results,
      };
      setRuns((prev) => [newRun, ...prev]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  }

  function toggleCompare(id: string) {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(-3),
    );
  }

  const compareRuns = runs.filter((r) => compareIds.includes(r.id));

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-16 text-zinc-100">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-1 font-mono text-xs uppercase tracking-widest text-zinc-500">
          vercel advisor · evals
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Eval test set</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">
          Run the agent against known fixtures and compare results across models. Each run burns
          real tokens — use sparingly.
        </p>

        {/* Runner controls */}
        <div className="mt-8 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">Model</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={running}
              className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 font-mono text-sm text-zinc-200 focus:border-zinc-500 focus:outline-none disabled:opacity-50"
            >
              {AVAILABLE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.provider} · {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">Fixture</label>
            <select
              value={selectedFixture}
              onChange={(e) => setSelectedFixture(e.target.value)}
              disabled={running}
              className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 font-mono text-sm text-zinc-200 focus:border-zinc-500 focus:outline-none disabled:opacity-50"
            >
              <option value="all">all fixtures</option>
              {FIXTURES.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.id}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={runEvals}
            disabled={running}
            className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
          >
            {running ? 'Running…' : 'Run Evals'}
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-md border border-rose-500/40 bg-rose-500/5 p-3 text-sm text-rose-300">
            {error}
          </div>
        ) : null}

        {/* Fixture reference */}
        <details className="mt-8">
          <summary className="cursor-pointer text-sm text-zinc-500 hover:text-zinc-300">
            Fixture definitions ({FIXTURES.length})
          </summary>
          <div className="mt-3 space-y-3">
            {FIXTURES.map((fx) => (
              <article
                key={fx.id}
                className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4"
              >
                <header className="flex items-center justify-between">
                  <h2 className="font-mono text-sm font-medium text-zinc-200">{fx.id}</h2>
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
        </details>

        {/* Runs */}
        {runs.length > 0 ? (
          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium text-zinc-300">
                Runs{' '}
                <span className="ml-1 font-mono text-xs text-zinc-600">
                  (click &ldquo;compare&rdquo; on up to 3 to diff them)
                </span>
              </h2>
              {compareIds.length > 0 ? (
                <button
                  onClick={() => setCompareIds([])}
                  className="font-mono text-xs text-zinc-500 hover:text-zinc-300"
                >
                  clear comparison
                </button>
              ) : null}
            </div>
            <div className="space-y-3">
              {runs.map((run) => (
                <RunCard
                  key={run.id}
                  run={run}
                  onCompare={toggleCompare}
                  isComparing={compareIds.includes(run.id)}
                />
              ))}
            </div>

            <ComparisonTable runs={compareRuns} />
          </div>
        ) : (
          <p className="mt-10 text-sm text-zinc-600">No runs yet. Hit &ldquo;Run Evals&rdquo; above.</p>
        )}

        <footer className="mt-12 border-t border-zinc-900 pt-6 font-mono text-xs text-zinc-600">
          <a href="/" className="hover:text-zinc-300">
            ← home
          </a>
        </footer>
      </div>
    </main>
  );
}
