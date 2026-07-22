# Base Drift Is Not a Rebase Trigger

- If the base branch moves mid-work, note it in one line and keep working against the current branch's merge-base; never block on or propose rebase/force-push unless the user raises it. "Original file state" for a review response means the PR's own merge-base, not the base branch's current head; diff checks against a moved base ref use `git merge-base HEAD <base>` instead of the base head. Stack reconciliation (rebases, force-pushes) is the user's call at a time of their choosing, usually after review rounds settle, and other sessions may still be pushing.
- Stale duplicate commits from an old base make plain rebase conflict badly; use `git rebase --onto <new-parent> <orig-parent-sha>` to replay only the PR's own commits.
