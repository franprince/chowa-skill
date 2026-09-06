# Repository instructions

## Automatic semantic versioning

- GitHub Actions owns `.claude-plugin/plugin.json` version bumps after changes
  reach `main`. Do not manually bump the manifest in a normal PR or replace
  automatic versioning with a requirement for manual bumps.
- Use Conventional Commits based on behavior, not file extension: `fix:` for
  compatible corrections, `feat:` for compatible capabilities, and `!` or a
  `BREAKING CHANGE:` footer for incompatible changes. `docs:`, `chore:`,
  `refactor:`, and other non-release types do not trigger a release by themselves.
  New skill workflows are features; faulty instruction corrections are fixes;
  README presentation edits are documentation.
- Review the final squash commit message, usually derived from the PR title,
  against the complete diff. Preserve any breaking-change marker/footer when
  squash-merging. Automation trusts these labels; it cannot infer compatibility.
- The largest impact since the verified release boundary wins: major > minor >
  patch. Breaking changes use a major bump even while the package is below 1.0.
- Before publishing a PR, fetch the target branch, inspect the relevant commit
  messages, and state the expected release impact in the PR description. An open
  PR has an expected version, not a completed release. PR approval is not merge
  authorization.
- After a requested merge or release check, verify the main-branch Actions run,
  the manifest version, and the matching remote tag and commit. A green workflow
  alone does not prove that a tag was published. Report pending or failed release
  work accurately; do not claim the new version is released before verification.
- Publish annotated version tags explicitly. Existing version tags must never be
  moved or overwritten. If a historical tag is missing, recover the boundary only
  from a matching, verified release commit; never silently replay older releases.

## Edit sources and verify

- Edit workflow prose in `templates/chowa-workflow.md` and metadata/generation
  logic in `scripts/generate-skill.mjs`. Root `scripts/` and `hooks/` are canonical.
  Regenerate with `node scripts/generate-skill.mjs`; do not hand-edit generated
  files under `skills/chowa-skill/`.
- Run `node scripts/generate-skill.mjs --check` before publishing. Run `node --test`
  when changing runtime, generator, or release logic. Verify README diagrams when
  changing them. Use scratch repositories for release tests; do not run the bump
  script in this working tree merely to preview a release, because it edits the
  manifest.
