import { tool } from 'ai';
import { z } from 'zod';
import { getFileTree, getFileContent } from '@/lib/github';
import { CheckSchema, type Check } from '@/lib/schemas';
import { ANALYZE_SYSTEM_PROMPT } from '@/lib/prompts';

export { ANALYZE_SYSTEM_PROMPT };

export const AGENT_STEP_LIMIT = 15;

export const AGENT_PROMPT = (repoUrl: string, owner: string, repo: string, branch: string) =>
  `Analyze the GitHub repository at ${repoUrl}.\nOwner: ${owner}\nRepo: ${repo}\nDefault branch: ${branch}\n\nWhen done, call \`finalize\` with the executive summary.`;

const FRAMEWORK_DEPS = new Set([
  'react',
  'react-dom',
  'next',
  'typescript',
  'tailwindcss',
  '@types/react',
  '@types/react-dom',
  '@types/node',
  'eslint',
  'eslint-config-next',
]);

const FILE_TREE_FILTER =
  /\.(t|j)sx?$|^next\.config\.|^package\.json$|^middleware\.|\.mdx?$|^vercel\.json$/;

/**
 * Builds the four analysis tools (getFileTree, readFile, recordCheck, finalize)
 * with all guardrails wired in. Both the streaming analyze route and the batch
 * eval route use this so they test identical agent behaviour.
 *
 * @param onCheck - optional callback fired for each accepted check (use in the
 *   streaming route to push data-check events to the UI in real time)
 */
export function buildAnalysisTools({
  owner,
  repo,
  branch,
  onCheck,
}: {
  owner: string;
  repo: string;
  branch: string;
  onCheck?: (check: Check, count: number) => void;
}) {
  const filesInTree = new Set<string>();
  const filesRead = new Set<string>();
  const collectedChecks: Check[] = [];
  let summary = '';
  let rejectedCount = 0;

  const tools = {
    getFileTree: tool({
      description:
        'List files and directories in the repository. Call this once at the start to plan which files to read.',
      inputSchema: z.object({}),
      execute: async () => {
        const tree = await getFileTree(owner, repo, branch);
        const filtered = tree
          .filter((e) => e.type === 'blob')
          .filter((e) => FILE_TREE_FILTER.test(e.path))
          .slice(0, 200)
          .map((e) => e.path);
        for (const p of filtered) filesInTree.add(p);
        return { files: filtered, totalFiles: tree.length };
      },
    }),

    readFile: tool({
      description:
        'Read the contents of a specific file in the repository. Use sparingly — only request files likely to contain config or routing logic.',
      inputSchema: z.object({
        path: z.string().describe('Repo-relative file path returned by getFileTree.'),
      }),
      execute: async ({ path }) => {
        try {
          const content = await getFileContent(owner, repo, path, branch);
          filesRead.add(path);
          return { path, content };
        } catch (err) {
          return { path, error: (err as Error).message };
        }
      },
    }),

    recordCheck: tool({
      description:
        'Record one finding from your analysis. Call once per finding. Each call is shown to the user in real time. The server WILL reject findings that cite files you have not read, or that flag framework dependencies as bundle issues.',
      inputSchema: CheckSchema,
      execute: async (input) => {
        // Reject hallucinated file references.
        const badRefs =
          input.fileReferences?.filter(
            (r) => !filesInTree.has(r.path) && !filesRead.has(r.path),
          ) ?? [];
        if (badRefs.length > 0) {
          rejectedCount += 1;
          return {
            recorded: false,
            error: `REJECTED: file reference(s) not found in the repository tree: ${badRefs
              .map((r) => r.path)
              .join(
                ', ',
              )}. Only cite files returned by getFileTree or readFile. Either call readFile to verify, or remove the fileReferences and resubmit.`,
          };
        }

        // Reject "framework dep is bloat" findings.
        if (input.category === 'bundle') {
          const haystack =
            `${input.name} ${input.explanation} ${input.recommendation ?? ''}`.toLowerCase();
          const flaggedFramework = [...FRAMEWORK_DEPS].find((dep) => {
            const re = new RegExp(
              `(^|[^a-z0-9@/-])${dep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9-]|$)`,
              'i',
            );
            return re.test(haystack);
          });
          if (flaggedFramework) {
            rejectedCount += 1;
            return {
              recorded: false,
              error: `REJECTED: this finding flags "${flaggedFramework}" as a bundle issue. Framework dependencies are required and should NOT be flagged. Real bundle issues are things like full lodash/moment imports, missing next/dynamic on heavy components, or oversized client components. Either rewrite the finding to cite a real anti-pattern, or skip it.`,
            };
          }
        }

        collectedChecks.push(input);
        onCheck?.(input, collectedChecks.length);
        return { recorded: true, count: collectedChecks.length };
      },
    }),

    finalize: tool({
      description:
        'Call exactly once when analysis is complete with a non-engineer-readable executive summary (2-4 sentences).',
      inputSchema: z.object({ summary: z.string() }),
      execute: async ({ summary: s }) => {
        summary = s;
        return { done: true };
      },
    }),
  };

  return {
    tools,
    // Getters so callers read the final state after the AI call completes.
    get checks(): Check[] {
      return collectedChecks;
    },
    get summary(): string {
      return summary;
    },
    get rejectedCount(): number {
      return rejectedCount;
    },
  };
}
