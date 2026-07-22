# rules-for-claude

Global rules for Claude Code. Each file in `rules/` is a standing instruction that Claude Code loads into every session from `~/.claude/rules/`. They cover coding standards, git safety, planning and approval gates, agent delegation and team mechanics, prose style, and review discipline.

To use one, copy it into your own `~/.claude/rules/`.

## Where to start

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
