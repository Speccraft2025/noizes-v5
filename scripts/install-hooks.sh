#!/usr/bin/env bash
#
# Install this repository's git hooks.
#
# .git/hooks is not tracked, so hooks do not travel with a clone. Run this
# once after cloning:
#
#     ./scripts/install-hooks.sh
#
# The installed hook is a thin shim that calls the tracked script, so edits to
# scripts/pre-commit-guard.sh take effect without reinstalling.
#
set -euo pipefail

root=$(git rev-parse --show-toplevel)
hooks="$root/.git/hooks"
target="$hooks/pre-commit"

mkdir -p "$hooks"

if [ -e "$target" ] && ! grep -q 'pre-commit-guard.sh' "$target" 2>/dev/null; then
  cp "$target" "$target.backup-$(date +%Y%m%d%H%M%S)"
  echo "Existing pre-commit hook backed up."
fi

cat > "$target" <<'SHIM'
#!/usr/bin/env bash
# Installed by scripts/install-hooks.sh — edit scripts/pre-commit-guard.sh instead.
exec "$(git rev-parse --show-toplevel)/scripts/pre-commit-guard.sh"
SHIM

chmod +x "$target"
echo "✓ pre-commit guard installed at .git/hooks/pre-commit"
echo "  Refuses commits over 200 files or 10 MB, nested git repos, and"
echo "  generated directories. Override once with ALLOW_BIG_COMMIT=1."
