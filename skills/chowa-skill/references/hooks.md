# Hook setup and troubleshooting

The bundled dispatcher `scripts/guard.mjs` runs push/merge and spec-location
checks before tool execution. Push/merge protection applies in every project
and asks for approval of recognized protected-branch pushes, deletes, and
merges, or denies where the host cannot ask. Spec-location protection applies
only with persistent opt-in, and leaves a root-level spec file alone when git
already tracks it. Guards do not infer conversational approval.

| Harness | Project config | Event | Matched tools | Can ask |
|---|---|---|---|---|
| Claude Code | `.claude/settings.json` or plugin hooks | `PreToolUse` | `Bash`, `PowerShell`, `Write`, `Edit`, `NotebookEdit` | yes |
| Gemini CLI | `.gemini/settings.json` | `BeforeTool` | `run_shell_command`, `write_file`, `replace` | no |
| Codex | `.codex/hooks.json` | `PreToolUse` | `Bash`, `apply_patch` | no |
| Antigravity | `.agents/hooks.json` | `PreToolUse` | `run_command`, `write_to_file`, `replace_file_content` | yes |

Confirm hook support during installation rather than assuming every host with
a shell tool uses these event contracts. Substitute the absolute skill
directory below and run from the target project for project-scope installs:

```bash
node /absolute/skill-root/scripts/install-hooks.mjs --harness codex --scope project --dry-run
node /absolute/skill-root/scripts/install-hooks.mjs --harness codex --scope project
```

Choose `claude`, `gemini`, `codex`, or `antigravity`. Omit `--scope project`
for user configuration. The installer merges owned entries without replacing
unrelated hooks. Claude Code plugin installation discovers `hooks/hooks.json`
directly; standalone skill installations need this explicit setup.

For Codex, review and trust the installed commands with `/hooks`; changed hook
commands are skipped until trusted, and project configuration also requires
project trust. User installs respect `CODEX_HOME`. Gemini disables project
hooks and workspace skill discovery in untrusted folders. Reload or restart
the host when required, then confirm the hooks appear in its hook viewer.

Adapter contracts: [Claude Code](https://code.claude.com/docs/en/hooks),
[Codex](https://learn.chatgpt.com/docs/hooks), and
[Gemini CLI](https://geminicli.com/docs/hooks/reference/). Hooks are workflow
checks, not a shell sandbox. Blocked actions use the host's rejection schema;
unknown dialects get exit code 2 with a reason on stderr. Guards defer to
normal host permissions on malformed or unrecognized payloads; Antigravity's
no-opinion response is `{}`.

Guards judge each command where it runs: along one command line they follow
`cd` and `git checkout`/`switch`, and they skip heredoc bodies unless a shell
reads them. A `cd` or switch counts for the next command only as far as the
joining operator shows it took effect: fully after `&&`, never on the right of
`||`, and a `cd` never across `|` or `&`. A switch that is not followed by `&&`
can add protection but not remove it. `git` or `gh` after a program the guard
does not know is treated as being run. They do not resolve variables, command
substitution, or `eval`.
Where a directory or branch cannot be determined, the spec guard defers and
the push guard assumes the session's starting branch.

`CHOWA_GUARDS=off` disables both guards (`0` and `false` also work). Use this
only for an explicitly authorized configuration change, such as an unattended
workflow setup, not to work around a rejected tool call.
