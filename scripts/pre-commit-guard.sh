#!/usr/bin/env bash
#
# Refuse commits that look like a mistake rather than a change.
#
# Two things have gone wrong here before, both from dropping a generated
# subproject into the repo and running `git add`:
#
#   1. 980 files and 95 MB of Gradle output were staged in one commit — a
#      debug APK, merged dex, file-hash caches. Caught by hand, never pushed,
#      but only because someone happened to look.
#
#   2. A 762 MB directory turned out to be its own git repository. `git add`
#      on a nested repo records a gitlink: a bare commit pointer with no
#      files. Clones get an empty directory and no way to fill it.
#
# Neither is loud on its own. This makes both loud.
#
# Override for a genuinely large commit:  ALLOW_BIG_COMMIT=1 git commit ...
#
set -uo pipefail

MAX_FILES=${MAX_FILES:-200}
MAX_BYTES=${MAX_BYTES:-10485760}   # 10 MB

staged=$(git diff --cached --name-only --diff-filter=ACM)
[ -z "$staged" ] && exit 0

fail=0
note() { printf '\n\033[1;31m✗ %s\033[0m\n' "$1" >&2; }
hint() { printf '  %s\n' "$1" >&2; }

# ── Nested repositories ─────────────────────────────────────────────────────
# A gitlink is staged with mode 160000. This is the only reliable signal, and
# it is silent in normal `git status` output.
gitlinks=$(git diff --cached --raw | awk '$2 == "160000" { print $NF }')
if [ -n "$gitlinks" ]; then
  note "Nested git repository staged"
  hint "These are recorded as bare commit pointers — a clone gets empty directories:"
  printf '%s\n' "$gitlinks" | sed 's/^/    /' >&2
  hint ""
  hint "To absorb one into this repo instead:"
  hint "    git rm --cached <dir> && rm -rf <dir>/.git && git add <dir>"
  hint "Back up its history first:  git -C <dir> bundle create ../<dir>.bundle --all"
  fail=1
fi

# ── Sheer volume ────────────────────────────────────────────────────────────
count=$(printf '%s\n' "$staged" | wc -l | tr -d ' ')
bytes=0
while IFS= read -r file; do
  [ -f "$file" ] || continue
  size=$(wc -c < "$file" 2>/dev/null | tr -d ' ')
  bytes=$((bytes + ${size:-0}))
done <<< "$staged"

human=$(awk -v b="$bytes" 'BEGIN { printf "%.1f MB", b/1048576 }')

if [ "$count" -gt "$MAX_FILES" ] || [ "$bytes" -gt "$MAX_BYTES" ]; then
  note "Unusually large commit: $count files, $human"
  hint "Limits: $MAX_FILES files, $(awk -v b=$MAX_BYTES 'BEGIN{printf "%.0f MB", b/1048576}')."
  hint ""
  hint "Largest staged files:"
  printf '%s\n' "$staged" | while IFS= read -r f; do
    [ -f "$f" ] && printf '%s\t%s\n' "$(wc -c < "$f" | tr -d ' ')" "$f"
  done | sort -rn | head -5 | awk -F'\t' '{ printf "    %8.1f MB  %s\n", $1/1048576, $2 }' >&2
  hint ""
  hint "If this is build output, add it to .gitignore and unstage:"
  hint "    git restore --staged <path>"
  hint "If the size is intended:  ALLOW_BIG_COMMIT=1 git commit ..."
  fail=1
fi

# ── Common generated paths, whatever the size ───────────────────────────────
junk=$(printf '%s\n' "$staged" | grep -E '(^|/)(node_modules|\.gradle|\.kotlin|\.next|\.svelte-kit|\.wrangler|\.vinext)/' || true)
if [ -n "$junk" ]; then
  note "Generated or dependency files staged"
  printf '%s\n' "$junk" | head -8 | sed 's/^/    /' >&2
  [ "$(printf '%s\n' "$junk" | wc -l | tr -d ' ')" -gt 8 ] && hint "    … and more"
  hint ""
  hint "These are rebuilt, not authored. Add them to .gitignore."
  fail=1
fi

if [ "$fail" -ne 0 ]; then
  if [ "${ALLOW_BIG_COMMIT:-}" = "1" ]; then
    printf '\n\033[1;33m⚠ ALLOW_BIG_COMMIT=1 — proceeding anyway.\033[0m\n\n' >&2
    exit 0
  fi
  printf '\n' >&2
  exit 1
fi

exit 0
