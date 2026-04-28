#!/usr/bin/env bash
# Summarize Claude Code token usage for today across all sessions in this project.
# Usage: .claude/scripts/cost-today.sh [days]   (default: 1 = today only)

DAYS="${1:-1}"
PROJECT_LOG_DIR="$HOME/.claude/projects/-Users-serrayildirim-projects-akalan-portal"

if [ ! -d "$PROJECT_LOG_DIR" ]; then
  echo "no session logs found at $PROJECT_LOG_DIR"
  exit 0
fi

python3 - "$PROJECT_LOG_DIR" "$DAYS" <<'PY'
import sys, os, json, glob, time
from datetime import datetime, timezone, timedelta

log_dir, days = sys.argv[1], int(sys.argv[2])
cutoff = datetime.now(timezone.utc) - timedelta(days=days)

# Approximate Anthropic API pricing per 1M tokens (USD).
# Cache write = 1.25x base input; cache read = 0.1x base input.
PRICES = {
    "claude-opus-4-7":     {"in": 15.00, "out": 75.00, "cw": 18.75, "cr": 1.50},
    "claude-opus-4-7[1m]": {"in": 30.00, "out": 150.00, "cw": 37.50, "cr": 3.00},
    "claude-opus-4-6":     {"in": 15.00, "out": 75.00, "cw": 18.75, "cr": 1.50},
    "claude-sonnet-4-6":   {"in":  3.00, "out": 15.00, "cw":  3.75, "cr": 0.30},
    "claude-haiku-4-5":    {"in":  1.00, "out":  5.00, "cw":  1.25, "cr": 0.10},
}

totals = {}  # model -> {in, out, cw, cr}
sessions_seen = set()

for path in glob.glob(os.path.join(log_dir, "*.jsonl")):
    try:
        st = os.stat(path)
        if datetime.fromtimestamp(st.st_mtime, tz=timezone.utc) < cutoff:
            continue
    except OSError:
        continue
    sessions_seen.add(os.path.basename(path))
    with open(path, "r", errors="replace") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                ev = json.loads(line)
            except Exception:
                continue
            # Match the timestamp filter at line level if present
            ts = ev.get("timestamp") or ev.get("created_at")
            if ts:
                try:
                    t = datetime.fromisoformat(ts.replace("Z","+00:00"))
                    if t < cutoff:
                        continue
                except Exception:
                    pass
            # Find usage object — could be at top, or nested under message
            usage = None
            for key in ("usage",):
                if isinstance(ev.get(key), dict):
                    usage = ev[key]; break
            if not usage and isinstance(ev.get("message"), dict):
                usage = ev["message"].get("usage")
            if not usage:
                continue
            model = ev.get("model") or (ev.get("message") or {}).get("model") or "unknown"
            t = totals.setdefault(model, {"in":0,"out":0,"cw":0,"cr":0})
            t["in"]  += usage.get("input_tokens", 0) or 0
            t["out"] += usage.get("output_tokens", 0) or 0
            t["cw"]  += usage.get("cache_creation_input_tokens", 0) or 0
            t["cr"]  += usage.get("cache_read_input_tokens", 0) or 0

if not totals:
    print(f"No usage data in last {days} day(s) across {len(sessions_seen)} session(s).")
    sys.exit(0)

label = "today" if days == 1 else f"last {days} days"
print(f"Token usage — {label}  ({len(sessions_seen)} session file(s))")
print("-" * 78)
print(f"{'model':<28} {'input':>10} {'output':>10} {'cache_w':>10} {'cache_r':>10} {'~$':>7}")
grand = 0.0
for model, t in sorted(totals.items(), key=lambda x: -sum(x[1].values())):
    p = PRICES.get(model)
    cost_str = "—"
    if p:
        cost = (t["in"]*p["in"] + t["out"]*p["out"] + t["cw"]*p["cw"] + t["cr"]*p["cr"]) / 1_000_000
        grand += cost
        cost_str = f"{cost:.3f}"
    print(f"{model:<28} {t['in']:>10,} {t['out']:>10,} {t['cw']:>10,} {t['cr']:>10,} {cost_str:>7}")
print("-" * 78)
print(f"{'estimated total (USD)':<70} ~${grand:.3f}")
print()
print("Note: estimates only — uses public per-token list pricing. Actual billing may differ.")
print("Cache reads are ~10x cheaper than fresh input — high cache_r is good (cheap).")
PY
