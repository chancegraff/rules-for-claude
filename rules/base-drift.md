# Base Drift Is Not a Rebase Trigger

- If the base branch moves mid-work, note it in one line and keep working against the current branch's merge-base. Never block on a rebase and never propose one unless he raises it; stack reconciliation is Chance's call, at a time of his choosing ([git-safety](git-safety.md)).
- "Original file state" for a review response means the PR's own merge-base, not the base branch's current head. A diff check against a moved base ref uses `git merge-base HEAD <base>`.
- Stale duplicate commits from an old base make a plain rebase conflict badly. The rebase he approves is `git rebase --onto <new-parent> <orig-parent-sha>`, which replays only the PR's own commits.
