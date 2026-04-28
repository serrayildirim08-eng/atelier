#!/usr/bin/env bash
# Runs after Edit/Write/MultiEdit. If the touched file is .ts/.tsx, run a fast
# incremental typecheck. Exit 2 surfaces stderr back to Claude as a blocking error.

input="$(cat)"
file="$(printf '%s' "$input" | python3 -c 'import sys,json
try:
    d=json.load(sys.stdin)
    print(d.get("tool_input",{}).get("file_path",""))
except Exception:
    print("")')"

case "$file" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}" || exit 0

out="$(npx --no-install tsc --noEmit --incremental 2>&1)"
status=$?
if [ $status -ne 0 ]; then
  {
    echo "TYPECHECK FAILED after editing: $file"
    echo "----"
    printf '%s\n' "$out" | tail -60
  } >&2
  exit 2
fi
exit 0
