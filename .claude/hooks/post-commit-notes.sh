#!/usr/bin/env bash
# Hook: after a git commit, update interview prep notes in notes/
source ~/.nvm/nvm.sh 2>/dev/null

INPUT=$(cat)

# Only run if the tool call was a git commit
echo "$INPUT" | python3 -c "
import sys, json
d = json.load(sys.stdin)
cmd = d.get('tool_input', {}).get('command', '')
exit(0 if 'git commit' in cmd else 1)
" 2>/dev/null || exit 0

cd ~/repos/vercel-advisor || exit 0

DIFF=$(git diff HEAD~1 HEAD --stat 2>/dev/null)
CHANGED=$(git diff HEAD~1 HEAD --name-only 2>/dev/null)

claude -p "You maintain interview prep notes for a developer building vercel-advisor (a Next.js + Vercel AI SDK deployment readiness tool for Vercel). A git commit just happened. Files changed: $CHANGED. Diff summary: $DIFF. Update the notes/ folder to reflect new code. Notes are PERSONAL TALKING POINTS for the developer in a Vercel Solutions Architect panel interview — first-person explanations, decision defenses, code file references (e.g. src/app/api/route.ts:42). Only update notes relevant to what changed." \
  --allowedTools Bash,Read,Edit,Write \
  --max-turns 10 \
  2>/dev/null &
