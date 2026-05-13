import type { CheckCategory } from '@/lib/schemas';

/**
 * Each fixture is a public repo with an expected set of findings.
 *
 * Scoring approach:
 * - Per `expectedFindings` entry, we check that the agent produced at least
 *   one recordCheck call matching the category + a substring of the keyword
 *   in the name/explanation/file reference.
 * - `expectClean` fixtures should NOT produce fail-level findings — that's
 *   our hallucination guard.
 *
 * This is small on purpose. The methodology scales; the coverage doesn't
 * need to be production-grade for the assessment.
 */

export type ExpectedFinding = {
  category: CheckCategory;
  keyword: string; // case-insensitive substring match
  reason: string; // why we expect this — helps with debugging false negatives
};

export type Fixture = {
  id: string;
  repoUrl: string;
  description: string;
  expectedFindings: ExpectedFinding[];
  expectClean?: boolean;
};

export const FIXTURES: Fixture[] = [
  {
    id: 'next-app-router-blog',
    repoUrl: 'https://github.com/vercel/next.js',
    description:
      'Massive monorepo — sanity check that the agent does not crash on a huge file tree.',
    expectedFindings: [],
  },
  {
    id: 'shadcn-ui',
    repoUrl: 'https://github.com/shadcn-ui/ui',
    description:
      'Heavy client-side component library. Expect bundle/rendering observations.',
    expectedFindings: [
      {
        category: 'rendering',
        keyword: 'client',
        reason: 'Most shadcn components are client components.',
      },
    ],
  },
  {
    id: 'ai-chatbot',
    repoUrl: 'https://github.com/vercel/ai-chatbot',
    description:
      'Reference AI app — should be relatively clean since it is a Vercel template.',
    expectedFindings: [],
    expectClean: true,
  },
];
