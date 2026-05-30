#!/bin/bash
# Claude Usage Monitor — SwiftBar / xbar plugin

DATA_FILE="/tmp/claude-usage.json"

if [ ! -f "$DATA_FILE" ]; then
    echo "☁ --%"
    echo "---"
    echo "No data. Open Claude.ai in Chrome."
    exit 0
fi

python3 - "$DATA_FILE" << 'PYEOF'
import json, sys, time, math

try:
    with open(sys.argv[1]) as f:
        d = json.load(f)
except Exception:
    print("☁ ERR")
    sys.exit(0)

usage = d.get("usage", {})
last_updated = d.get("lastUpdated", 0)

def pct(entry):
    if isinstance(entry, (int, float)):
        return round(float(entry), 1)
    if isinstance(entry, dict):
        return round(float(entry.get("pct", 0)), 1)
    return 0.0

def reset_str(entry):
    if isinstance(entry, dict):
        return entry.get("reset") or ""
    return ""

def bar(p, width=10):
    filled = math.floor(p / 100 * width)
    return "█" * filled + "░" * (width - filled)

# Collect all models
models = {
    "Session":      ("session",      "🔵"),
    "All Models":   ("allModels",    "⚪"),
    "Sonnet":       ("sonnet",       "🟣"),
    "Discount":     ("discount_pct", "🟢"),
    "Threshold":    ("threshold_pct","🟠"),
    "Used Credits": ("used_credits", "🟡"),
}

session_pct = pct(usage.get("session", 0))
all_pct     = pct(usage.get("allModels", 0))
mx          = max(session_pct, all_pct)

# Color for menu bar
if   mx >= 90: color = "red";      emoji = "🔴"
elif mx >= 75: color = "#e67e00";  emoji = "🟡"
else:          color = "black";    emoji = "☁️"

# Menu bar: show session / all models
print(f"{emoji} S:{session_pct:.0f}%  A:{all_pct:.0f}% | color={color}")
print("---")

# Each model row
for label, (key, dot) in models.items():
    entry = usage.get(key, {})
    p = pct(entry)
    r = reset_str(entry)
    if p == 0 and not r:
        continue
    b = bar(p)
    print(f"{dot} {label}: {p:.0f}%  {b} | size=12")
    if r:
        print(f"   ↻ {r} | color=gray size=11")

# Last updated
if last_updated:
    ago = int((time.time() - last_updated / 1000) / 60)
    print("---")
    if ago < 1:
        print("Updated just now | color=gray size=11")
    else:
        print(f"Updated {ago} min ago | color=gray size=11")

print("---")
print("Open Usage Settings | href=https://claude.ai/settings/usage")
print("Refresh | refresh=true")
PYEOF
