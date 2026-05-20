'use client';

import { useState, useRef, useEffect } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useRouter } from 'next/navigation';
import { CheckCard } from './check-card';
import type { Check } from '@/lib/schemas';
import { AVAILABLE_MODELS, DEFAULT_MODEL_ID } from '@/lib/models';

const EXAMPLES = [
  'https://github.com/vercel/next.js',
  'https://github.com/shadcn-ui/ui',
  'https://github.com/vercel/ai-chatbot',
];

type RepoMeta = { owner: string; repo: string; branch: string; modelId: string };
type SavedRef = { id: string; url: string };
type SaveErr = { error: string };

type AnyPart = { type: string } & Record<string, unknown>;

function isDataPart<T>(p: AnyPart, name: string): p is AnyPart & { data: T } {
  return p.type === `data-${name}`;
}

function isToolPart(
  p: AnyPart,
): p is AnyPart & { state?: string; input?: unknown; toolCallId?: string } {
  return typeof p.type === 'string' && p.type.startsWith('tool-');
}

export function Analyzer() {
  const [url, setUrl] = useState('');
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL_ID);
  const selectedModelRef = useRef(selectedModel);
  const router = useRouter();

  useEffect(() => {
    selectedModelRef.current = selectedModel;
  }, [selectedModel]);

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/analyze',
      fetch: (input, init) => {
        const body = JSON.parse((init?.body as string) ?? '{}');
        return window.fetch(input, {
          ...init,
          body: JSON.stringify({ ...body, modelId: selectedModelRef.current }),
        });
      },
    }),
  });

  const parts = messages.flatMap((m) => m.parts as AnyPart[]);

  const meta = parts.find((p): p is AnyPart & { data: RepoMeta } =>
    isDataPart<RepoMeta>(p, 'repo-meta'),
  )?.data;

  const checks = parts
    .filter((p): p is AnyPart & { data: Check } => isDataPart<Check>(p, 'check'))
    .map((p) => p.data);

  const saved = parts.find((p): p is AnyPart & { data: SavedRef } =>
    isDataPart<SavedRef>(p, 'report-saved'),
  )?.data;

  const saveError = parts.find((p): p is AnyPart & { data: SaveErr } =>
    isDataPart<SaveErr>(p, 'report-error'),
  )?.data;

  const activity = parts.filter(isToolPart).slice(-6);

  useEffect(() => {
    if (saved?.id) {
      const t = setTimeout(() => router.push(`/report/${saved.id}`), 1200);
      return () => clearTimeout(t);
    }
  }, [saved, router]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || status === 'streaming' || status === 'submitted') return;
    sendMessage({ text: url.trim() });
  }

  const isRunning = status === 'streaming' || status === 'submitted';

  return (
    <div className="w-full max-w-3xl mx-auto">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="text-sm font-medium text-zinc-300" htmlFor="repo">
          GitHub repository URL
        </label>
        <div className="flex gap-2">
          <input
            id="repo"
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/vercel/next.js"
            disabled={isRunning}
            className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isRunning || !url.trim()}
            className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
          >
            {isRunning ? 'Analyzing…' : 'Analyze'}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs text-zinc-500" htmlFor="model">
            Model
          </label>
          <select
            id="model"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            disabled={isRunning}
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-xs text-zinc-300 focus:border-zinc-500 focus:outline-none disabled:opacity-50"
          >
            {AVAILABLE_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.provider} · {m.label}
              </option>
            ))}
          </select>
        </div>

        {!isRunning && checks.length === 0 ? (
          <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
            <span>Try:</span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setUrl(ex)}
                className="underline hover:text-zinc-300"
              >
                {ex.replace('https://github.com/', '')}
              </button>
            ))}
          </div>
        ) : null}
      </form>

      {error ? (
        <div className="mt-6 rounded-md border border-rose-500/40 bg-rose-500/5 p-3 text-sm text-rose-300">
          {error.message}
        </div>
      ) : null}

      {meta ? (
        <div className="mt-8 flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm">
          <div>
            <div className="font-mono text-zinc-200">
              {meta.owner}/{meta.repo}
            </div>
            <div className="text-xs text-zinc-500">branch: {meta.branch}</div>
          </div>
          <div className="text-xs font-mono text-zinc-500">model: {meta.modelId}</div>
        </div>
      ) : null}

      {activity.length > 0 && !saved ? (
        <ul className="mt-4 space-y-1 font-mono text-xs text-zinc-500">
          {activity.map((a, i) => {
            const toolName = String(a.type).replace('tool-', '');
            const done =
              a.state === 'input-available' || a.state === 'output-available';
            const input = a.input;
            const detail =
              input && typeof input === 'object' && 'path' in input
                ? ` ${(input as { path: string }).path}`
                : '';
            return (
              <li key={i}>
                {done ? '✓' : '·'} {toolName}
                {detail}
              </li>
            );
          })}
        </ul>
      ) : null}

      {checks.length > 0 ? (
        <div className="mt-6 grid gap-3">
          {checks.map((c, i) => (
            <CheckCard
              key={i}
              check={c}
              repo={
                meta
                  ? { owner: meta.owner, repo: meta.repo, branch: meta.branch }
                  : undefined
              }
            />
          ))}
        </div>
      ) : null}

      {saved ? (
        <div className="mt-6 rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm text-emerald-300">
          Report saved. Redirecting to <span className="font-mono">{saved.url}</span>…
        </div>
      ) : null}

      {saveError ? (
        <div className="mt-6 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-300">
          Could not persist report ({saveError.error}). Results are above.
        </div>
      ) : null}
    </div>
  );
}
