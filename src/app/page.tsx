import { Analyzer } from '@/components/analyzer';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center bg-zinc-950 px-6 py-16 text-zinc-100">
      <div className="w-full max-w-3xl">
        <header className="mb-12">
          <div className="mb-1 font-mono text-xs uppercase tracking-widest text-zinc-500">
            vercel advisor
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Deployment readiness for Next.js on Vercel
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">
            Paste a public GitHub URL. We analyze rendering strategy, edge
            compatibility, caching, and bundle health — then hand you a
            shareable report.
          </p>
        </header>

        <Analyzer />

        <footer className="mt-16 flex items-center justify-between border-t border-zinc-900 pt-6 font-mono text-xs text-zinc-600">
          <a href="/evals" className="hover:text-zinc-300">
            /evals
          </a>
          <span>powered by Vercel AI SDK + Fluid Compute</span>
        </footer>
      </div>
    </main>
  );
}
