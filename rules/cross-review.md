# Cross-Review by Implementers

In the team workflows (jira-ticket-workflow and the like), the implementation teammates review each other's work: dev A reviews dev B's files and dev B reviews dev A's. A reviewer that an agent definition or a workflow names is allowed, such as the v3 build's `agents/v3-stream-reviewer.md`, one per stream a cross-review pair names. What is banned is an ad-hoc reviewer spun up beside a team (no `reviewer-for-X`, no standalone QA reviewer agent): the implementers already hold the context, and an extra agent adds cost without insight.

Never shut implementers down before cross-review completes. State the review assignments in the plan, each implementer assigned another implementer's files. The lead reads the whole result itself. Verification (lint, types, tests) is not a substitute for review, and both the cross-review and the lead's read run before committing. See [agent-lifecycle](agent-lifecycle.md) for reuse rules.
