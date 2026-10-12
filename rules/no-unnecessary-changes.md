# Never Make Unnecessary Changes (HARD RULE)

Chance, 2026-10-09, on USP-985: "HARD RULE: never make unnecessary changes." He killed the inline-props rule the same day because it converted every touched component's props type, which is not ticket work.

A change is necessary when the ticket, the agreed fix, or a defect found in the touched code requires it. Every other hunk is unnecessary and is not made. The shapes it hides in:

- converting a declaration to a preferred shape (a props type to inline props, a function to an arrow, a `for` to a `reduce`) while the behavior stands
- moving a comment or a `const` that did not need to move
- trimming or reordering css, imports or props that work
- renaming for taste
- "while I am here" cleanup of a sibling line

**How to apply.** Before each hunk, name the ticket line, fix or defect that needs it. No name, no hunk. Style rules (no ternaries, no `let`, curly braces, inline-immutable and the rest) govern new lines only; an existing line that works is left as it is, in the shape it has. A review nit gets the smallest edit that removes the whole concern ([inline-immutable](inline-immutable.md)). A defect in touched code is fixed in the same round ([fix-known-issues](fix-known-issues.md)); a style deviation in touched code is not a defect.

Every agent brief carries this rule in one sentence, and every agent report names the hunks that were not strictly required, if any, so the lead can strip them before commit.
