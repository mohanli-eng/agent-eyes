#!/usr/bin/env bash
# Install vibe-delivery skill into Claude Code.
#
# Usage:
#   bash install.sh           # Install globally to ~/.claude/skills/vibe-delivery
#   bash install.sh --link    # Symlink globally (changes to source apply immediately)
#   bash install.sh --project # Also install as project-level skill (in current cwd)
#   bash install.sh --link --project   # Both (best for dogfooding)

set -euo pipefail

# ----------------------------------------------------------------------------
# Resolve paths
# ----------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GLOBAL_SKILLS_DIR="${HOME}/.claude/skills/vibe-delivery"
PROJECT_SKILLS_DIR="$(pwd)/.claude/skills/vibe-delivery"

# ----------------------------------------------------------------------------
# Parse args
# ----------------------------------------------------------------------------
USE_SYMLINK=false
INSTALL_PROJECT_LEVEL=false

for arg in "$@"; do
  case $arg in
    --link)
      USE_SYMLINK=true
      ;;
    --project)
      INSTALL_PROJECT_LEVEL=true
      ;;
    -h|--help)
      sed -n '3,8p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

# ----------------------------------------------------------------------------
# Verify source files exist
# ----------------------------------------------------------------------------
if [[ ! -f "${SCRIPT_DIR}/SKILL.md" ]]; then
  echo "✗ Source SKILL.md not found at ${SCRIPT_DIR}/SKILL.md" >&2
  exit 1
fi

# ----------------------------------------------------------------------------
# Install function
# ----------------------------------------------------------------------------
install_to() {
  local target_dir="$1"
  local label="$2"

  echo "→ Installing to ${label}: ${target_dir}"

  # Clean previous install
  if [[ -e "${target_dir}" || -L "${target_dir}" ]]; then
    rm -rf "${target_dir}"
  fi
  mkdir -p "$(dirname "${target_dir}")"

  if [[ "${USE_SYMLINK}" == "true" ]]; then
    ln -s "${SCRIPT_DIR}" "${target_dir}"
    echo "  ✓ Symlinked (changes to source apply immediately)"
  else
    mkdir -p "${target_dir}"
    cp "${SCRIPT_DIR}/SKILL.md" "${target_dir}/SKILL.md"
    if [[ -d "${SCRIPT_DIR}/references" ]]; then
      cp -r "${SCRIPT_DIR}/references" "${target_dir}/references"
      echo "  ✓ Copied SKILL.md + references/"
    else
      echo "  ✓ Copied SKILL.md (no references/ found, skipped)"
    fi
  fi
}

# ----------------------------------------------------------------------------
# Run installs
# ----------------------------------------------------------------------------
echo "vibe-delivery installer"
echo "─────────────────────────"
echo "  Source:  ${SCRIPT_DIR}"
echo "  Mode:    $([[ "${USE_SYMLINK}" == "true" ]] && echo "symlink" || echo "copy")"
echo ""

# Always install globally
install_to "${GLOBAL_SKILLS_DIR}" "global skills"

# Optionally install at project level
if [[ "${INSTALL_PROJECT_LEVEL}" == "true" ]]; then
  install_to "${PROJECT_SKILLS_DIR}" "project skills (current cwd)"
fi

# ----------------------------------------------------------------------------
# Final reminders
# ----------------------------------------------------------------------------
echo ""
echo "✓ Installation complete."
echo ""
echo "Next steps:"
echo "  1. Restart Claude Code (or reload skills)"
echo "  2. Try: /prd I want to build [your idea]"
echo ""
echo "  3. For runtime observation in /test stage, also configure browser-eyes-mcp."
echo "     See: ${SCRIPT_DIR}/../browser-eyes-mcp/README.md"
echo ""
