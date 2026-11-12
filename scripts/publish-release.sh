#!/usr/bin/env bash
# Publish the release commit and exact version tags as one transaction.
set -euo pipefail

CHECKOUT_SHA=$(git rev-parse HEAD)
git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"
if [ "$RELEASE_RESTORE_BASE" = "true" ]; then
  git tag -a "$RELEASE_BASE_TAG" "$RELEASE_BASE_SHA" -m "Release ${RELEASE_BASE_TAG#v}"
fi
RELEASE_REFS=("HEAD:main" "refs/tags/${RELEASE_BASE_TAG}")
if [ "$RELEASE_BUMPED" = "true" ]; then
  git add .claude-plugin/plugin.json
  git commit -m "chore(release): v${RELEASE_VERSION} [skip ci]"
  git tag -a "v${RELEASE_VERSION}" -m "Release ${RELEASE_VERSION}"
  RELEASE_REFS+=("refs/tags/v${RELEASE_VERSION}")
fi
if git push --atomic origin "${RELEASE_REFS[@]}"; then
  exit 0
fi

# The atomic push published nothing. If main has moved strictly ahead of the
# commit this run checked out, a newer run on main owns this release; any other
# rejection (conflicting tag, diverged history, auth) still fails the job.
git fetch --quiet --no-tags origin refs/heads/main
REMOTE_MAIN=$(git rev-parse FETCH_HEAD)
if [ "$REMOTE_MAIN" != "$CHECKOUT_SHA" ] && git merge-base --is-ancestor "$CHECKOUT_SHA" "$REMOTE_MAIN"; then
  echo "Release skipped: origin/main advanced from ${CHECKOUT_SHA} to ${REMOTE_MAIN}; a newer run on main publishes this release."
  exit 0
fi
echo "Release push failed and origin/main (${REMOTE_MAIN}) has not advanced past ${CHECKOUT_SHA}." >&2
exit 1
