import { generateText, tool, stepCountIs } from 'ai';
import { z } from 'zod';
import { parseGitHubUrl } from '@/lib/parse-url';
import { getRepoMeta, getFileTree, getFileContent } from '@/lib/github';
import { CheckSchema, type Check } from '@/lib/schemas';
import { ANALYZE_SYSTEM_PROMPT } from '@/lib/prompts';
import { FIXTURES } from '@/lib/evals/fixtures';
import { scoreFixture, type EvalResult } from '@/lib/evals/score';

export const maxDuration = 300;

const MODEL_ID = process.env.ADVISOR_MODEL ?? 'openai/gpt-4o-mini';

async function runAgentForRepo(repoUrl: string): Promise<Check[]> {
  const { owner, repo } = parseGitHubUrl(repoUrl);
  const { defaultBranch: branch } = await getRepoMeta(owner, repo);
  const collected: Check[] = [];

  await generateText({
    model: MODEL_ID,
    system: ANALYZE_SYSTEM_PROMPT,
    prompt: `Analyze ${repoUrl}. Owner: ${owner}, Repo: ${repo}, Branch: ${branch}. When done, call finalize.`,
    stopWhen: stepCountIs(15),
    tools: {
      getFileTree: tool({
        description: 'List files in the repo.',
        inputSchema: z.object({}),
        execute: async () => {
          const tree = await getFileTree(owner, repo, branch);
          return {
            files: tree
              .filter((e) => e.type === 'blob')
              .filter((e) =>
                /\.(t|j)sx?$|^next\.config\.|^package\.json$|^middleware\.|^vercel\.json$/.test(
                  e.path,
                ),
              )
              .slice(0, 200)
              .map((e) => e.path),
          };
        },
      }),
      readFile: tool({
        description: 'Read a file.',
        inputSchema: z.object({ path: z.string() }),
        execute: async ({ path }) => {
          try {
            return { path, content: await getFileContent(owner, repo, path, branch) };
          } catch (err) {
            return { path, error: (err as Error).message };
          }
        },
      }),
      recordCheck: tool({
        description: 'Record one finding.',
        inputSchema: CheckSchema,
        execute: async (input) => {
          collected.push(input);
          return { recorded: true };
        },
      }),
      finalize: tool({
        description: 'Finish.',
        inputSchema: z.object({ summary: z.string() }),
        execute: async () => ({ done: true }),
      }),
    },
  });

  return collected;
}

/**
 * POST /api/evals — runs all fixtures sequentially and returns scores.
 * Optionally pass { fixtureId } to run just one. Sequential is intentional:
 * cheaper, and we don't need throughput here.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { fixtureId?: string };

  const targets = body.fixtureId
    ? FIXTURES.filter((f) => f.id === body.fixtureId)
    : FIXTURES;

  if (targets.length === 0) {
    return Response.json({ error: 'No matching fixtures' }, { status: 400 });
  }

  const results: (EvalResult & { fixtureId: string; error?: string })[] = [];

  for (const fx of targets) {
    try {
      const checks = await runAgentForRepo(fx.repoUrl);
      results.push(scoreFixture(fx, checks));
    } catch (err) {
      results.push({
        fixtureId: fx.id,
        passed: false,
        recall: 0,
        hallucination: false,
        matched: [],
        missed: fx.expectedFindings,
        unexpectedFails: [],
        totalChecks: 0,
        error: (err as Error).message,
      });
    }
  }

  const summary = {
    totalFixtures: results.length,
    passed: results.filter((r) => r.passed).length,
    avgRecall:
      results.reduce((s, r) => s + r.recall, 0) / Math.max(results.length, 1),
    hallucinations: results.filter((r) => r.hallucination).length,
    modelId: MODEL_ID,
    timestamp: new Date().toISOString(),
  };

  return Response.json({ summary, results });
}
