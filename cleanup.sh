#!/usr/bin/env bash
#
# cleanup.sh - force-remove every linked worktree and every branch except the
# kept branches (main by default), both locally and on every configured remote.
#
# Usage:
#   ./cleanup.sh [--yes] [extra-keep-branch ...]
#
#   -y, --yes   Skip the confirmation prompt.
#   -h, --help  Show this help.
#
# Any non-option argument is an extra branch to keep (main is always kept).
# The primary worktree is never removed. The script aborts if a remote's
# default branch is not in the keep list, so pass it explicitly if needed.
#
set -euo pipefail

PROG=${0##*/}
KEEP=(main)

usage() {
  cat <<EOF
Usage: $PROG [--yes] [extra-keep-branch ...]

Force-deletes every linked worktree and every branch except the kept
branches (default: main), locally and on every configured remote.

  -y, --yes   Skip the confirmation prompt.
  -h, --help  Show this help.

Any other argument is an extra branch to keep; 'main' is always kept.
EOF
}

ASSUME_YES=0
for arg in "$@"; do
  case "$arg" in
    -y | --yes) ASSUME_YES=1 ;;
    -h | --help)
      usage
      exit 0
      ;;
    -*)
      printf 'error: unknown option: %s\n' "$arg" >&2
      usage >&2
      exit 2
      ;;
    *) KEEP+=("$arg") ;;
  esac
done

is_kept() {
  local name=${1#refs/heads/} keep
  for keep in "${KEEP[@]}"; do
    [ "$name" = "$keep" ] && return 0
  done
  return 1
}

# --- preflight -------------------------------------------------------------

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || {
  echo 'error: not inside a Git working tree' >&2
  exit 1
}

if COMMON_DIR=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null); then
  PRIMARY=$(dirname "$COMMON_DIR")
else
  PRIMARY=$(git rev-parse --show-toplevel)
fi
cd "$PRIMARY"

REMOTES=$(git remote)

# Refuse to delete a remote's default branch.
for remote in $REMOTES; do
  default=$(git ls-remote --symref "$remote" HEAD 2>/dev/null | awk '/^ref:/ {print $2; exit}')
  default=${default#refs/heads/}
  if [ -n "$default" ] && ! is_kept "$default"; then
    printf "error: remote '%s' default branch '%s' is not kept\n" "$remote" "$default" >&2
    printf '       re-run as: %s %s\n' "$PROG" "$default" >&2
    exit 1
  fi
done

if [ "$ASSUME_YES" -ne 1 ]; then
  printf 'This FORCE-deletes all linked worktrees and all branches except: %s\n' "${KEEP[*]}"
  printf 'Local repository: %s\n' "$PRIMARY"
  printf 'Remotes: %s\n' "${REMOTES:-<none>}"
  printf 'Continue? [y/N] '
  read -r reply
  case "$reply" in
    [yY] | [yY][eE][sS]) ;;
    *)
      echo 'Aborted.'
      exit 1
      ;;
  esac
fi

fail=0
warn() {
  printf 'warning: %s\n' "$*" >&2
  fail=1
}

# --- 1. remove every linked worktree except the primary --------------------

while IFS= read -r wt; do
  [ -n "$wt" ] || continue
  [ "$wt" = "$PRIMARY" ] && continue
  printf 'Removing worktree: %s\n' "$wt"
  git worktree remove --force --force -- "$wt" || warn "could not remove worktree: $wt"
done < <(git worktree list --porcelain | awk '/^worktree / {print substr($0, 10)}')

# --- 2. move the primary worktree off a doomed branch ----------------------

current=$(git symbolic-ref --quiet --short HEAD || true)
if [ -n "$current" ] && ! is_kept "$current"; then
  if ! git show-ref --verify --quiet refs/heads/main; then
    echo "error: local branch 'main' is missing; create it before running" >&2
    exit 1
  fi
  printf 'Switching primary worktree: %s -> main\n' "$current"
  git switch main
fi

# --- 3. delete every local branch except the kept ones ---------------------

while IFS= read -r branch; do
  [ -n "$branch" ] || continue
  is_kept "$branch" && continue
  printf 'Deleting local branch: %s\n' "$branch"
  git branch -D -- "$branch" || warn "could not delete local branch: $branch"
done < <(git for-each-ref refs/heads/ --format='%(refname:short)')

# --- 4. delete every remote branch except the kept ones --------------------

for remote in $REMOTES; do
  while IFS= read -r ref; do
    [ -n "$ref" ] || continue
    is_kept "$ref" && continue
    printf 'Deleting remote branch: %s/%s\n' "$remote" "${ref#refs/heads/}"
    git push "$remote" --delete "$ref" || warn "could not delete $remote/$ref"
  done < <(git ls-remote --heads "$remote" | awk '{print $2}')
done

# --- 5. drop stale remote-tracking refs ------------------------------------

for remote in $REMOTES; do
  git remote prune "$remote" || warn "could not prune remote: $remote"
done

if [ "$fail" -ne 0 ]; then
  echo 'Finished with warnings.' >&2
  exit 1
fi

printf 'Done. Kept only: %s\n' "${KEEP[*]}"
