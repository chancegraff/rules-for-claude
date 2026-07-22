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

## hooks/

Claude Code hook scripts, registered in `settings.json` (not included here), that run before or after tool calls. The rules ask the model to behave; these make the load-bearing ones mechanical. Most enforce LSP-first code navigation, the rest block specific harmful command shapes.

The LSP-first chain:

- [lsp-first-guard.js](hooks/lsp-first-guard.js): blocks the Grep tool on code symbols and suggests the LSP equivalent.
- [bash-grep-block.js](hooks/bash-grep-block.js): the same block for `grep`/`rg`/`ag`/`ack` inside shell commands; `git grep`, non-code paths, and non-code file types pass.
- [lsp-first-glob-guard.js](hooks/lsp-first-glob-guard.js): blocks Glob patterns that hunt code symbols by filename (`*UserService*`); extension and concept globs pass.
- [lsp-first-read-guard.js](hooks/lsp-first-read-guard.js): gates Read on code files behind an LSP warmup call and navigation quotas, so code exploration goes through the language server instead of raw file dumps.
- [lsp-usage-tracker.js](hooks/lsp-usage-tracker.js): counts successful LSP calls into session state the read guard consults.
- [lsp-session-reset.js](hooks/lsp-session-reset.js): wipes that state at session start so a new session can't inherit a bypass from the previous one.
- [lsp-pre-delegation.js](hooks/lsp-pre-delegation.js): injects LSP-first context into the briefs of code-exploration subagents; agent types that don't navigate code are exempt.
- [lib/detect-lsp-provider.js](hooks/lib/detect-lsp-provider.js): shared helper that detects the active LSP MCP server (cclsp, Serena) and builds the block messages the guards emit.

Standalone guards:

- [deny-rule-redirect.js](hooks/deny-rule-redirect.js): when a Bash command matches a `settings.json` deny rule, names the exact rule that fired and the tool to use instead, so the agent self-corrects rather than guessing.
- [git-no-verify-block.js](hooks/git-no-verify-block.js): blocks every known form of git hook bypass on commit and push (`--no-verify`, `-n`, `core.hooksPath` overrides via flag or environment).
- [yarn-test-root-block.js](hooks/yarn-test-root-block.js): blocks `yarn test` from a monorepo root, where it would run every package's suite; subpackage runs pass.
