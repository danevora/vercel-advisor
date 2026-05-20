# Vercel Advisor

Paste a public GitHub URL → get a streaming deployment readiness report for
Next.js on Vercel. Built as a Solutions Architect take-home assessment.

## What it checks
- **Rendering**: SSR/SSG/ISR fit, missing Suspense boundaries, PPR opportunities
- **Edge compatibility**: Node-only APIs in middleware or edge routes
- **Caching**: missing `revalidate`, fetch calls without cache config
- **Bundle**: heavy client packages, missing `next/dynamic`

## Architecture (one screen)

```
Browser ─submit URL─▶ /api/analyze (Fluid Compute, maxDuration=120)
                      └─ streamText + tools ──▶ GitHub API
                         (getFileTree, readFile, recordCheck, finalize)
                      └─ on finish ──▶ Vercel Blob (reports/<id>.json)
                      ◀── UI message stream (text deltas, tool calls, data parts)

Browser ─/report/[id]─▶ PPR page (static shell from edge + Suspense Blob read)
```

## Stack
- Next.js 16 (App Router, PPR)
- AI SDK 6 (`streamText`, `tool`, UI message stream) with Vercel AI Gateway
- Vercel Blob for shareable reports
- Vercel Fluid Compute for long-running tool-call loops
- Zod for structured agent output

## Run locally

```bash
cp .env.local.example .env.local   # add at least one model API key
npm install
npm run dev
```

Open http://localhost:3000.

## Evals

```bash
curl -X POST http://localhost:3000/api/evals \
  -H 'content-type: application/json' \
  -d '{"fixtureId":"shadcn-ui"}'
```

See [src/lib/evals/fixtures.ts](src/lib/evals/fixtures.ts) for the test set
and [src/lib/evals/score.ts](src/lib/evals/score.ts) for the rubric.
