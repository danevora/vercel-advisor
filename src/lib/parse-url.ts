export type ParsedRepo = { owner: string; repo: string };

export function parseGitHubUrl(input: string): ParsedRepo {
  const trimmed = input.trim();
  const match = trimmed.match(
    /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s]+)\/([^/\s#?]+)(?:[/#?].*)?$/i,
  );
  if (!match) {
    throw new Error(
      'Expected a GitHub URL like https://github.com/vercel/next.js',
    );
  }
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
}
