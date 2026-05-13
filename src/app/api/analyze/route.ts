import {
  streamText,
  tool,
  stepCountIs,
  createUIMessageStream,
  createUIMessageStreamResponse,
} from 'ai';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { parseGitHubUrl } from '@/lib/parse-url';
import { getRepoMeta, getFileTree, getFileContent } from '@/lib/github';
import { saveReport } from '@/lib/blob';
import { CheckSchema, type Check, type Report } from '@/lib/schemas';
import { ANALYZE_SYSTEM_PROMPT } from '@/lib/prompts';

/**
 * Fluid Compute config. This route does multiple sequential GitHub fetches
 * plus an LLM streaming call — total wall-clock can be 30–60s for a large
 * repo. With Fluid Compute the function stays warm and we pay only for
 * active CPU, not the time spent awaiting upstream APIs.
 */
export const maxDuration = 120;

const MODEL_ID = process.env.ADVISOR_MODEL ?? 'openai/gpt-4o-mini';

export async function POST(req: Request) {
  const body = (await req.json()) as { repoUrl?: string };
  if (!body.repoUrl) {
    return new Response(JSON.stringify({ error: 'repoUrl required' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  let owner: string;
  let repo: string;
  try {
    ({ owner, repo } = parseGitHubUrl(body.repoUrl));
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

  // Collected by tool.execute calls inside the streamText loop, then
  // persisted to Blob once the stream completes.
  const collectedChecks: Check[] = [];
  let summary = '';

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      // Emit early so the client can render context while the model warms up.
      writer.write({
        type: 'data-repo-meta',
        id: 'meta',
        data: { owner, repo, branch, modelId: MODEL_ID },
      });

      const result = streamText({
        model: MODEL_ID,
        system: ANALYZE_SYSTEM_PROMPT,
        prompt: `Analyze the GitHub repository at ${body.repoUrl}.\nOwner: ${owner}\nRepo: ${repo}\nDefault branch: ${branch}\n\nWhen done, call \`finalize\` with the executive summary.`,
        // stepCountIs bounds the tool-call loop. 12 = ~1 tree + ~6-8 file reads
        // + ~4-6 recordCheck calls + finalize. Prevents runaway costs.
        stopWhen: stepCountIs(15),
        tools: {
          getFileTree: tool({
            description:
              'List files and directories in the repository. Call this once at the start to plan which files to read.',
            inputSchema: z.object({}),
            execute: async () => {
              const tree = await getFileTree(owner, repo, branch);
              // Filter to source-relevant paths to keep the model focused
              // (and the prompt cheap).
              const filtered = tree
                .filter((e) => e.type === 'blob')
                .filter(
                  (e) =>
                    /\.(t|j)sx?$|^next\.config\.|^package\.json$|^middleware\.|\.mdx?$|^vercel\.json$/.test(
                      e.path,
                    ),
                )
                .slice(0, 200)
                .map((e) => e.path);
              return { files: filtered, totalFiles: tree.length };
            },
          }),
          readFile: tool({
            description:
              'Read the contents of a specific file in the repository. Use sparingly — only request files likely to contain config or routing logic.',
            inputSchema: z.object({
              path: z
                .string()
                .describe('Repo-relative file path returned by getFileTree.'),
            }),
            execute: async ({ path }) => {
              try {
                const content = await getFileContent(owner, repo, path, branch);
                return { path, content };
              } catch (err) {
                return { path, error: (err as Error).message };
              }
            },
          }),
          recordCheck: tool({
            description:
              'Record one finding from your analysis. Call once per finding. Each call is shown to the user in real time.',
            inputSchema: CheckSchema,
            execute: async (input) => {
              collectedChecks.push(input);
              writer.write({
                type: 'data-check',
                id: `check-${collectedChecks.length}`,
                data: input,
              });
              return { recorded: true, count: collectedChecks.length };
            },
          }),
          finalize: tool({
            description:
              'Call exactly once when analysis is complete with a non-engineer-readable executive summary (2-4 sentences).',
            inputSchema: z.object({
              summary: z.string(),
            }),
            execute: async ({ summary: s }) => {
              summary = s;
              return { done: true };
            },
          }),
        },
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
        repoUrl: body.repoUrl!,
        owner,
        repo,
        defaultBranch: branch,
        checks: collectedChecks,
        summary:
          summary ||
          `Analyzed ${collectedChecks.length} checks against ${owner}/${repo}.`,
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
