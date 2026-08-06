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

- `skills/chowa-skill/SKILL.md` — the workflow itself
- `agents/chowa-skill-mechanical.md` — subagent for delegated mechanical work (`model: haiku`, `Read`/`Edit`/`Bash` only)
- `hooks/hooks.json` + `scripts/guard-push.mjs` — push-protection hook, blocks direct pushes to `main`/`master`

## License

MIT
