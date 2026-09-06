# Plan

1. Restore normal automatic-release files and remove the unpublished manual-bump
   gate. Keep the current manifest at the released 0.12.0.
2. Resolve the boundary from the exact current-version tag, or a matching release
   commit whose manifest and version transition can be verified. Return boundary
   metadata for one-time recovery of missing tags.
3. Preserve highest-impact Conventional Commit classification; read the subject
   separately from the body and recognize both standard breaking-footer spellings.
4. Have the workflow create annotated baseline/new-release tags and push explicit
   refs atomically with main. Serialize release jobs and keep tag collisions fatal.
5. Run unit and process tests plus the actual release shell command against local
   repositories. Document verification, commit, and publish the requested PR.


## Verification

- All 140 Node tests pass; generated artifacts remain synchronized.
- Regression fixtures recover the current release when only an older tag exists,
  reject unverifiable/mismatched/non-ancestor boundaries, and distinguish docs,
  patch, minor, and major impacts without replaying older feature commits.
- Process tests execute the real bump and publication scripts against temporary
  local Git remotes. Both recovered and new tags are annotated and pushed;
  subsequent documentation changes cause no bump; the next fix is patch-only.
- Tests confirm documentation-only tag recovery makes no release commit and
  changes no version, existing tags cannot be overwritten, and an advanced
  remote atomically rejects both the new release commit and tag publication.
- Workflow YAML parses and the publication script passes bash syntax checking.

The manifest stays at 0.12.0 in this PR. With a fix(release) squash commit and
an unchanged base, merging should automatically produce 0.12.1 and restore
v0.12.0 at its original verified release commit. These are expected results;
no production release tags were created or pushed during verification.
