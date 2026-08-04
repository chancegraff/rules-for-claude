# Git Safety

Destructive git commands (stash/checkout/restore/reset/clean/revert/merge/mv) are deny-listed; do not attempt them. `git stash` is destructive and unwanted, never. `git reset` is denied in ALL forms (even `--soft`). `git rebase` prompts for approval. If history surgery is needed, state the exact commands and let the user run them.

Plain `git switch <branch>` is allowed; `git -C` is deny-listed in settings, so run plain git from the working directory; `git checkout` is off-limits; `git branch <name>` is fine.

Never amend commits; fixes and consolidation are new commits on top (or via `git rebase` where approved). Never prefix git commands with `GIT_EDITOR=true` or other editor-override env vars; run `git rebase --continue`, `git commit`, etc. plainly. The user's git config handles the editor and reuses messages: after conflict resolution, bare `git rebase --continue` reuses the original commit message without an interactive editor. Force-push needs explicit user authorization.
