import type { Check } from '@/lib/schemas';

const STATUS_STYLES: Record<Check['status'], string> = {
  pass: 'border-emerald-500/40 bg-emerald-500/5 text-emerald-300',
  warning: 'border-amber-500/40 bg-amber-500/5 text-amber-300',
  fail: 'border-rose-500/40 bg-rose-500/5 text-rose-300',
};

const STATUS_LABEL: Record<Check['status'], string> = {
  pass: 'PASS',
  warning: 'WARN',
  fail: 'FAIL',
};

const CATEGORY_LABEL: Record<Check['category'], string> = {
  rendering: 'Rendering',
  'edge-compat': 'Edge Compat',
  caching: 'Caching',
  bundle: 'Bundle',
};

export function CheckCard({ check }: { check: Check }) {
  return (
    <article className={`rounded-lg border p-4 ${STATUS_STYLES[check.status]}`}>
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="rounded bg-black/30 px-1.5 py-0.5">{STATUS_LABEL[check.status]}</span>
          <span className="text-zinc-400">{CATEGORY_LABEL[check.category]}</span>
        </div>
        <h3 className="text-sm font-semibold text-zinc-100">{check.name}</h3>
      </header>
      <p className="mt-2 text-sm leading-relaxed text-zinc-300">{check.explanation}</p>
      {check.recommendation ? (
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          <span className="font-medium text-zinc-300">Fix: </span>
          {check.recommendation}
        </p>
      ) : null}
      {check.fileReferences && check.fileReferences.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {check.fileReferences.map((ref, i) => (
            <li
              key={i}
              className="rounded bg-black/30 px-2 py-1 font-mono text-xs text-zinc-300"
            >
              {ref.path}
              {ref.line != null ? `:${ref.line}` : ''}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
