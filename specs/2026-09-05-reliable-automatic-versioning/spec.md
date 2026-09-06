# Reliable automatic versioning

Status: Done

The user requested a PR after reviewing automatic semantic versioning. Preserve
merge-time version bumps from Conventional Commits; discard the earlier,
unpublished proposal for mandatory manual bumps.

The release workflow creates lightweight tags but pushes only annotated tags.
The remote has only v0.2.0, so older feature commits repeatedly cause minor bumps.

Acceptance criteria:
- Recover the current 0.12.0 boundary from its matching release commit when its
  tag is absent; never replay older releases or silently accept an invalid boundary.
- Compute major/minor/patch from new Conventional Commits only. Reject malformed
  current versions. Ignore commit-body examples that resemble commit subjects.
- Create annotated tags and publish the exact release refs atomically with the
  release commit. Preserve existing tags and make no manual manifest bump in PRs.
- Record commit classification, squash-message review, and actual post-merge
  manifest/tag verification in AGENTS.md and the README.
- Test stale tags, no-bump documentation changes, fixes, features, breaking
  changes, invalid boundaries, and real workflow publication in local Git fixtures.
