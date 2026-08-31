---
name: plan-drafting
description: Template and drafting rules for every implementation plan. Invoke before drafting a new plan or rewriting a major plan section.
---

# Plan Drafting

Codified 2026-08-27 from the convergence retrospective on the extraction and score-cache plans. Those plans needed dozens of review rounds. Root causes: duplicated facts, derived counts, files with edits but no owner, unverified claims, and design gaps that surfaced one per round.

## Template

Draft every plan with these sections, in this order:

1. **Context.** Why the plan exists. What it must produce.
2. **State as of \<date\>.** Every volatile world fact: tree status, caches, machine state, registry contents. Mark the date. Refresh this section when execution starts. Reviewers audit this section for freshness only.
3. **Decision register.** Every decision the plan makes, one line each: flag names, resolution orders, pass conditions, exclusions, ownership calls. Each line points to the section that carries the rationale.
4. **Design sections.** The rationale and the mechanics. Each fact is stated here once.
5. **Ownership table.** One table: file, stream, edit. Build it by enumerating every file the plan names anywhere.
6. **Wave structure.** Foundation, parallel streams, verifier (the parallelizable-plans rule). Reference the ownership table. Do not restate it.
7. **Verification.** Numbered checks. Each check names its command, its working directory, and its expected output shape.
8. **Boundaries.** What the plan does not do.

## Skeleton contract

The skeleton must stand alone. Cold workflow agents draft the detail sections from it, with no access to the conversation that produced it. A fact that lives only in that conversation is lost to them.

- Every decision-register line is applicable without conversation context. A reader holding the skeleton and nothing else can act on the line as written.
- Every input is named by its on-disk path. Naming an input by description alone is a gap.
- No load-bearing fact lives only in conversation. A fact the plan rests on sits in the skeleton text.

## Drafting rules

1. State each fact in exactly one place. Everywhere else, reference it ("per D4"). Never restate a fact with its own numbers. This binds the first draft: a restated fact is a drafting defect, not a finding for a later review round to catch.
2. Write no derived numbers and no ordinals about the plan's own content. Banned shapes: "the third X this change touches", "all six paths", "the other three fields". Write the list or the reference instead.
3. Verify every code claim while you draft it. Read the cited file at the cited lines before the sentence lands. A claim you did not verify does not go in.
4. Reference code. Do not paraphrase it at length. State the requirement and the pointer. Paraphrase only load-bearing hazards.
5. Write executable steps as literal commands, each with its working directory and expected output.
6. Keep volatile facts inside the State section. When the world changes mid-plan, sweep that one section immediately.
7. Prefer several small plans over one large plan. When a draft passes roughly 40KB, split it by decision cluster under a thin umbrella document.
8. Draft in layers. The lead authors the skeleton: Context, Decision register, Ownership table, Wave structure. Converge the skeleton. The detail sections are then expanded by the workflow `plan-draft-expansion-run`, which reads the skeleton and this skill to compute the sections left to draft.
9. Draft any multi-stage machinery as a contract table, from the first draft. One row per stage, stating what that stage reads, what it returns, and what it writes. State what a stage's failure means per row where the rows differ, and once for the whole table where every row shares it.
10. Draft any exit, halt, or recovery machinery in transition-table form, from the first draft. One row per state-and-event pair, carrying its action, its next state or relaunch round, and what the transition leaves behind: its record where the machinery writes one, and what its return carries where it does not. A missing transition must be an empty cell a reader can see.
11. Close every producer-consumer pair before the draft ships. Every returned value names its consumer. Every read names its producer.
12. Verify every general rule against the rows it governs before the draft ships. Check a sentence that states a general rule over a table's rows against every row of that table. Check an enumeration over a set the plan itself defines against every member of that set.

## Pre-review self-check

The expansion run's own agents run this checklist against the assembled draft, one agent per bullet. The drafter does not run it on their own draft before round 1.

- Ownership: every file that takes an edit appears in the ownership table.
- Counts: no derived numbers or ordinals anywhere.
- Cross-section: every roster or boundary mention agrees with its owning section, or is a bare reference.
- Executability: walk every step the plan states, in order, and report every step that cannot run as written. Never report only the first. A step runs as written when it carries its working directory and its expected output.
- Freshness: every volatile fact sits in the State section under its date.
- Cold builder: read the whole draft as the engineer who must build it, with no other context. Report everything that would stop that engineer or force a guess.
