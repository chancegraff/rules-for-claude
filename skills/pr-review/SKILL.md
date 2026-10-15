---
name: pr-review
description: How to answer review feedback on a pull request. Load when a bot or human reviewer leaves findings, when the base branch moves under an open PR, and whenever a rebase is on the table.
---

# PR review

## Read a finding

- Treat every finding from a reviewer, a bot or an agent as a guess. Verify it against the code before you reply or act.
- "Unconfirmed" and a reasoned decline are valid outcomes. Say which one and why, with the file and line you checked.
- When a review comment or a linked doc already answers the question, that document is the decision. Do what it says instead of offering a menu.
- Before replying "keeping as-is", trace the decision to a recorded ruling. If none stands, the lead rules on its lean and records why, or fixes it.
- A suggestion of his about one thing (syntax, say) settles nothing about another (copy, naming). Do not stretch it.
- When a bot raises a "settled" point again, check the settlement again instead of repeating it.

## Fix a defect

- A defect flagged in code this PR touches is fixed in the same round. Never ship around it, and never post an accept-it position in a review thread.
- If the fix looks wrong or risky, the lead rules on its lean and records why. Never decide silently.
- A style deviation in code the PR already touches is fixed with the touch. Elsewhere it is left alone; sweeping for it is churn.
- Answer a nit with the smallest edit that removes the whole concern. Do not reorganize the file to match the reviewer's wording.

## When the base branch moves

- Where main moves under a piece based on main, note it in one line and keep working against the PR's own merge-base. Never block on a rebase, and never propose one unless he raises it. A piece based on main that now clashes on the line every piece shares takes that one line from main and is checked again. A piece in a linked stack follows the Rebase lines below: its base's fix reaches it by one restack while the rebase gate is open, and after each merge GitHub rebases it onto main itself; a piece in a stack that is not linked takes the hand rebase those lines name.
- "Original file state" means the PR's merge-base, not the base branch's current head. Compare with `git merge-base HEAD <base>`.
- A fix lands on the piece it belongs to before anything new is built on that piece, and each piece above it takes the fix by one restack (`~/.work/skills/teams/stacked-pull-requests.md`, Build 4).

## Rebase

- A rebase asks for permission before it runs. Fixes and consolidation are new commits on top; commit amends and force-pushes are allowed.
- The rebase gate (`~/.work/rules/git-safety.md`): in a stack, a rebase onto main is on the table only while no reviewer other than Codex has left a review anywhere in the chain. Once one has, no branch of the chain is rebased onto main, whatever the base has done; a rebase after a human review rewrites the commits that reviewer anchored their feedback to.
- In a linked stack with the gate open, a piece takes its base's fix by one restack, and after each merge GitHub rebases the branches above onto main itself (`~/.work/skills/teams/stacked-pull-requests.md`). With the gate closed, the pieces above take the fix when the whole stack merges once every piece is approved.
- In a stack that is not linked, stale duplicate commits from an old base make a plain rebase conflict badly. There the rebase the human approves is `git rebase --onto <new-parent> <orig-parent-sha>`, which replays only the PR's own commits.
- Never prefix a git command with an editor-override variable. After a conflict is resolved, a bare `git rebase --continue` keeps the original message.
- Never resolve a delete-side conflict, or delete a file, before its replacement exists and is verified.

## Finish every push

Every push that answers review feedback ends with these four steps, in this order, the last one never skipped:

1. Push.
2. Reply in each thread with what changed and where.
3. Patch the PR body if the change moved it.
4. Re-request review: `gh pr edit <n> --add-reviewer <login>`, unless the reviewer is the PR author. A repo's own memory records its bots' re-request mechanics.

## Description and commits

- Cite code as `path:line`. Keep code out of prose; a command or an error goes in a fenced block.
- End commit messages and PR bodies with the attribution lines the session names.
