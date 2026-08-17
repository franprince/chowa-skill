# chowa-skill

Spec → plan → execute pipeline, atomic Conventional Commits, PR generation, branching discipline, and mechanical sub-task delegation — using only this harness's own native tools (`Read`/`Edit`/`Write`/`Bash`/`Agent`) plus `git`/`gh`. No CLI, no bundled engine, nothing to install or version beyond this plugin's own files.

A lean sibling of [chowa](https://github.com/franprince/chowa) (the CLI-backed original). This variant intentionally leaves out model routing against live provider data and quota-aware session auto-resume — both need more than a skill can do on its own. See the skill itself ([`skills/chowa-skill/SKILL.md`](skills/chowa-skill/SKILL.md)) for exactly what's in and out of scope.

## Install

Directly:

```
/plugin marketplace add franprince/chowa-skill
/plugin install chowa-skill@chowa-skill
```

Or via [franprince/skills-marketplace](https://github.com/franprince/skills-marketplace), a personal catalog that lists this alongside other plugins:

```
/plugin marketplace add franprince/skills-marketplace
/plugin install chowa-skill@skills-marketplace
```

Both install the same thing — this repo is the actual source either way; the marketplace just references it.

## What's here

- `skills/chowa-skill/SKILL.md` — the workflow itself, generated (see below)
- `agents/chowa-skill-mechanical.md` — subagent for delegated mechanical work (`model: haiku`, `Read`/`Edit`/`Bash` only)
- `scripts/guard.mjs` — pre-tool-use dispatcher running both guards in one process:
  - `guard-push.mjs` — asks before a push whose destination is `main`/`master` (the `release/*` → `main` flow is untouched)
  - `guard-spec.mjs` — denies root-level `spec.md`/`implementation_plan.md`/`tasks.md`, in projects that opted into the convention
- `hooks/hooks.json`, `hooks/gemini-settings.json`, `hooks/codex-hooks.json` — the same guards wired up for each harness

## Hooks work on Claude Code, Gemini CLI, and Codex

The three harnesses disagree on the event name (`PreToolUse` vs
`BeforeTool`), the tool names (`Bash` vs `run_shell_command`; `Write`/`Edit`
vs `write_file`/`replace`; Codex edits through `apply_patch`), and the shape
of a denial. The guards decide once against a normalized request, and the
verdict is rendered in whichever dialect asked.

```
node scripts/install-hooks.mjs --harness gemini      # → ~/.gemini/settings.json
node scripts/install-hooks.mjs --harness codex       # → ~/.codex/hooks.json
node scripts/install-hooks.mjs --all --dry-run       # preview, write nothing
```

Add `--scope project` to write `.gemini/settings.json` / `.codex/hooks.json`
in the current repository instead of the home directory. The merge is
idempotent and leaves any hooks you already had in place. Claude Code needs
no install step when this repo is installed as a plugin — it discovers
`hooks/hooks.json` itself.

A harness that speaks none of these dialects still gets blocked: all three
treat exit code 2 with a reason on `stderr` as a rejection, so the fallback
degrades to a coarser message rather than a silent allow. Set
`CHOWA_GUARDS=off` to disable the guards entirely.

## `templates/chowa-workflow.md` is the source of truth

`skills/chowa-skill/SKILL.md` is generated from `templates/chowa-workflow.md`
via `node scripts/generate-skill.mjs` (`--check` verifies it's in sync; CI
enforces this on every PR). The template also feeds
[chowa](https://github.com/franprince/chowa)'s own canonical and portable
skill files, fetched at a pinned commit SHA — a change here that changes
what the template says is a breaking change for chowa's next sync, not
just this repo. Edit the template, not the generated file, and run the
generator before committing.

## License

MIT
