# Implementation Plan: Skill instruction consistency and context use

## Approach

1. Rewrite `templates/chowa-workflow.md` around activation, task entry,
   capability fallbacks, and the core workflow. Preserve the existing
   `shared`, `chowa-only`, and `chowa-skill-only` variant contract.
2. Keep hook setup, visual proof/Storybook, roadmap, and language-mode
   procedures in shared template blocks marked for reference extraction.
   Place links to extracted references only in the skill-only variant.
   The sibling renderer continues to receive the procedures inline.
3. Update `scripts/generate-skill.mjs` to emit `SKILL.md` and
   `references/*.md` from the same template. Remove generator-owned prose
   duplication, shorten frontmatter, and validate all generated artifacts
   in `--check` mode. Reject malformed or unsafe reference markers.
4. Make push-guard feedback independent of a repository's branch topology;
   align opt-in comments and the mechanical-agent result contract. Update
   README, config comments, and plugin descriptions to describe the final
   packaging and source-of-truth rules accurately.
5. Replace obsolete wording assertions with generation/resource invariants,
   run existing quality gates, measure entrypoint size, and independently
   evaluate realistic workflow scenarios.

## Coverage

- Goals 1–4: shared template and extracted reference procedures.
- Goal 5: template, guard feedback, agent contract, README/config metadata.
- Goal 6: generator, references, generation tests, entrypoint measurement.

## Verification

- `node --test`
- `node scripts/generate-skill.mjs --check`
- Skill-creator frontmatter validator, when its local dependencies exist.
- Generated-resource tests: extraction, safe names, malformed boundaries,
  complete freshness checking, link resolution, and standalone shared
  rendering with no skill-only resource links.
- Independent dry-run scenarios: already-authorized implementation and PR,
  config-only activation, UI change without visual-proof opt-in, limited
  host tools, lean roadmap metadata, and explicit Storybook collection.

## Delivery

Commit the verified changes and open a PR from `refactor/skill-instructions`
against `main`, as requested. Merging, releases, and personal-installation
updates are outside scope.

## Verification Results

- Full repository suite: **124 tests passed**. The initial sandboxed run
  could not spawn local Node subprocesses (`EPERM`); a permitted run outside
  that restriction passed, including process-level hook contract tests.
- Generation tests passed after the final wording refinements.
- `node scripts/generate-skill.mjs --check`: entrypoint and four references
  match the template.
- Skill-creator validator: `Skill is valid!`.
- `git diff --check`: passed.
- Hook matching, opt-in detection, plugin versions, and installed host
  configurations were not changed.

### Context size

| Artifact scope | Before | After |
|---|---:|---:|
| Core entrypoint characters | 19,681 | 10,223 |
| Core entrypoint lines | 362 | 197 |
| Approximate core tokens (characters / 4) | 4,920 | 2,556 |
| Core plus all generated references, characters | 19,681 | 16,306 |

The core is **48.1% smaller** by character count. Tokens are estimates, not
model-tokenizer measurements. Optional reference reads add context only when
their procedures apply; total generated prose is also smaller.

### Independent scenario review

A separate agent performed a read-only walkthrough of the rewritten
instructions. This evaluates prompt behavior, not live host integration.

| Scenario | Result |
|---|---|
| Plan and implement in config-only repository | Activates, persists artifacts, reuses authorization |
| Open PR for tested committed changes | Enters PR stage directly, reuses unchanged checks, asks no duplicate approval |
| Behavior-only TSX edit without proof opt-in | Does not load proof guidance or run Storybook |
| Host lacks optional question/task/subagent tools | Uses conversation, durable tasks when appropriate, and inline execution |
| Quick roadmap with 25 rows and no stability metadata | Reads index only and omits unavailable markers |
| Requested Storybook proof with separately installed plugin | Loads proof reference and resolves the absolute helper path with project CWD |

The review found two clarity issues: PR preparation needed an explicit scope
condition, and helper-root resolution needed to name the skill directory as
its starting point. Both were corrected before final generation checks.

Shared procedures remain inline under the sibling variant-selection contract;
the external sibling renderer was not run or modified. No hooks were installed
and no release or personal skill installation was updated.
