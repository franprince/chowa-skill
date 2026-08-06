#!/usr/bin/env node
/**
 * Skill generation
 *
 * `templates/chowa-workflow.md` is the source of truth shared with
 * chowa's own `sync-skill.ts` (github.com/franprince/chowa) — every block
 * is tagged `shared`, `chowa-only`, or `chowa-skill-only`. This script
 * keeps `shared` + `chowa-skill-only` blocks (dropping `chowa-only`),
 * numbers the resulting `### ` headings sequentially, and wraps the
 * result with this repo's frontmatter and the two sections that only
 * ever live in the generated file (not in the template, since chowa's
 * render step has no use for them).
 *
 * Usage:
 *   node scripts/generate-skill.mjs          # write skills/chowa-skill/SKILL.md
 *   node scripts/generate-skill.mjs --check  # exit 1 if it would change
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const TEMPLATE = join(repoRoot, 'templates/chowa-workflow.md');
export const GENERATED_SKILL = join(repoRoot, 'skills/chowa-skill/SKILL.md');

const FRONTMATTER = `---
name: chowa-skill
description: >
  Spec-driven development workflow — spec → plan → execute pipeline, atomic
  Conventional Commits, PR generation, branching rules, and mechanical
  sub-task delegation — using only this harness's own native tools (Read,
  Edit, Write, Bash, Agent) plus \`git\`/\`gh\`. No CLI, no bundled engine,
  nothing to install or version separately from the skill itself. Use this
  whenever the user asks to start a new feature, write a spec or
  implementation plan, commit changes, open a pull request, check whether a
  PR is actually ready to merge, or delegate mechanical work to a cheaper
  model — even if they don't name this skill explicitly. Detects whether
  the current project already follows this convention before applying
  anything.
---`;

// Not part of the template: nothing in chowa's render step needs to know
// these exist, so they're kept here as a static suffix rather than
// round-tripped through variant tags.
const STATIC_SUFFIX = `## What this skill intentionally does not do

- **No model routing against live provider data.** The table in Delegation
  Guidance is a fixed heuristic, not a resolved policy — there's no
  \`chowa.config.ts\` and no router here.
- **No session-lifecycle tracking or quota-aware auto-resume.** That needs
  real hook scripts reacting to \`SessionStart\`/\`StopFailure\` events, which
  fire outside any model turn — genuinely not something a tool-calls-only
  skill can do. If you need that, it lives in the CLI-backed sibling
  project, not here.
- **No commit-message generation via a separate delegated model call.**
  The primary session model writes commit messages and PR descriptions
  directly — simpler than routing that through another call, at the cost
  of not being able to pin a cheaper model specifically for it.

## Quick Reference

| What | How |
|---|---|
| Check remote is up to date | \`git fetch origin && git status -sb\` |
| Inspect the diff before committing | \`git diff\`, \`git status\` |
| Open a PR | \`gh pr create\` |
| Check a PR is actually mergeable | \`gh pr view <n> --json mergeable,mergeStateStatus\` |
| PR description context | \`git log <base>..HEAD\`, \`git diff <base>...HEAD\` |
| Personal always-on preference | \`~/.chowa-skill/preferences.json\` — \`{"alwaysOn": true}\` |
`;

const VALID_TAGS = new Set(['shared', 'chowa-only', 'chowa-skill-only']);

/**
 * Render the template for chowa-skill's own generated file: drop
 * `chowa-only` blocks (markers and content) in place, unwrap `shared` and
 * `chowa-skill-only` blocks (drop only the markers, keep the content
 * exactly where it sits), then number the `### ` headings in document
 * order (the template carries no numbers, since chowa's own render of
 * this same file numbers differently). Substituting in place — rather
 * than extracting and rejoining kept blocks — is what preserves the
 * original blank-line spacing between blocks without a separate joiner.
 */
export function renderTemplate(template) {
  assertWellFormed(template);

  const body = template.slice(template.indexOf('<!-- variant:'));
  const withoutChowaOnly = body.replace(
    /<!-- variant:chowa-only -->\n?[\s\S]*?<!-- variant:end -->\n?/g,
    '',
  );
  const unwrapped = withoutChowaOnly.replace(
    /<!-- variant:(?:shared|chowa-skill-only) -->\n?([\s\S]*?)<!-- variant:end -->\n?/g,
    '$1',
  );

  const collapsed = unwrapped.replace(/\n{3,}/g, '\n\n').trim();

  let n = 0;
  return collapsed.replace(/^### (.+)$/gm, (_, title) => `### ${++n}. ${title}`);
}

function assertWellFormed(template) {
  const starts = [...template.matchAll(/<!-- variant:(\S+) -->/g)];
  for (const [, tag] of starts) {
    if (tag !== 'end' && !VALID_TAGS.has(tag)) {
      throw new Error(`Unrecognized variant tag "${tag}" in ${TEMPLATE}.`);
    }
  }
  const opens = starts.filter(([, tag]) => tag !== 'end').length;
  const closes = (template.match(/<!-- variant:end -->/g) ?? []).length;
  if (opens !== closes) {
    throw new Error(
      `Unmatched variant markers in ${TEMPLATE}: ${opens} start marker(s), ${closes} end marker(s).`,
    );
  }
}

function assemble(template) {
  return `${FRONTMATTER}\n\n${renderTemplate(template)}\n\n${STATIC_SUFFIX}`;
}

function main() {
  const checkOnly = process.argv.includes('--check');
  const template = readFileSync(TEMPLATE, 'utf-8');
  const generated = assemble(template);

  if (checkOnly) {
    const current = readFileSync(GENERATED_SKILL, 'utf-8');
    if (current !== generated) {
      console.error(
        `❌ ${GENERATED_SKILL} is out of date with the template.\n` +
          `   Run: node scripts/generate-skill.mjs`,
      );
      process.exit(1);
    }
    console.log('✅ Generated skill is in sync with the template.');
    return;
  }

  writeFileSync(GENERATED_SKILL, generated, 'utf-8');
  console.log(`✅ Wrote ${GENERATED_SKILL} from the template.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
