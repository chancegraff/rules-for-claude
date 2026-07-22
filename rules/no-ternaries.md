# No Ternaries

NEVER use the ternary operator (`cond ? a : b`) in new code: not in expressions, not in JSX props, not in returns, not even a single non-nested one. Never convert a ternary into `let x = <default>; if (cond) { x = <other>; }` either; that is a spread-out ternary. Use real branching, reaching for an early return first:

- Early JSX returns / multiple render paths: the component returns its own full JSX per state (`if (!isExpanded) { return <Header icon="ChevronRight" verb="Expand" />; } return <Header icon="ChevronDown" verb="Collapse" />;`), pushing the differing literals down as props so each branch's JSX is concrete.
- Early returns inside `.map`/`.reduce` callbacks for per-item branching: `if (typeof v === 'object') return JSON.stringify(v); return String(v);`, never `? :`, never a `let` reassign.
- `&&` object-spread for conditional CSS: `css={{ ...base, ...(hasBorder && { borderBottom: '1px solid $borderDefault' }) }}` instead of computing a value into a `let`.
- `const x = cond && <JSX/>` for optional elements; `??` for nullish defaults.

Scope: NEW code only. Leave pre-existing ternaries alone; rewriting them is pointless churn the user reverts. Sits with the other hard bans: [no eslint-disable](no-eslint-disable.md), no `any`/`unknown`/casts (global standards).
