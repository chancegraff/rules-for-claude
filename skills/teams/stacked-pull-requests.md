# Cutting, opening and landing pull requests

How a part's work is cut into pull requests, opened, reviewed and landed, serving the Pull Requests section of `~/.work/CLAUDE.md` and the `pr-review` skill at `~/.work/skills/pr-review/SKILL.md`. The rules follow the practices the lead researched on 2026-10-09 (Google's engineering practices on small changes and review speed, GitLab's and GitHub's stacked request docs, trunk-based development as DORA and practitioners describe it, and the news-fragment practice for a file every change edits); the sources stand at the end. Three of Chance's rules narrow those practices and win where they differ: the 350-line cap, stacks rare and at most three deep, and the rebase gate of `~/.work/rules/git-safety.md` that forbids a rebase onto main once a human has reviewed anywhere in the chain. GitHub's stack page: https://docs.github.com/en/pull-requests/get-started/about-stacked-prs, and its command reference: https://docs.github.com/en/pull-requests/reference/stacked-prs-cli-commands. `gh stack` is installed (version 0.1.0).

## Cut

1. Before a part builds, the plan draws its pieces as a graph of real dependencies: a piece depends on another only where its code needs code the other adds and main does not yet hold. Shared helpers two pieces would both need land first, as their own small piece, so the pieces after it depend on main alone.
2. A piece with no dependency branches from main. Pieces that depend on nothing open beside each other and land in any order. The default shape is independent pieces from main: a foundation piece merges first, and its dependents are built on branches cut from its head and opened against main once it lands, after a rebase onto main he approves. A stack is rare (Chance, 2026-10-01: "Stacked PRs are basically banned except in very rare circumstances and even then only 3 PRs are allowed in a stack"): drawn only along a real dependency to an open piece, only as deep as that dependency goes, never more than three pull requests deep, and never proposed as an option or an alternative in a plan; a chain of independent pieces is never stacked.
3. A file every piece would edit, such as the contract's current version line and its version note, is never the reason pieces chain. Each piece writes its own lines; the line every piece shares is set by the landing seat at each landing, in landing order, so a clash is one line at landing and never a fix carried through every piece above.
4. Each piece is one thing, sized by the size rule, and leaves main working when it lands alone.

## Build, review and land as you go

1. A piece is reviewed the moment it opens, and lands the moment its review's fixes pass and the lead's whole read clears it. A part is never built whole before its first review.
2. The next piece builds while the earlier one is in review: on main where it is independent, on the earlier piece only where it depends on it.
3. Open pull requests stay few: each lands before more open, so no more stand open than one review round reads whole. An independent piece that waits on a dependent one's review is no reason to hold it.
4. A fix lands on the piece it belongs to, as a new commit on top, before anything new is built on that piece. Independent pieces are fixed in parallel, one seat each, each in its own worktree. A dependent piece takes its base's fix by one restack (`gh stack rebase`, a rebase he approves) only while no reviewer other than Codex has reviewed anywhere in the chain. Once a human has reviewed anywhere in the chain, the rebase gate of `~/.work/rules/git-safety.md` closes: no branch of the chain is rebased onto main, whatever the base has done, and the pieces above take the fix when the stack merges.

## Open and link

1. Open each independent piece with `gh pr create`, its base main.
2. A stack goes through `gh stack`, never a hand-rolled chain of `gh pr create --base <parent>` (Chance, 2026-08-19, hard rule): from scratch, `gh stack init`, `gh stack add` per layer and `gh stack submit`; pieces already opened by hand are linked, bottom first, with `gh stack link --base main <numbers in order>`. Plans and briefs that involve a stack name the `gh stack` commands, never raw git or gh equivalents.
3. Each pull request passes its own checks alone and carries the contract lines of the modules it changes; a bug one creates is fixed on its own branch (Chance, 2026-10-09 19:43 UTC).

## Merge

1. A piece based on main merges with `gh pr merge <n> --squash`. In a stack, merge from the bottom up with `gh stack merge <n> --squash --yes`, which merges every pull request from the bottom up to `<n>`, all or none. While no human has reviewed anywhere in the chain, `<n>` is the lowest open pull request, so one piece lands at a time. Once a human has reviewed anywhere in the chain, the stack waits until every piece is approved and merges in one command with `<n>` the top, since the rebases GitHub runs between the merges rewrite the branches above and the rebase gate allows none before the reviews are done.
2. Never `gh pr merge` on a stacked pull request: GitHub's plain merge endpoint does not take one.
3. Before each merge, read `gh pr view <n> --json mergeable`. On `UNKNOWN`, read it once more.
4. After each merge, GitHub rebases the branches above onto main itself. A piece based on main that now clashes on the shared line takes that one line from main and is checked again.

## After

`gh stack merge` deletes no branch. Once the whole stack has landed, delete each merged branch with `git push origin --delete <branch>`, never sooner, since a pull request above takes it as its base.

## A base branch deleted too soon

GitHub closes a pull request whose base branch is deleted. To bring it back:

1. Push that branch's old head again under the same name.
2. `gh pr reopen <n>`.
3. Set its base to main.

## Sources

- Google, Small CLs: https://google.github.io/eng-practices/review/developer/small-cls.html
- Google, Speed of code reviews: https://google.github.io/eng-practices/review/reviewer/speed.html
- GitLab, Stacked merge requests: https://docs.gitlab.com/user/project/merge_requests/reviews/stacked_merge_requests/
- DORA, Trunk-based development: https://dora.dev/capabilities/trunk-based-development/
- Graphite, Stacked diffs: https://graphite.dev/guides/stacked-diffs
- towncrier, news fragments: https://towncrier.readthedocs.io/
