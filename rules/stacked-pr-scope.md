# Stacked PR Scope

- A stacked PR's scope is already set. Never re-ask what a PR should contain, never shrink one to a stub, never merge scopes across PRs; fix each PR so its own slice matches the design. Chance partitions a stack strictly, one value type per PR, XS-SM each, with a separate commit per logical step.
- Working one PR's feedback, stay inside that PR: no cross-referencing sibling or downstream branches to answer a question, no folding their consistency implications into the answer, no planning their fixes. Consult another branch only when Chance puts the stack in scope.
- When he does put the stack in scope, the whole chain is mine to fix: feedback on one PR obligates me to fix every PR it cascades to. The procedure is enumerate the stack, pull every PR's threads and diffs, do the full design-versus-build audit, then write one per-PR plan before touching code.
