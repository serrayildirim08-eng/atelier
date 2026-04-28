#!/usr/bin/env bash
# Runs before any Bash tool call. If the command is `git commit`, gate it on
# typecheck + lint + tests (+ prettier if installed). Exit 2 blocks the commit.
# Bypass: ALLOW_BROKEN_COMMIT=1 git commit ...

input="$(cat)"
cmd="$(printf '%s' "$input" | python3 -c 'import sys,json
try:
    d=json.load(sys.stdin)
    print(d.get("tool_input",{}).get("command",""))
except Exception:
    print("")')"

# Only gate actual commits. Skip status, log, diff, commit-tree, etc.
if ! printf '%s' "$cmd" | grep -Eq '(^|[^a-zA-Z0-9_-])git commit($|[^a-zA-Z0-9_-])'; then
  exit 0
fi

if [ "${ALLOW_BROKEN_COMMIT:-0}" = "1" ]; then
  echo "⚠ pre-commit gate skipped (ALLOW_BROKEN_COMMIT=1)" >&2
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}" || { echo "BLOCKED: cannot cd to project" >&2; exit 2; }

step() { printf '→ pre-commit: %s\n' "$1" >&2; }
fail() { { echo "BLOCKED: $1 failed"; echo "----"; printf '%s\n' "$2" | tail -60; } >&2; exit 2; }

step "typecheck"
out="$(npx --no-install tsc --noEmit 2>&1)" || fail "typecheck" "$out"

step "lint"
out="$(npm run lint --silent 2>&1)" || fail "lint" "$out"

step "tests"
out="$(npm test --silent 2>&1)" || fail "tests" "$out"

# Optional: auto-format staged files if prettier is installed.
if [ -x "node_modules/.bin/prettier" ] || command -v prettier >/dev/null 2>&1; then
  step "prettier (staged files)"
  staged="$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx|js|jsx|json|css|md)$' || true)"
  if [ -n "$staged" ]; then
    if [ -x "node_modules/.bin/prettier" ]; then
      ./node_modules/.bin/prettier --write $staged >/dev/null 2>&1 || true
    else
      prettier --write $staged >/dev/null 2>&1 || true
    fi
    git add $staged
  fi
fi

echo "✓ pre-commit gate: all green" >&2
exit 0
