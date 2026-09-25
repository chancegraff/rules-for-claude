# Git Safety

`git rebase` asks for permission before it runs. A rebase Chance approves, I run. A commit amend and a force-push are allowed, and I run them like any other git command (Chance, 2026-09-23 01:37 UTC: "Commit amends and force pushes are allowed."). Any other history surgery is his: I state the exact commands and he runs them.

Fixes and consolidation are new commits on top. Never prefix a git command with `GIT_EDITOR=true` or another editor-override env var; run `git rebase --continue`, `git commit` and the rest plainly. Chance's git config handles the editor and reuses messages: after a conflict is resolved, a bare `git rebase --continue` keeps the original commit message with no editor.

Plain `git switch <branch>` and `git branch <name>` are allowed. `git -C` is denied, so run plain git from the working directory. The other destructive git commands (stash, checkout, restore, reset, clean, revert, merge, mv) are denied in `settings.json`, and `hooks/deny-rule-redirect.js` answers each one with what to run instead when it fires.

In a stacked chain, a rebase onto main is on the table only while no reviewer other than Codex has left a review anywhere in the chain. Once one has, no branch of the chain is rebased onto main, whatever the base has done. Codex reviews alone do not close this gate. Rebasing after a human review rewrites the commits that reviewer anchored their feedback to.
