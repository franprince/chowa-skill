# chowa-skill

Spec → plan → execute, atomic Conventional Commits, pull request preparation,
and mechanical delegation using the host's native tools plus `git`/`gh`.
No Chōwa CLI or bundled engine is required. The plugin includes a workflow
skill, optional helper scripts, and a Claude Code mechanical subagent.

This is a sibling of [chowa](https://github.com/franprince/chowa), which
provides live model routing and session auto-resume. This skill uses the
host's available capabilities with inline fallbacks for optional task and
subagent tools.

## Install

Install the plugin directly:

```text
/plugin marketplace add franprince/chowa-skill
/plugin install chowa-skill@chowa-skill
```

Or use the personal marketplace, which points to the same repository:

```text
/plugin marketplace add franprince/skills-marketplace
/plugin install chowa-skill@skills-marketplace
```

When copying the skill to another host, include the complete
`skills/chowa-skill/` directory, including `references/`. Helper scripts live
at the plugin root; copying only the skill does not install those scripts or
hook adapters. Keep the plugin checkout available for helper operations.

## Workflow activation

The workflow applies when the project contains `specs/INDEX.md` or
`chowa.config.js`, `chowa.config.ts`, or `chowa.config.mjs`; when personal
`~/.chowa-skill/preferences.json` contains `"alwaysOn": true`; or when the
user explicitly requests it. Conversation-only activation becomes visible
to the stateless spec-location hook once the pipeline creates the index.
Unrelated projects retain their own conventions.

The agent reads preferences when the skill is first loaded in a session.
`alwaysOn` does not itself install a session-start hook. The optional `ste100`
style preference applies to conversation prose; an explicit project boolean
in `chowa.config.js` overrides the personal value. Preference updates preserve
other settings.

Requests enter at the relevant workflow stage. A request to plan and implement
supplies authorization for that scope; an existing PR-creation request does
not require another approval question. Visual proof is experimental and
requires an explicit user request or a standing project instruction.

## Package contents

- `skills/chowa-skill/SKILL.md`: generated core workflow and conditional links.
- `skills/chowa-skill/references/*.md`: generated hook setup, visual proof and
  Storybook collection, roadmap, and simplified-English procedures.
- `agents/chowa-skill-mechanical.md`: Claude Code mechanical subagent;
  summaries guide inspection while the primary agent reviews and verifies.
- `scripts/guard.mjs`: dispatcher for protected-branch push/delete and merge
  protection, plus opt-in spec-location protection.
- `scripts/install-hooks.mjs`: merges the shipped adapters into host settings.
- `scripts/storybook-proof.mjs`: explicitly requested before/after capture
  using the target project's existing Storybook and Playwright setup.
- `hooks/*.json`: adapter definitions for Claude Code, Gemini CLI, Codex,
  and Antigravity.

## Hook setup

Claude Code plugin installation discovers `hooks/hooks.json` automatically.
For other hosts, invoke the installer from the target project, using the
absolute path to this plugin checkout:

```bash
node /absolute/plugin-root/scripts/install-hooks.mjs --harness gemini --scope project --dry-run
node /absolute/plugin-root/scripts/install-hooks.mjs --harness gemini --scope project
```

Choose `claude`, `gemini`, `codex`, or `antigravity`. Omit `--scope project`
for user configuration. Installation preserves unrelated hook entries.

Push/merge protection applies in every project and uses repository-neutral
feedback. Spec-location protection requires a persistent opt-in signal.
Claude Code and Antigravity adapters request approval; the other shipped
adapters deny. Unknown or malformed input can defer to normal host permissions;
these adapters are not a guarantee about every host's current tool payloads.
See [Hook setup](skills/chowa-skill/references/hooks.md) for contracts and
troubleshooting.

## Authoring and generation

`templates/chowa-workflow.md` is the source of truth for workflow prose.
`scripts/generate-skill.mjs` owns frontmatter metadata and generation logic.
Edit these sources, then run:

```bash
node scripts/generate-skill.mjs
node --test
node scripts/generate-skill.mjs --check
```

The generator selects `shared` and `chowa-skill-only` variant blocks, extracts
named `reference:<name>` blocks into `references/<name>.md`, and numbers the
remaining workflow headings. Reference names are safe file basenames, each
block has a matching `reference:end`, and blocks do not nest. Keep each
reference inside a shared variant; put links to generated references in
skill-only variants. `--check` verifies the entrypoint and all generated
references, including missing files. Do not edit generated files directly.

The sibling [chowa](https://github.com/franprince/chowa) fetches the shared
template at a pinned commit and selects `shared` and `chowa-only` blocks.
Reference markers are Markdown comments, so its existing renderer retains
those procedures inline and needs no separately distributed reference files.
Review shared changes for both variants before advancing that pin.

## License

MIT
