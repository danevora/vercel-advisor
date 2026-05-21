import {
  streamText,
  stepCountIs,
  createUIMessageStream,
  createUIMessageStreamResponse,
} from 'ai';
import { nanoid } from 'nanoid';
import { parseGitHubUrl } from '@/lib/parse-url';
import { getRepoMeta } from '@/lib/github';
import { saveReport } from '@/lib/blob';
import { type Report } from '@/lib/schemas';
import { buildAnalysisTools, ANALYZE_SYSTEM_PROMPT, AGENT_PROMPT, AGENT_STEP_LIMIT } from '@/lib/agent';
import { DEFAULT_MODEL_ID, isValidModel } from '@/lib/models';

/**
 * Fluid Compute config. This route does multiple sequential GitHub fetches
 * plus an LLM streaming call — total wall-clock can be 30–60s for a large
 * repo. With Fluid Compute the function stays warm and we pay only for
 * active CPU, not the time spent awaiting upstream APIs.
 */
export const maxDuration = 120;

// Accept either the standard useChat shape (`{ messages: [...] }`) or a
// direct `{ repoUrl }` body for curl/eval testing. Extract the URL from
// whichever is present.
type UIMessageLike = {
  role: string;
  parts?: Array<{ type: string; text?: string }>;
  content?: string;
};

function extractRepoUrl(body: { messages?: UIMessageLike[]; repoUrl?: string }): string | null {
  if (body.repoUrl) return body.repoUrl;
  const last = body.messages?.[body.messages.length - 1];
  if (!last) return null;
  const fromParts = last.parts?.find((p) => p.type === 'text')?.text;
  return (fromParts ?? last.content ?? null)?.trim() || null;
}

export async function POST(req: Request) {
  const body = (await req.json()) as { messages?: UIMessageLike[]; repoUrl?: string; modelId?: string };
  const requestedModel = body.modelId;
  const MODEL_ID =
    requestedModel && isValidModel(requestedModel)
      ? requestedModel
      : (process.env.ADVISOR_MODEL ?? DEFAULT_MODEL_ID);
  const repoUrl = extractRepoUrl(body);
  if (!repoUrl) {
    return new Response(JSON.stringify({ error: 'repoUrl required' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  let owner: string;
  let repo: string;
  try {
    ({ owner, repo } = parseGitHubUrl(repoUrl));
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    );
  }

  // Pre-fetch repo metadata so we know the default branch and fail fast
  // on private/missing repos before the LLM burns any tokens.
  const meta = await getRepoMeta(owner, repo).catch((err) => {
    return { error: (err as Error).message };
  });
  if ('error' in meta) {
    return new Response(JSON.stringify({ error: meta.error }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    });
  }
  const branch = meta.defaultBranch;

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      // Emit early so the client can render context while the model warms up.
      writer.write({
        type: 'data-repo-meta',
        id: 'meta',
        data: { owner, repo, branch, modelId: MODEL_ID },
      });

      const agent = buildAnalysisTools({
        owner,
        repo,
        branch,
        onCheck: (check, count) => {
          writer.write({
            type: 'data-check',
            id: `check-${count}`,
            data: check,
          });
        },
      });

      const result = streamText({
        model: MODEL_ID,
        system: ANALYZE_SYSTEM_PROMPT,
        prompt: AGENT_PROMPT(repoUrl, owner, repo, branch),
        stopWhen: stepCountIs(AGENT_STEP_LIMIT),
        tools: agent.tools,
        onError: ({ error }) => {
          console.error('streamText error', error);
        },
      });

      // Surface the model's intermediate text + tool calls in the UI stream.
      writer.merge(result.toUIMessageStream());

      // Block on completion so the persist step runs after all tool calls.
      await result.finishReason;

      const id = nanoid(10);
      const report: Report = {
        id,
        repoUrl,
        owner,
        repo,
        defaultBranch: branch,
        checks: agent.checks,
        summary:
          agent.summary ||
          `Analyzed ${agent.checks.length} checks against ${owner}/${repo}.`,
        createdAt: new Date().toISOString(),
        modelId: MODEL_ID,
      };

      try {
        await saveReport(report);
        writer.write({
          type: 'data-report-saved',
          id: 'saved',
          data: { id, url: `/report/${id}` },
        });
      } catch (err) {
        // If Blob isn't configured (no BLOB_READ_WRITE_TOKEN locally), we still
        // hand the client an in-memory report so the UI can render. The
        // /report/[id] route will 404, but the assessor can still see results
        // in the streaming UI.
        writer.write({
          type: 'data-report-error',
          id: 'saved-err',
          data: { error: (err as Error).message, report },
        });
      }
    },
  });

  return createUIMessageStreamResponse({ stream });
}
