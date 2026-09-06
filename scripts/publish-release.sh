#!/usr/bin/env bash
# Publish the release commit and exact version tags as one transaction.
set -euo pipefail

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
git push --atomic origin "${RELEASE_REFS[@]}"
