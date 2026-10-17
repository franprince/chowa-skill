# Host capabilities

Procedures in this skill name a capability, never a host's tool. Map each one
to the current host's tool when it has one; otherwise use the fallback. Never
stop because a named tool is absent, and never assume one host has a tool
because another does.

| Capability | Use it to | Fallback |
|---|---|---|
| `ask_user` | Offer a discrete choice or request an approval | Ask in conversation with numbered options, then wait for the answer |
| `track_tasks` | Show in-session progress on `tasks.md` items | Keep `tasks.md` current; it stays the durable record either way |
| `delegate` | Hand a qualifying mechanical task to a subagent | Do the work inline |
| `run_shell` | Run `git`, `gh`, bundled helpers, and quality gates | Ask the user to run the command and share its output |
| `edit_files` | Create and change files | Give the user the exact change to apply |

## Known mappings

| Capability | Claude Code | Codex | Gemini CLI | Antigravity |
|---|---|---|---|---|
| `ask_user` | `AskUserQuestion` | — | — | — |
| `track_tasks` | `TaskCreate` (older: `TodoWrite`) | `update_plan`, when enabled | `write_todos` | — |
| `delegate` | `Agent` | — | — | — |
| `run_shell` | `Bash` | — | `run_shell_command` | `run_command` |
| `edit_files` | `Write`, `Edit` | `apply_patch` | `write_file`, `replace` | `write_to_file`, `replace_file_content` |

A dash means no mapping is recorded here, not that the host lacks the
capability. On any host, and for any host not listed, match tools by what
they do rather than by name.
