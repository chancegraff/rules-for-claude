# No Ternaries

NEVER use the ternary operator (`cond ? a : b`) in new code: not in expressions, not in arguments or props, not in returns, not even a single non-nested one. Never turn a ternary into `let x = <default>; if (cond) { x = <other>; }` either; that is a spread-out ternary.

Branch for real, reaching for an early return first, at the top of a function and inside a `.map` or `.reduce` callback alike: `if (typeof v === 'object') return JSON.stringify(v); return String(v);`. Use an `&&` object spread for a conditional part of an object, `const x = cond && <value>` for an optional one, and `??` for a nullish default.

Scope: NEW code only. Leave pre-existing ternaries alone; rewriting them is churn the user reverts.

Sits with the other hard bans: [no eslint-disable](no-eslint-disable.md), no `any`/`unknown`/casts (global standards).
