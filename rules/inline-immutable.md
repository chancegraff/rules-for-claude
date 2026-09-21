# Inline, Immutable, Single-Pass Code

Write a one-off transform inline, inside the function that needs it, as a single immutable pass: one `reduce` returning `[...acc, x]`, never a `for...of` with `push` (mutation), never `.map().filter()` (two passes).

A new helper function exists only when the reference already has one, or when a second caller needs it; inside one transform, inline it. [mirror-not-extract](mirror-not-extract.md) carries the same sentence.

Answering a review nit follows the same rule: make the smallest edit that removes the whole concern, never a reorganization of the file to match a reviewer's wording.
