# Sweep Methodology

- A finding list is a starting seed, never the boundary of scope; never declare a sweep "comprehensive" from finding-list coverage.
- Doc-set-wide or codebase-wide audits walk everything sequentially with a fixed checklist of the discipline targets. When dispatching a verification round on a set-wide concern, brief the agents on the discipline targets, not on a finding list.
- Everything you find is your responsibility. Once a violation surfaces, it is in scope regardless of whether the current pass introduced it; drawing the line at "I didn't introduce that" is the failure mode that lets pre-existing drift accumulate forever.
- Accumulated discipline drift deserves its own dedicated pass; it never gets cleaned up incidentally during a corrections cycle on a different topic. A dedicated pass means: clear scope (the discipline targets), a sequential walk through every doc with a fixed checklist, strip-and-reframe per doc as you go. A boundless thing is not discipline drift: it is fixed where you meet it (`everything-finite.md`).
- When a corrections cycle plateaus (consecutive rounds surface comparable-severity findings that do not overlap with prior rounds), propose a dedicated sequential-audit pass instead of another catalog-driven round.
