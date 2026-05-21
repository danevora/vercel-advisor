import { generateText, stepCountIs } from 'ai';
import { parseGitHubUrl } from '@/lib/parse-url';
import { getRepoMeta } from '@/lib/github';
import { type Check } from '@/lib/schemas';
import { buildAnalysisTools, ANALYZE_SYSTEM_PROMPT, AGENT_PROMPT, AGENT_STEP_LIMIT } from '@/lib/agent';
import { FIXTURES } from '@/lib/evals/fixtures';
import { scoreFixture, type EvalResult } from '@/lib/evals/score';
import { DEFAULT_MODEL_ID, isValidModel } from '@/lib/models';

export const maxDuration = 300;

async function runAgentForRepo(repoUrl: string, modelId: string): Promise<Check[]> {
  const { owner, repo } = parseGitHubUrl(repoUrl);
  const { defaultBranch: branch } = await getRepoMeta(owner, repo);

  const agent = buildAnalysisTools({ owner, repo, branch });

  await generateText({
    model: modelId,
    system: ANALYZE_SYSTEM_PROMPT,
    prompt: AGENT_PROMPT(repoUrl, owner, repo, branch),
    stopWhen: stepCountIs(AGENT_STEP_LIMIT),
    tools: agent.tools,
  });

  return agent.checks;
}

/**
 * POST /api/evals — runs all fixtures sequentially and returns scores.
 * Optionally pass { fixtureId } to run just one. Sequential is intentional:
 * cheaper, and we don't need throughput here.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { fixtureId?: string; modelId?: string };

  const requestedModel = body.modelId;
  const MODEL_ID =
    requestedModel && isValidModel(requestedModel)
      ? requestedModel
      : (process.env.ADVISOR_MODEL ?? DEFAULT_MODEL_ID);

  const targets = body.fixtureId
    ? FIXTURES.filter((f) => f.id === body.fixtureId)
    : FIXTURES;

  if (targets.length === 0) {
    return Response.json({ error: 'No matching fixtures' }, { status: 400 });
  }

  const results: (EvalResult & { fixtureId: string; error?: string })[] = [];

  for (const fx of targets) {
    try {
      const checks = await runAgentForRepo(fx.repoUrl, MODEL_ID);
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
