import { z } from 'zod';

export const CheckCategory = z.enum(['rendering', 'edge-compat', 'caching', 'bundle']);
export type CheckCategory = z.infer<typeof CheckCategory>;

export const CheckStatus = z.enum(['pass', 'warning', 'fail']);
export type CheckStatus = z.infer<typeof CheckStatus>;

export const FileReference = z.object({
  path: z.string().describe('Path to the file relative to repo root.'),
  line: z.number().optional().describe('Line number if known.'),
  excerpt: z.string().optional().describe('Short code excerpt to show context.'),
});

export const CheckSchema = z.object({
  category: CheckCategory,
  name: z.string().describe('Short name for the check, e.g. "Edge-incompatible middleware".'),
  status: CheckStatus,
  explanation: z.string().describe('1-2 sentence plain explanation of what was found.'),
  recommendation: z
    .string()
    .optional()
    .describe('Suggested fix or improvement. Required if status is warning or fail.'),
  fileReferences: z.array(FileReference).optional().describe('Files supporting the finding.'),
});

export type Check = z.infer<typeof CheckSchema>;

export const ReportSchema = z.object({
  id: z.string(),
  repoUrl: z.string(),
  owner: z.string(),
  repo: z.string(),
  defaultBranch: z.string().optional(),
  checks: z.array(CheckSchema),
  summary: z.string().describe('1-paragraph executive summary suitable for a non-engineer.'),
  createdAt: z.string(),
  modelId: z.string(),
});

export type Report = z.infer<typeof ReportSchema>;
