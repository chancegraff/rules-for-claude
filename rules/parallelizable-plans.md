# Parallelizable Plans

Implementation plans must be parallelizable. The lead is the orchestrator dispatching parallel agents (three to five parallel implementers is the operating mode); a non-parallelizable plan wastes that capability and stalls the work. When designing any non-trivial plan's wave structure, ask: can N agents implement this concurrently without colliding? If the honest answer requires serial dependencies, restructure into:

1. Foundation phase (sequential, single agent, lands first). Shape only: type widenings, new constants, new signatures with backward-compatible defaults, dependency additions, doc-comment corrections. No behavior changes. After Foundation, downstream agents typecheck against the new shape without coordinating.
2. Parallel streams (multiple agents, dispatched concurrently). Behavior implementation. State each stream's file ownership explicitly so the streams cannot collide; the streams own their co-located tests too, and test-rewrite ownership distributes across streams (nothing is "everyone's job").
3. Verifier (sequential, fresh agent). Independent re-run of typecheck, lint, and the affected test files (scoped per scoped-verification.md); reads modified files for split-decision compliance; sweeps the diff for `any`, type casts, em-dashes.

State the Foundation/Parallel/Verifier shape in the plan's Wave structure section, with file ownership listed per stream. A plan with a single sequential numbered list of work items has not been designed for parallel execution and is failing this rule.
