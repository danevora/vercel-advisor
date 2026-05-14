const GH_BASE = 'https://api.github.com';

function headers() {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'vercel-advisor',
  };
  if (process.env.GITHUB_TOKEN) {
    h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return h;
}

export type RepoMeta = { defaultBranch: string };

export async function getRepoMeta(owner: string, repo: string): Promise<RepoMeta> {
  const res = await fetch(`${GH_BASE}/repos/${owner}/${repo}`, {
    headers: headers(),
    next: { revalidate: 300 },
  });
  if (!res.ok) {
    throw new Error(`GitHub repo fetch failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { default_branch: string };
  return { defaultBranch: data.default_branch };
}

export type TreeEntry = { path: string; type: 'blob' | 'tree'; size?: number };

export async function getFileTree(
  owner: string,
  repo: string,
  branch: string,
): Promise<TreeEntry[]> {
  const res = await fetch(
    `${GH_BASE}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    { headers: headers(), next: { revalidate: 300 } },
  );
  if (!res.ok) {
    throw new Error(`GitHub tree fetch failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { tree: TreeEntry[]; truncated: boolean };
  return data.tree;
}

export async function getFileContent(
  owner: string,
  repo: string,
  path: string,
  branch: string,
): Promise<string> {
  const res = await fetch(
    `${GH_BASE}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`,
    { headers: headers(), next: { revalidate: 300 } },
  );
  if (!res.ok) {
    throw new Error(`GitHub file fetch failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { content: string; encoding: string; size: number };
  if (data.encoding !== 'base64') {
    throw new Error(`Unexpected encoding: ${data.encoding}`);
  }
  // GitHub returns base64 with newlines
  const decoded = Buffer.from(data.content, 'base64').toString('utf-8');
  // Cap file size returned to the model — long files burn tokens with no benefit.
  const MAX = 12_000;
  const capped = decoded.length > MAX ? `${decoded.slice(0, MAX)}\n[truncated]` : decoded;
  // Prepend line numbers so the model can cite them confidently in findings.
  return capped
    .split('\n')
    .map((line, i) => `${String(i + 1).padStart(4, ' ')}  ${line}`)
    .join('\n');
}

export function buildBlobUrl(
  owner: string,
  repo: string,
  branch: string,
  path: string,
  line?: number,
): string {
  const base = `https://github.com/${owner}/${repo}/blob/${branch}/${path}`;
  return line ? `${base}#L${line}` : base;
}
