# rules-for-claude

My global Claude Code setup, mirrored from `~/.claude`: the rules, the hook scripts that enforce them, and the global `CLAUDE.md`.

## CLAUDE.md

The global instruction file, loaded at the start of every session before any project context. Three parts: hard coding standards (no type casts, no `any`, no `unknown`, no "pre-existing issue" excuses), a prose style guide that bans recognizable LLM writing patterns (performative contrasts, dramatic fragments, empty intensifiers, filler vocabulary, dashes as clause separators), and context-efficiency rules for file reading, subagent delegation, and response length.

## rules/

One standing instruction per file, loaded into every session alongside `CLAUDE.md`. They cover coding standards, git safety, planning and approval gates, agent delegation and team mechanics, prose style, and review discipline. To use one, copy it into your own `~/.claude/rules/`.

### Where to start

These rules are broadly applicable regardless of setup or stack. The rest of the collection is more tied to my own tooling and workflows.

- [take-ownership](rules/take-ownership.md): exhaust the sources you can reach before asking; verify reviewer and AI findings against the code before acting.
- [verify-before-reporting](rules/verify-before-reporting.md): re-read the artifact before declaring done; every claim needs a source that exists.
- [read-whole-files](rules/read-whole-files.md): read load-bearing documents end to end, not sliced or sampled.
- [plan-from-current-tree](rules/plan-from-current-tree.md): treat the current tree as the intended state; git history is context, not something to resurrect.
- [implement-before-delete](rules/implement-before-delete.md): build and verify the replacement before deleting what it supersedes.
- [dead-code-closure](rules/dead-code-closure.md): deleting a file deletes everything whose last consumer just disappeared.
- [generated-files](rules/generated-files.md): never hand-edit generated files; fix the source and regenerate.
- [secrets](rules/secrets.md): never read tokens or credentials into the conversation, including "checking whether a token exists".
- [fix-known-issues](rules/fix-known-issues.md): a defect flagged in code the current work touches gets fixed in the same round.
- [no-easy-options](rules/no-easy-options.md): recommend the option whose shape is right for the problem, not the cheapest one.
- [preserve-user-design](rules/preserve-user-design.md): implement the stated design literally; when it hits a wall, present the wall instead of substituting a different design.
- [no-invented-scaffolding](rules/no-invented-scaffolding.md): don't introduce primitives that were never agreed to; ask instead of inventing.
- [engage-framing-first](rules/engage-framing-first.md): engage the named approach on its own terms before offering alternatives.
- [terse-replies](rules/terse-replies.md): lead with the answer; save detail for when it's asked for.
- [sweep-verification](rules/sweep-verification.md): a corrections sweep gets a verification round before it is called complete.
- [no-self-citation](rules/no-self-citation.md): an AI-authored reply is not a settled decision; trace decisions to a human.

## skills/

User-invocable workflow skills (`/skill-name` in a session). Each directory holds a `SKILL.md` that loads as the operating procedure for that workflow, plus any reference docs it needs:

- [jira-ticket-workflow](skills/jira-ticket-workflow/SKILL.md): runs a Jira ticket end to end as a team lead: plan the work, delegate implementation to specialist agents, facilitate cross-review, ship the PR.
- [work-the-branch](skills/work-the-branch/SKILL.md): takes in-progress branch work at any stage, assesses where it stands, and advances it to review-ready.
- [pr-review-response](skills/pr-review-response/SKILL.md): reads every review thread on the current PR, evaluates the feedback critically, implements fixes via agents, and replies to each thread.
- [team-dev-workflow](skills/team-dev-workflow/SKILL.md): the general-purpose team workflow for any code change, scaled from bug fix to feature.
- [epic-orchestrator](skills/epic-orchestrator/SKILL.md): dispatches parallel headless Claude Code workers, one per ticket of a Jira Epic, each in an isolated worktree, coordinating through append-only status files.
- [session-debrief](skills/session-debrief/SKILL.md): an end-of-session candor ritual: what the session is least confident about, and what the user probably doesn't realize.

## hooks/

Claude Code hook scripts that run before tool calls. The rules ask the model to behave; these make the load-bearing ones mechanical.

- [deny-rule-redirect.js](hooks/deny-rule-redirect.js): when a Bash command matches a `settings.json` deny rule, names the exact rule that fired and the tool to use instead, so the agent self-corrects rather than guessing.
- [git-no-verify-block.js](hooks/git-no-verify-block.js): blocks every known form of git hook bypass on commit and push (`--no-verify`, `-n`, `core.hooksPath` overrides via flag or environment).
- [yarn-test-root-block.js](hooks/yarn-test-root-block.js): blocks `yarn test` from a monorepo root, where it would run every package's suite; subpackage runs pass.

They register in `~/.claude/settings.json` as PreToolUse hooks on Bash:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "node ~/.claude/hooks/deny-rule-redirect.js" },
          { "type": "command", "command": "node ~/.claude/hooks/yarn-test-root-block.js" },
          { "type": "command", "command": "node ~/.claude/hooks/git-no-verify-block.js" }
        ]
      }
    ]
  }
}
```

### LSP-first enforcement

My setup also enforces LSP-first code navigation (the [grep-banned](rules/grep-banned.md) rule): Grep, symbol-hunting Glob patterns, and shell grep on code symbols are blocked, and Reads of code files are gated behind language-server warmup. The hooks that do this come from [claude-code-lsp-enforcement-kit](https://github.com/nesaminua/claude-code-lsp-enforcement-kit) (MIT) and aren't mirrored here; its installer copies the scripts into `~/.claude/hooks/` and merges their `settings.json` registration.
