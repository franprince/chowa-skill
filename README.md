# Chōwa Skill

A spec → plan → execute skill for **Claude Code, Codex, and Gemini CLI**.
It keeps specifications and tasks in the repository, guides atomic Conventional
Commits and pull requests, and uses the host's native tools for execution and
optional delegation.

## Install the skill

Copy the complete [`skills/chowa-skill/`](skills/chowa-skill/) directory into
one of your host's skill locations. Keep its `references/`, `scripts/`, and
`hooks/` subdirectories together; the skill has no dependency on the checkout
that supplied it. Restart the host or reload skills after installation.

| Host | This project | All your projects |
|---|---|---|
| Claude Code | `.claude/skills/chowa-skill/` | `~/.claude/skills/chowa-skill/` |
| Codex | `.agents/skills/chowa-skill/` | `~/.agents/skills/chowa-skill/` |
| Gemini CLI | `.gemini/skills/chowa-skill/` | `~/.gemini/skills/chowa-skill/` |

For Gemini, you can also use its native installer:

```bash
gemini skills install https://github.com/franprince/chowa-skill --path skills/chowa-skill --scope user
```

Invoke the skill by name using the host's skill picker or ask it to use Chōwa
Skill. Gemini asks for consent when activating a skill. Workspace skills and hooks
require a trusted project; an untrusted project can show no skills even after
a successful install. Installation and activation follow each host's permissions.
See the native [Claude Code](https://code.claude.com/docs/en/skills),
[Codex](https://learn.chatgpt.com/docs/build-skills), and
[Gemini CLI](https://geminicli.com/docs/cli/skills/) skill documentation.

### Optional Claude Code plugin

The plugin adds automatic hook discovery and a Claude mechanical subagent:

```text
/plugin marketplace add franprince/chowa-skill
/plugin install chowa-skill@chowa-skill
```

Install through either the plugin or the standalone skill path to avoid
duplicate discovery. The standalone skill uses available native delegation or
executes inline when subagents are unavailable. It does not require a specific
agent name, model, task tracker, or question tool on other hosts.

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

## Optional spec roast

After drafting a feature spec, the skill offers once before planning:

> Want a spec roast before planning? I’ll challenge the assumptions, edge
> cases, and acceptance criteria. You can skip it or stop at any time.

Accept to get focused rounds of one to three questions, with recommendations
and tradeoffs. The agent researches available facts and writes your decisions
into the spec. A short pass defaults to at most three rounds, followed by a
summary for confirmation. Further rounds require your choice.

Ask directly to “roast this spec” to opt in immediately. Decline to continue
with normal clarification, or stop the interview whenever you want. An
unanswered offer waits for your choice. The spec records progress so resuming
work preserves your answers and does not repeat an accepted or declined offer.
Existing approved plans and standalone commit/PR requests skip the offer.

## Why one skill with procedure files?

The entrypoint owns activation, authorization, and routing. Substantive
instructions load from local references only at the relevant stage:

| Procedure | Loaded when |
|---|---|
| Pipeline | Drafting specs, planning, or implementing authorized work |
| Spec refinement | A spec roast is accepted or explicitly requested |
| Delivery | Branch setup, commits, PR creation, or readiness review |
| Delegation | Considering or requesting bounded mechanical delegation |
| Hooks, visual proof, roadmap, language style | Their documented trigger applies |

This keeps one self-contained installation across all three hosts. Separate
skills are useful when a capability needs independent discovery and reuse
outside this workflow. They are not required to defer loading a procedure, and
would add installation dependencies and potentially overlapping triggers.
Modularity reduces initial context; it does not guarantee that previously read
instructions leave the conversation context.

## Optional hooks and helpers

The workflow uses native file and shell tools plus `git` and, for GitHub PRs,
`gh`. Bundled helper scripts require **Node.js 22 or newer** on PATH. The
Storybook collector additionally uses the target project's existing Storybook
and Playwright setup, only when explicitly requested.

Standalone skill discovery does not activate hooks. From the target project,
use the absolute path to your installed skill directory:

```bash
node /absolute/skill-root/scripts/install-hooks.mjs --harness codex --scope project --dry-run
node /absolute/skill-root/scripts/install-hooks.mjs --harness codex --scope project
```

Choose `claude`, `codex`, or `gemini`; an existing Antigravity adapter is also
included. Omit `--scope project` for user configuration. Installation preserves
unrelated hook entries. Codex user installs respect `CODEX_HOME`; review and
trust installed or changed commands with `/hooks`, and trust the project for
project configuration. Reload or restart the host as required by its settings.

Claude Code plugin installation discovers its hooks automatically. Do not also
install the standalone hook adapter for the same scope.

Push/merge protection applies in every project; spec-location protection
requires persistent opt-in. Claude can request approval; Codex and Gemini deny
recognized blocked actions. Hooks check supported command and path shapes;
unsupported shell constructs or malformed input can defer to normal host
permissions. See [Hook setup](skills/chowa-skill/references/hooks.md) for
contracts and troubleshooting.

## Authoring and generation

`templates/chowa-workflow.md` is the source of truth for workflow prose.
`scripts/generate-skill.mjs` owns frontmatter and generation logic. Root-level
`scripts/` and `hooks/` are canonical runtime sources. Edit those sources, then:

```bash
node scripts/generate-skill.mjs
node --test tests/*.test.mjs
node scripts/generate-skill.mjs --check
```

The generator extracts named `reference:<name>` blocks into `references/`,
numbers the main workflow headings, and copies runtime resources into the
skill directory. Reference names must be safe basenames; blocks must end with
`reference:end` and cannot nest. `--check` verifies every generated artifact,
including missing files. Do not edit generated files directly.

The core has a 7,000-character budget; optional procedures load only when
needed. Tests exercise documented host payloads, hook installation, and helpers
from an isolated copy of the skill. Version metadata in
`.claude-plugin/plugin.json` is updated by the release workflow on merge.

## License

MIT
