#!/bin/bash
# figlets release script
# Usage: ./scripts/release.sh [patch|minor|major]
# Bumps the version, shows a change summary, asks for confirmation,
# then commits + tags + pushes to trigger the GitHub Actions release.

set -e

BUMP=${1:-patch}
PLUGIN_JSON=".claude-plugin/plugin.json"
MARKETPLACE_JSON=".claude-plugin/marketplace.json"

# Must be run from repo root
if [ ! -f "$PLUGIN_JSON" ]; then
  echo "Error: run this script from the figlets repo root"
  exit 1
fi

# Warn (not block) if there are uncommitted changes
if ! git diff --quiet HEAD 2>/dev/null; then
  echo "Warning: working tree has uncommitted changes."
  echo "These will NOT be included in the release unless you commit them first."
  echo ""
fi

# Read and parse current version
CURRENT=$(grep '"version"' "$PLUGIN_JSON" | sed 's/.*"\([0-9.]*\)".*/\1/')
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"

# Calculate new version
case "$BUMP" in
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  patch) PATCH=$((PATCH + 1)) ;;
  *)     echo "Usage: $0 [patch|minor|major]"; exit 1 ;;
esac

NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"

# Header
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  figlets  v${CURRENT}  →  v${NEW_VERSION}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Commits since last tag
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
if [ -n "$LAST_TAG" ]; then
  echo "Commits since ${LAST_TAG}:"
  git log "${LAST_TAG}..HEAD" --oneline | sed 's/^/  /'
else
  echo "Commits (first release):"
  git log --oneline | sed 's/^/  /'
fi
echo ""

# Which SKILL.md files changed
if [ -n "$LAST_TAG" ]; then
  CHANGED=$(git diff "${LAST_TAG}..HEAD" --name-only 2>/dev/null | grep 'SKILL\.md' || true)
else
  CHANGED=$(git ls-files 'skills/*/SKILL.md' 2>/dev/null || true)
fi
if [ -n "$CHANGED" ]; then
  echo "Changed skills:"
  echo "$CHANGED" | sed 's/^/  /'
  echo ""
fi

# Confirm
printf "Publish v${NEW_VERSION}? [y/N] "
read -r CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
  echo "Aborted."
  exit 0
fi

# Bump version in plugin.json and marketplace.json (macOS + Linux compatible)
if [[ "$OSTYPE" == "darwin"* ]]; then
  sed -i '' "s/\"version\": \"${CURRENT}\"/\"version\": \"${NEW_VERSION}\"/" "$PLUGIN_JSON"
  sed -i '' "s/\"version\": \"${CURRENT}\"/\"version\": \"${NEW_VERSION}\"/" "$MARKETPLACE_JSON"
else
  sed -i "s/\"version\": \"${CURRENT}\"/\"version\": \"${NEW_VERSION}\"/" "$PLUGIN_JSON"
  sed -i "s/\"version\": \"${CURRENT}\"/\"version\": \"${NEW_VERSION}\"/" "$MARKETPLACE_JSON"
fi

# Commit, tag, push
git add "$PLUGIN_JSON" "$MARKETPLACE_JSON"
git commit -m "chore: release v${NEW_VERSION}"
git tag "v${NEW_VERSION}"
git push origin main
git push origin "v${NEW_VERSION}"

echo ""
echo "✓ v${NEW_VERSION} published"
echo "  https://github.com/arashr/figlets/releases/tag/v${NEW_VERSION}"
