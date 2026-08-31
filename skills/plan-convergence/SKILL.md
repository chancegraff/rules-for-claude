---
name: plan-convergence
description: Class-audit review procedure for plan convergence. Review rounds run until the surviving findings are nitpick-only, meaning wording taste, phrasing, or cosmetic rewrap, with no falsified claim, no contradiction, and no ownership or commitment change. Invoke when starting or continuing review rounds on any plan.
---

# Plan Convergence

Codified 2026-08-27. Replaces portion-split sampling rounds. Rounds catch whole defect classes, and an approval means measured completeness rather than one lucky clean sample.

The methodology below is unchanged by how it runs. Its execution is the workflow `plan-convergence-run`, which holds the round loop inside its own script. `/plan-convergence` states the methodology. `/plan-convergence-run` executes it.

The operator mechanics live in `runbook.md` beside this skill: the launch checks, the crash recovery, and the seeded-defect calibration.

## Round zero: the claim inventory

The claim inventory and the coverage ledger live in the plan's state directory, `~/.claude/plans/<project>/<plan-name>/`, where `<project>` names the project and `<plan-name>` is the plan's filename with `.md` removed. Neither lives in a scratchpad.

The inventory is a table in each round's section of `ledger.md`: one row per checkable claim, each row naming its class.

The lead writes the round-zero table before a plan's first launch. Every later round's table falls to whoever the ledger's write contract assigns it: the run's ledger-writer stage in an ordinary round, and the lead in a round run without that stage, in a recovery from a halt, and for an edit the lead records between runs.

The Class column's vocabulary is the seat names below, so each seat selects its own rows by its own name. A row whose claim states more than one kind of coverage splits into one row per kind, so every row states exactly one kind and matches exactly one selector.

Auditors check rows off. Every round reports coverage as verified rows over total rows.

## Seats

Each reviewer owns one claim CLASS across the WHOLE plan. Do not split by file position. One seat per class, each with its own checklist.

Each seat audits the whole plan every round, and reports every site that fails its checklist. Never only the first.

1. **Ownership auditor.** Enumerate every file the plan commits an edit in. Confirm the ownership table names each one. Return the full enumeration alongside the verdict.
2. **Counts auditor.** Enumerate every numeric claim and ordinal. Recompute each one. Flag every derived number for removal (drafting rule 2).
3. **Code-citation auditor.** Re-verify every code citation whose surrounding text changed since its last verification. Use the coverage ledger to skip rows that are verified and unchanged.
4. **Cross-consistency auditor.** Check every pair of sites that state related facts: design section against roster, plan against sibling plans, plan against standing board calls. Flag restatements for conversion to references.
5. **Executor.** Walk the plan's waves command by command. Track the tree state as you go. Run every machine-checkable check: file modes, symlinks, output shapes, path existence. Report every step that cannot run as written.
6. **Stage-duty auditor.** Walk every row of every stage table the plan carries. Confirm each cell satisfies every decision that names that stage. Confirm every value a Returns cell states is read by at least one stage or actor. Confirm every input a Reads cell states comes from an `args` key, from a file or world fact the plan names, or from a stage or actor the plan has produce it. Confirm every duty the plan states has exactly one home and exactly one actor that performs it.
7. **Exit-kind auditor.** Enumerate every exit kind and every halt kind the plan defines. Trace each one end to end, from its trigger, through the record it writes, to its recovery. Confirm that every pair of kinds one round can carry at once is either ordered or shown impossible.
8. **Freshness pass.** Re-check the State section's volatile facts against the world. Return the rows it verified and its class verdict. This seat carries its own row class, and dispatches in the round's opening barrier alongside the other seats rather than ahead of them.
9. **Builder seat.** Derive, from the plan alone, skeletons of the artifacts the plan commits a builder to author, and write them into the state directory as that round's derivation. Read the newest earlier derivation the run's state carries, where one exists. Report every point where the plan blocked the derivation or forced a guess, and every difference from that earlier derivation that no plan change since it explains. This seat carries its own row class, and dispatches in the opening barrier on its own row, because it writes its derivation.

Every seat's brief carries a defect-shape checklist mined from the plan's own coverage record. Read `ledger.md` for the shapes its recorded defects keep taking, and name those shapes in the brief, so each seat hunts by shape rather than by instance. Refresh the list when the record shifts the mix, and against the per-shape catch rate a seeded-defect calibration records on the board.

Verify-new coverage stays outside these row classes. The verify-new seat covers the round's target sites rather than inventory rows, and reports that coverage as one verdict per site.

## Round structure

`plan-convergence-run` executes the round.

1. **The opening barrier.** One agent per seat above, all dispatched together, each auditing the whole plan. The verify-new seat dispatches with them, covering every site in the round's target set as the ledger records that set.
2. **The synthesizer.** It re-verifies the findings independently, consolidates them, tags nitpicks (wording taste, phrasing, or cosmetic rewrap alone, with no falsified claim, no contradiction, and no ownership or commitment change), and marks each surviving finding for application with byte-exact CURRENT and REPLACEMENT blocks. It closes every marked finding under its consequences: enumerate the sites that produce, consume, or reference the text the replacement changes, mark an induced edit for each such site the change breaks, and record for the rest that the change induces nothing at them. Its coverage report carries each seat's per-row returns and class-closure verdicts, the enumeration each verdict rests on, the builder seat's derivation path and its derivation findings by site and one-line claim, and the verify-new seat's per-site verdicts.
3. **The design-call adjudication.** A design call the round surfaces is settled in-run by a fork of the lead session, which rules per call and returns the blocks its rulings need. A call in the human's reserved set, and any call the fork leaves unadjudicated, exits the run to the lead before any application.
4. **The replacement review.** One agent reads each marked entry's REPLACEMENT as it will read in place, against the whole plan, for the defects a fix introduces: a contradiction with a sibling passage, an incomplete enumeration, a stale or dangling pointer, a second home for a fact, a broken producer-consumer pair, a wrong claim. It recomposes what it rejects, and the cycle reviews the recomposed text again. The entries the cycle leaves rejected are withheld from application and stand as defects for the next round.
5. **The apply chain.** Pre-verify reproduces each marked finding against the live text. The applier applies the entries whose anchors matched. Post-verify confirms that each applied site matches its replacement block. An anchor that does not match is a reported failure, never improvised around.
6. **The ledger-writer.** It records the round on the coverage ledger's write contract below, and renders the round's verdict.

## Class closure

A found defect obligates its class. The first round whose synthesis consolidates several findings as instances of one shape, or as several homes of one commitment, takes the structural fix of that shape in that round's own application. Do not wait for the shape to repeat across rounds, and do not land the per-instance fixes beside the structural fix.

A seat's class is closed when all of these hold for the class it reports on:

- Every inventory row of that class is verified against the text the round audits.
- Every shape a finding of that class exposes is enumerated to all of its instances.
- No real finding of that class survives that seat's own audit. A nitpick (wording taste, phrasing, or cosmetic rewrap alone, with no falsified claim, no contradiction, and no ownership or commitment change) leaves the class closed, and a real defect that the approval bar's counting leaves non-blocking leaves it closed the same way.

**The review bar.** Convergence rounds evaluate the core loop of the plan under convergence: what its machinery does when it runs, and what a builder must author for the artifacts it commits. A finding whose only subject is detail outside that loop goes on the watch list the plan's own live test owns, recorded in `ledger.md` by site and one-line claim, held out of the marked-for-application list and out of the round's counts. A design call whose only subject is such detail is recorded on that list the same way, its one-line statement of what the round left undecided standing in place of a claim, and it reaches no adjudicator and no exit. A finding that changes what the core loop does, or what a builder must author for the plan's committed artifacts, or that falsifies a claim, stays a real defect wherever it sits. An unsure classification resolves to real defect. Every class-closure verdict is evaluated against the findings this bar leaves on the marked path, and a class held open only by watch-list items closes with that note.

## The plateau response

A run that ends on the plateau kind gets no further patch rounds. The response is one structural fix.

The compared rounds' recorded defects select the fix's form. When those defects name a shared home, the fix is a structural fix of that home. When they name no shared home, the fix is a sequential walk of every section those defects name, against one fixed checklist, rewriting each shape that generated them.

The fix lands as lead-recorded blocks in the relaunch round's section of the coverage ledger, on that ledger's lead-edit terms. That round's machinery applies the blocks and re-audits them. The fix's drafting is executed by the workflow `plan-stall-sweep-run`, which lands beside `plan-convergence-run`. This section states the response. `/plan-stall-sweep-run` drafts the fix.

## Coverage ledger

The coverage ledger is `ledger.md` in the state directory. It holds one section per round, under the heading `## Round <n> target set`. The previous round's actor opens the section with that round's verify-new site list and its claim-inventory table. That round's own actor completes it with the round's record. The Round zero section above names which actor holds the pen for a given round.

Each round's record carries:

- The round's real defects, by site and one-line claim, each tagged blocking or non-blocking on the approval bar's counting.
- The nitpicks the round took, and the induced edits its consequence closure produced, by site and one-line claim, each tagged as its own kind.
- The watch-list items the review bar routed, by site and one-line claim, held out of the round's counts.
- The failed anchors, the failed seats, and every entry the replacement review withheld.
- The coverage report: which rows and which classes were verified, against which version of the text. Zero-finding verification logs feed the ledger.
- The round verdict, and the exit kind where the round ends the run.
- The next round's target set and claim-inventory table.

**Lead-recorded edits.** Between runs, the lead can record edits in a round's section: a correction, a purely additive edit, a design-call adjudication, or a plateau structural fix. Each recorded edit carries byte-exact CURRENT and REPLACEMENT blocks, a one-line claim, and its nitpick-or-real tag. The lead adds or changes the claim-inventory rows those edits create, and puts their sites in that round's verify-new site list. The relaunched round's synthesizer carries every recorded block into application exactly as recorded. Recorded text skips the replacement review. A recorded block supersedes any synthesis block at the same site.

## Approval bar

Approve when every condition holds:

1. Every claim-inventory row is verified at least once since its text last changed.
2. Every class audit is closed.
3. The builder seat's derivation is complete, with no guess, no block, and no difference left unexplained by a plan change, in the closing round and in the round before it.
4. The closing round's surviving findings are zero or nitpick-only: wording taste, phrasing, or cosmetic rewrap, with no falsified claim, no contradiction, and no ownership or commitment change.

The nitpick-only condition counts as a nitpick a real defect that neither falsifies a claim, nor changes what the plan's core machinery does, nor changes what a builder must author for the plan's committed artifacts. Apply such a defect as found. It holds the run open no further.

A round is never nitpick-only while it carries a failed anchor, a failed seat, a withheld replacement-review entry, a failed replacement reviewer, or a design call its fork adjudicator settled in flight.

**The end gate.** After a run returns converged, the lead makes one holistic end-to-end read of the plan, before anything executes against it. The read fires once per run. Beginning execution of what the plan lays out always requires the human's explicit authorization.
