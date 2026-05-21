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
    id: 'next-monorepo-sanity',
    repoUrl: 'https://github.com/vercel/next.js',
    description:
      'Massive monorepo — sanity check that the agent does not crash on a huge file tree. No expected findings: this repo is the framework source, not a deployable app, so it has no next.config/middleware/app at the root the agent can meaningfully analyze.',
    expectedFindings: [],
  },
  {
    id: 'shadcn-ui',
    repoUrl: 'https://github.com/shadcn-ui/ui',
    description:
      'Heavy client-side component library. The apps/v4 showcase ships several large client deps and a wide "use client" surface.',
    expectedFindings: [
      {
        category: 'rendering',
        keyword: 'client',
        reason:
          'Over a thousand files in apps/v4 declare "use client", including navigation/chrome components that wrap mostly static content.',
      },
      {
        category: 'bundle',
        keyword: 'lodash',
        reason:
          'apps/v4/package.json depends on the full CJS `lodash` package and apps/v4/components/theme-customizer.tsx imports `lodash/template` in a client component.',
      },
      {
        category: 'bundle',
        keyword: 'recharts',
        reason:
          'recharts is referenced ~450 times across apps/v4 chart components and is shipped in the main client bundle (no next/dynamic wrappers).',
      },
      {
        category: 'bundle',
        keyword: 'icons',
        reason:
          'apps/v4/package.json bundles five icon libraries simultaneously (lucide-react, @tabler/icons-react, @phosphor-icons/react, @remixicon/react, @hugeicons/react).',
      },
      {
        category: 'bundle',
        keyword: 'motion',
        reason:
          'apps/v4 imports `motion` (framer-motion successor, large animation runtime) into client components with no next/dynamic boundary.',
      },
    ],
  },
  {
    id: 'papermark',
    repoUrl: 'https://github.com/papermark/papermark',
    description:
      'Open-source DocSend alternative. Ships a rich-text editor and analytics charts that eagerly load heavy packages with no next/dynamic splits.',
    expectedFindings: [
      {
        category: 'bundle',
        keyword: 'tiptap',
        reason:
          'components/ui/rich-text-editor.tsx is a "use client" component that statically imports @tiptap/react, @tiptap/starter-kit, and three tiptap extensions — no next/dynamic wrapper.',
      },
      {
        category: 'bundle',
        keyword: 'motion',
        reason:
          'components/view/visitor-graph.tsx and components/ui/bar-list.tsx both import `motion` (the framer-motion v12 successor, a large animation runtime) directly at the top level with no dynamic import boundary.',
      },
    ],
  },
  {
    id: 'inbox-zero',
    repoUrl: 'https://github.com/elie222/inbox-zero',
    description:
      'Open-source AI email assistant. The stats dashboard eagerly loads recharts and the full CJS lodash package into a "use client" component.',
    expectedFindings: [
      {
        category: 'bundle',
        keyword: 'recharts',
        reason:
          'apps/web/app/(app)/[emailAccountId]/stats/RuleStatsChart.tsx declares "use client" and imports PieChart, Pie, LabelList from recharts directly — no next/dynamic split.',
      },
      {
        category: 'bundle',
        keyword: 'lodash',
        reason:
          'RuleStatsChart.tsx imports `fromPairs` from the full CJS `lodash` package (not lodash/fromPairs or lodash-es) inside a "use client" component, pulling the entire ~70kb library into the client bundle.',
      },
    ],
  },
  {
    id: 'ai-chatbot',
    repoUrl: 'https://github.com/vercel/ai-chatbot',
    description:
      'Reference AI app — assumed mostly clean (no fail-level findings), but a few heavy editors ship to the client without next/dynamic and the chat UI has a wide "use client" boundary.',
    expectedFindings: [
      {
        category: 'bundle',
        keyword: 'codemirror',
        reason:
          'components/chat/code-editor.tsx statically imports @codemirror/lang-python, /state, /view, and /theme-one-dark in a client component — a Python grammar shipped to every artifact viewer.',
      },
      {
        category: 'bundle',
        keyword: 'prosemirror',
        reason:
          'components/chat/text-editor.tsx pulls in 8 prosemirror-* packages statically inside a "use client" component, with no next/dynamic split.',
      },
      {
        category: 'rendering',
        keyword: 'client',
        reason:
          'Nearly every file under components/chat/ (shell, sidebar, multimodal-input, editors, artifact-actions) begins with "use client" — the chat surface could push more of its tree to server components.',
      },
    ],
    expectClean: true,
  },
];
