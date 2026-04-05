#!/usr/bin/env bash
set -euo pipefail

REPO="arashr/figlets"
SKILLS_DIR="${HOME}/.claude/skills"
SKILLS=("fig-setup" "fig-create" "fig-qa" "fig-document")
RAW="https://raw.githubusercontent.com/${REPO}/main/skills"

# Scripts bundled with each skill
declare -A SCRIPTS
SCRIPTS["fig-setup"]="create-text-styles.js create-elevation-styles.js"
SCRIPTS["fig-create"]="collect-values.js post-build-audit.js"
SCRIPTS["fig-qa"]="audit-traverse.js fix-violation.js"
SCRIPTS["fig-document"]="read-bounds.js read-bindings.js"

echo ""
echo "Installing figlets..."
echo ""

# Create skill directories (including scripts subdirs)
for skill in "${SKILLS[@]}"; do
  mkdir -p "${SKILLS_DIR}/${skill}/scripts"
done

if command -v curl &>/dev/null; then
  for skill in "${SKILLS[@]}"; do
    curl -fsSL "${RAW}/${skill}/SKILL.md" -o "${SKILLS_DIR}/${skill}/SKILL.md"
    for script in ${SCRIPTS[$skill]}; do
      curl -fsSL "${RAW}/${skill}/scripts/${script}" -o "${SKILLS_DIR}/${skill}/scripts/${script}"
    done
    echo "  ✓ ${skill}"
  done
elif command -v wget &>/dev/null; then
  for skill in "${SKILLS[@]}"; do
    wget -qO "${SKILLS_DIR}/${skill}/SKILL.md" "${RAW}/${skill}/SKILL.md"
    for script in ${SCRIPTS[$skill]}; do
      wget -qO "${SKILLS_DIR}/${skill}/scripts/${script}" "${RAW}/${skill}/scripts/${script}"
    done
    echo "  ✓ ${skill}"
  done
else
  echo "Error: curl or wget is required to install figlets." >&2
  exit 1
fi

echo ""
echo "✅ figlets installed! Four skills are now available in Claude Code:"
echo ""
echo "   /fig-setup     Bootstrap a design system variable architecture"
echo "   /fig-create    Build a production-quality Figma component"
echo "   /fig-qa        Audit a component for token/variable compliance"
echo "   /fig-document  Generate a visual spec sheet and handover file"
echo ""
echo "Open any project with Claude Code and type /fig-setup or /fig-create to get started."
echo ""
