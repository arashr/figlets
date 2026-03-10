#!/bin/bash
# figlets update checker — runs at SessionStart, checks at most once per 24h

TIMESTAMP_FILE="$HOME/.cache/figlets-last-check"
PLUGIN_JSON="${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json"
REPO="arashr/figlets"

# Ensure cache dir exists
mkdir -p "$(dirname "$TIMESTAMP_FILE")"

# Skip if checked within the last 24h (86400 seconds)
if [ -f "$TIMESTAMP_FILE" ]; then
  last=$(cat "$TIMESTAMP_FILE")
  now=$(date +%s)
  if [ $((now - last)) -lt 86400 ]; then
    exit 0
  fi
fi

# Write timestamp before the network call so failures don't cause repeated retries
date +%s > "$TIMESTAMP_FILE"

# Fetch latest release tag from GitHub (silent, 3s timeout)
latest=$(curl -sf --max-time 3 \
  "https://api.github.com/repos/${REPO}/releases/latest" \
  2>/dev/null | grep '"tag_name"' | sed 's/.*"v\([^"]*\)".*/\1/')

# Read installed version from plugin.json
[ -f "$PLUGIN_JSON" ] || exit 0
installed=$(grep '"version"' "$PLUGIN_JSON" | sed 's/.*"\([0-9][0-9.]*\)".*/\1/')

# Nothing to do if either value is empty or versions match
[ -z "$latest" ] || [ -z "$installed" ] && exit 0
[ "$latest" = "$installed" ] && exit 0

# Output a system message — Claude will surface this to the user
printf '{"systemMessage": "figlets update available: v%s → v%s. Run: claude plugin update figlets"}\n' \
  "$installed" "$latest" >&2

exit 0
