# Worktree Setup for Teammates

An agent's shell and git run in the working directory pinned at spawn; `cd` and `git -C` are denied, and absolute-path file tools do not extend to git or yarn. A brief that names a path the agent's session is not pinned to produces the "interrupted" idle spiral, so every brief names the assigned worktree and the EnterWorktree-first step.

## One shell per session

Observed 2026-10-01 (USP-835/987): every in-process teammate and the lead share ONE shell working directory. A teammate's `EnterWorktree` moves that shared directory for everyone, so a second teammate's pnpm and git commands then run in the first teammate's tree. Read, Edit and Write take absolute paths, but Edit refuses files outside the current worktree. Consequences:

- Worktree-bound streams in one session run one at a time: one teammate holds the shell, and the next starts when the first has reported. Read-only reviews run beside it, with no Bash and no EnterWorktree.
- Every brief says: before every pnpm or git command, run `git rev-parse --show-toplevel` in its own Bash call, and stop and report on a mismatch.
- A teammate that keeps switching after a `shutdown_request` is stopped with `TaskStop` by name.
- The lead runs `pwd` before any cwd-dependent command of its own and mutates nothing while the shell sits in a teammate's worktree.

## Two provisioning paths, no others

1. New-branch work: spawn the teammate with `isolation: "worktree"`; the harness creates the worktree under `.claude/worktrees/` and pins the agent inside it. It branches from main and is deleted when the agent stops.
2. Specific existing branch: `git worktree add <main-checkout>/.claude/worktrees/<name> <branch>` with the ABSOLUTE path under the MAIN checkout (for frontend-code: `/Users/cgraff/dev/frontend-code/.claude/worktrees/<name>`); the command works from any worktree of the repo, so a lead pinned in a linked worktree passes the absolute path. The teammate's first action is `EnterWorktree` with `path` set to that directory, and this rule is the standing instruction that authorizes the call. `EnterWorktree` accepts only `<main-checkout>/.claude/worktrees/` once the session sits in any worktree; `.work/worktrees/` was accepted for the very first entry from the launch directory and refused for every later one (2026-10-01), so it is never used. `git worktree move <old> <new>` relocates a clean worktree with its installed dependencies. After a further switch, an agent's earlier worktrees are read-only to it.

Pre-flight before any spawn: each assigned worktree has the right branch checked out, and the agent that works it runs the project's install command in that worktree before it starts. One teammate per worktree, and in one session one worktree-bound teammate at a time. The lead neither mutates a teammate's worktree nor pins any agent into one the lead is mutating. A blocker that surfaces anyway goes to a fresh agent, per [teammate-blockers](teammate-blockers.md). Machine tools (LSP servers, MCP config, missing binaries) are [inline-setup](inline-setup.md)'s subject, not this rule's.
