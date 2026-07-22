# No `let` in React Components

Using `let` inside of a React component is a code smell and should be avoided. Reach for the existing patterns instead: `const` with early returns per branch, early returns inside `.map`/`.reduce` callbacks, `&&` object spreads, `??` for nullish defaults ([no-ternaries](no-ternaries.md)), and single-pass immutable transforms via `reduce` ([inline-immutable](inline-immutable.md)); a `let` reassignment is often a spread-out ternary or a mutation loop in disguise.
