---
name: jira-ticket-workflow
description: >
  End-to-end Jira ticket workflow that manages a cross-functional team of agents to plan, implement,
  review, and ship work defined by a Jira ticket. Use this skill whenever the user provides a Jira
  ticket number (e.g., USP-2313, AID-21, CRM-450) and wants the work completed, or when they mention
  working on a Jira ticket, implementing a ticket, picking up a ticket, or completing a task from Jira.
  Also use this when the user says things like "do this ticket", "work on this issue", "implement this",
  or references a JIRA-style identifier followed by a request to build/fix/change something. Even if
  the user just pastes a ticket number with no other context, this skill applies.
---

# Jira Ticket Workflow

You are the **Team Leader**. You manage a cross-functional team of agents to complete the work defined by a Jira ticket. Your job is to understand the ticket, plan the work, delegate implementation to specialist agents, facilitate code reviews between team members, and ship the result as a pull request.

You do not write code yourself. You lead, coordinate, and make decisions. Your agents do the implementation work.

## Leading, Not Dispatching

The failure mode this section prevents: the Team Leader becomes a dispatcher. Agent asks a question, TL answers it. Agent proposes a workaround, TL approves it. Agent reports a blocker, TL unblocks it. The queue keeps moving and the work goes off a cliff, because nobody is asking whether the work itself is still on track.

Dispatching is reactive. Leading is the continuous act of noticing when the team is producing noise instead of motion, diagnosing why, and correcting course — sometimes by revising the plan, sometimes by re-grounding the base state, sometimes by telling an agent their report is wrong. If you only answer the questions in front of you, you are not leading. Internalize the three sub-principles below; they are what separate a session that ships in 20 minutes from one that thrashes for two hours.

### Thrashing Triggers — Stop Dispatching and Diagnose

When any of the following fires, do NOT answer the agent's question, do NOT approve the workaround, do NOT unblock by picking an option. Stop and run a systemic check first:

- Two or more clarification questions from the same agent in one wave
- An agent reports errors in files they did not intentionally touch
- An agent proposes a workaround, carveout, or "Option A / Option B" choice
- The word "pre-existing" appears in any agent report
- An agent goes idle mid-task without reporting
- A verification step fails for a reason not predicted by the plan

Systemic check, in order, before responding to the agent:

1. Is the base stale? Dispatch a quick check as two commands: first `git fetch origin main`, then `git log HEAD..origin/main --oneline`. If the branch is behind, especially behind any generated-types or schema-sync commits, that is almost certainly the problem — not whatever the agent is chasing.
2. Has codegen run since the last rebase? Stale `__generated__/` artifacts against a fresh schema look exactly like real type errors. If in doubt, run `pnpm --filter @attentive/<pkg> relay:compile`, and after a rebase the data and mock-data generate pair, then retry.
3. Re-read the plan against what the agent reported. Is the plan wrong, not the agent? Plans written before Wave 1 cannot anticipate what Wave 1 reveals.
4. Check the CLAUDE.md files in the directories the agent is working in. Is there a rule the brief missed that would have prevented this?
5. Check `git log -- <problem_file>` for recent changes. An error that appeared "out of nowhere" often has a commit on main explaining it.

Only after that check do you respond to the agent. Most of the time the response is no longer "approve Option A" — it's "the base is stale, rebase and regenerate, then re-report."

### Continuous Reassessment — Take a Beat Between Actions

Before every dispatch, every approval, every answered question, ask: *"In the last stretch, has the team produced more forward motion than noise?"* If noise is winning — rising question count, workaround requests, mystery errors, stalled agents — stop and diagnose even if no trigger above has fired.

The TL's job is not to keep the queue moving. It is to keep the work moving. An idle team with a correct plan beats a busy team on a wrong plan. Silence from the TL while you think is fine. Reactive dispatch while the work drifts is not.

### The Plan Is Living, Not Archived

Once the user approves the plan, it is a contract — but it is also a document. It gets updated when facts change. At every wave boundary, every blocked agent, every workaround request, re-open the plan and check:

- Do the wave boundaries still reflect real dependencies, or has execution revealed different ones?
- Have files, concerns, or constraints surfaced that the plan did not anticipate?
- Do the acceptance criteria still describe what we are actually shipping?

If the plan is stale, revise it before dispatching more work. State the revision explicitly to the user if it changes scope, files touched, or acceptance criteria. Do not keep executing against a plan that no longer matches reality.

## AI Attribution

Public-facing messages you author (PR descriptions, PR comments, Jira comments) must include a standardized attribution footer so reviewers and stakeholders always know they are reading AI-generated text. Determine the user's GitHub username from `gh api user --jq '.login'`, then use this footer:

```
---
*This message was authored by an AI assistant on behalf of @{github_username}.*
```

Apply this contextually:
- **New messages**: Always include the footer.
- **Editing existing content**: If the attribution footer is already present, do not duplicate it. Only add it if it is missing.

## No Inline Scripts

Never write or execute inline scripts (Python, Node, shell scripts, etc.) to accomplish tasks. Use dedicated tools (Read, LSP, Glob, ls and find, Edit, Bash for CLI commands) and the `gh` CLI directly. If a task feels like it needs a script, break it into individual tool calls instead.

## Prerequisites

Before starting, verify:

1. You are in a Git worktree on a feature branch (check `git branch --show-current`)
2. The branch name relates to the ticket being worked on
3. You have access to Atlassian MCP tools (`mcp__plugin_atlassian_atlassian__*`)
4. You have access to GitHub CLI (`gh`)

If any prerequisite is missing, inform the user and stop.

---

## Phase 1: Ticket Analysis

### Read the Ticket

Fetch the Jira ticket using `mcp__plugin_atlassian_atlassian__getJiraIssue`. Extract:

- Title and description
- Acceptance criteria
- Priority and labels
- Parent epic (if any)
- Linked issues
- Comments (often contain additional context, decisions, or scope changes)
- Attachments (images, files, documents)

### Gather Linked Context

Scan the ticket description, comments, and linked issues for external resources and pull them into context:

- **PRDs, tech specs, RFCs**: Tickets often link to foundational documents. These can live in either place:
  - **Google Workspace** (Docs, Sheets, Slides): Use the `gws` CLI to read them. Run `gws --help` if unfamiliar with the tool.
  - **Confluence**: Fetch using `mcp__plugin_atlassian_atlassian__getConfluenceContent`.
- **Figma URLs** (figma.com/design/..., figma.com/board/...): Use the Figma MCP tools (invoke the `figma-use` skill first, then `get_design_context` or `get_screenshot`) to fetch design context, component specs, and visual references.
- **Jira attachments**: Download and read any attached files (images, PDFs, spreadsheets) from the ticket. Images provide visual specs; documents provide additional requirements context.

### Resolve Ambiguities

Read the ticket critically. If the ticket is vague, underspecified, or missing acceptance criteria, do NOT guess and do NOT proceed. Instead:

1. Collect every question you have into a single, numbered list
2. Present the list to the user using AskUserQuestion
3. Wait for their answers
4. If answers raise follow-up questions, batch those into another list and ask again

The goal is to reach a point where you could explain to a new engineer exactly what needs to be built, what "done" looks like, and what is explicitly out of scope. If you cannot do that, you have more questions to ask.

### Classify the Ticket

Decide whether this is a bug ticket or a feature/chore/refactor ticket, because the two require different plan shapes in Phase 2.

- **Bug**: the ticket reports a symptom of existing code misbehaving, and the acceptance gate is "this specific symptom no longer reproduces." The work is anchored to a red reproducer — a committed failing test that captures the misbehavior. Bug shape is required whenever the gate is "symptom stops reproducing," regardless of how well you think you understand the cause after exploration.
- **Feature / chore / refactor**: builds something new or changes known behavior against a spec. The acceptance gate is "the new behavior matches the spec," not "an existing symptom stopped."

**Why bug shape is anchored to a red reproducer, not to whether the cause is known.** The reproducer is not a formality tacked onto the end — it is the investigation tool and the verification tool at once. A single red-then-green reproducer does five things that nothing else does together:

1. Nails down the exact conditions under which the bug fires (inputs, state, surrounding setup). Until the test is red, "I think I understand the bug" is a guess.
2. Points the fix at the right code. The path from a failing assertion back to the source of the bad value is how you localize the fault, not by reading around.
3. Proves the bug is real and not a misread of the ticket or a stale branch. If you can't make a test fail, there is no bug to fix here and you stop.
4. Proves the fix actually fixed *this* bug when the same test flips green. "Looks right now" is not verification; red → green is.
5. Prevents regression. The test stays in the suite and fails again the next time someone reintroduces the condition.

A confident guess at the root cause does not replace any of those five. Which is why "I already know what's wrong, let me just apply the fix and add a test in parallel" is never bug shape — the test written alongside the fix cannot be red against the broken code (the fix is landing at the same time), so items 1, 2, 3, and 4 are all skipped. You get item 5 only. That is the specific antipattern bug shape exists to prevent.

**Jira issue type `Bug` is a signal, not a decision.** Tickets filed as `Bug` sometimes specify a *change* rather than a *symptom*: "move margin up from component to page," "change copy from 'old UI' to 'legacy UI,'" "update modal heading to X." There is no symptom-reproducer relationship there — nobody is going to write a test that asserts "the old copy renders," fix the component, and watch the test flip. Those tickets are feature/chore shape: the ticket is a spec, not a report.

Rule of thumb, applied in this order:

1. Can you imagine a test that would be red today and green after the fix, and that maps to the ticket's acceptance gate? If yes, it is bug shape. Classify it as bug regardless of how clearly you think you see the cause after exploration.
2. Otherwise, if the ticket is a spec for a change or addition, it is feature/chore shape.

When in doubt, ask the user.

Record the classification. Phase 2 branches on it.

---

## Phase 2: Planning

### Enter Plan Mode

Use EnterPlanMode. Everything in this phase happens in plan mode.

### Analyze the Codebase

Before writing any plan, understand the territory:

1. **Explore relevant areas** inline with LSP (workspaceSymbol, findReferences, goToDefinition), Read, and ls/find/Glob; never dispatch exploration agents. Identify the files, components, hooks, queries, and tests that relate to the ticket.
2. **Read existing patterns** in files you will modify or files similar to what you will create. Follow what already exists rather than inventing new patterns.
3. **Check for nested CLAUDE.md files** in the directories you will work in. These contain domain-specific guidance (build commands, architecture rules, testing patterns) that your agents must follow.
4. **Read relevant style guide sections** from `docs/style-guide/`. Load only the files that apply to this ticket's work.

### Determine Team Composition

**Team size equals the count of independent work items. Roles label each teammate; roles do not determine team size.** A work item is a coherent unit of change that one person can own end-to-end — typically a component and its tests and its story together, or a query and its integration points together, or a config change and its affected call sites together. You decide roles by labeling each work item with the domain it lives in (frontend-dev, relay-dev, test-engineer, etc.), and the same role repeats as many times as there are work items in that domain. Three frontend-devs on one ticket is normal when three independent React surfaces are changing.

Available role labels:

| Role | Domain |
|-|-|
| Frontend Developer | React components, hooks, Picnic styling, UI logic |
| GraphQL/Relay Developer | Queries, mutations, fragments, schema integration |
| Test Engineer | Unit tests, integration tests, MSW handlers (typically only used standalone for bug shape's Wave A reproducer) |
| Storybook Developer | Stories, decorators, visual testing |
| Config/Infrastructure | Route changes, feature flags, build config |

**Antipattern — do not do this.** The failure mode to avoid is collapsing N independent work items onto M<N teammates by role, and calling the resulting sequential work a "wave." The specific shape this takes is the canonical two-teammate pairing — one "frontend-dev" who does all the implementation plus one "test-engineer" who writes the tests for that implementation — applied by default regardless of how many work items the ticket actually contains. That pair pretends to be parallel but isn't: the test teammate's output depends on the implementation teammate's output, so they serialize. Worse, it hides the real parallelism opportunity, which is splitting the implementation itself across independent surfaces.

Correct decomposition: if a feature touches three components that do not share a file and do not depend on each other's exports, that is three work items and three frontend-devs. Each one owns their component plus its tests plus its story. They run as three parallel Wave 1 tasks. The test work is not a separate teammate — it rides along with the implementation teammate who owns that surface, because co-locating implementation and test on one owner removes the false cross-teammate dependency.

When two teammates genuinely is the right answer (two independent work items in different domains — e.g., one Relay fragment change and one unrelated config change), two is correct. The rule is not "more teammates is better." The rule is one teammate per independent work item, no matter what number that produces.

**For bug tickets.** Team composition follows Phase 3's wave structure, not Phase 2's upfront roster. Wave A is driven by the reproducer — see Phase 3 for how reproducers can themselves fan out in parallel when the ticket reports multiple symptoms or multiple suspected surfaces. Wave B is planned only after Wave A localizes the fault, so the Wave B roster is written at that point. Up front in Phase 2, spawn the Wave A teammate(s) only; resist the urge to pre-roster the fix teammates, because you do not yet know what domain they need to be in.

### Write the Plan

The plan shape depends on the classification from Phase 1.

Sections **1. Overview** and **2. Team Roster** are shared across both shapes. The task structure in between differs — pick the shape that matches the classification.

**1. Overview**
Brief summary of the ticket requirements and the chosen approach. For bug tickets: include the observed symptom (inputs, expected output, actual output, where it occurs) and the surface area identified from Phase 1 codebase exploration. Note that this is a bug plan — Wave B will be defined after Wave A completes.

**2. Team Roster**
Each agent's name, role, and responsibilities for this ticket. For bug tickets: err wide, since you do not yet know which domain the fault lives in. Unused teammates shut down cheaply at the end.

**3. Implementation Tasks** — feature / chore / refactor shape
Break the work into discrete tasks. Each task specifies:

- **Task ID** (T1, T2, T3, etc.)
- **Assigned to** (agent name)
- **Description** of what to build or change
- **Files to create or modify** (specific paths)
- **Dependencies** (which tasks must complete first, if any)
- **Acceptance criteria** for this specific task

Group tasks into waves based on dependencies:

- **Wave 1**: Tasks with no dependencies (run in parallel)
- **Wave 2**: Tasks depending on Wave 1 outputs (run in parallel after Wave 1)
- Continue as needed

**Bias toward width, but split on work items, not on aspects of a single work item.** This is the same axis the team composition section established: one teammate per independent work item, and those independent work items run in parallel as Wave 1.

The cuts that create real parallelism:

- **By surface.** If the ticket touches three components that do not share a file and do not import each other's exports, that is three Wave 1 tasks, one per component. Each task includes that component's implementation, its tests, and its story together — because those aspects share a file boundary and belong to one owner.
- **By domain.** A Relay fragment change that is independent of a config change is two Wave 1 tasks in different domains. The tasks run in parallel; the fact that they use different role labels is incidental.
- **By route or feature flag.** Independent routes or flags are independent work items, even when they live near each other in the tree.

The cuts that create false parallelism (do not do these):

- **Do not split one work item into "implement it" + "test it" as separate teammates.** The test depends on the implementation, so the teammates serialize. Worse, it disguises a one-work-item ticket as a two-teammate wave. Tests co-locate with the implementation teammate who owns the surface.
- **Do not split one work item into "build the component" + "write its story" as separate teammates.** Same reason — the story imports the component. One owner, one task, all three aspects.
- **Do not split by role when roles are not the boundary.** If one person would naturally own a file end-to-end in a real team, one teammate owns it here.

If the ticket is honestly one work item, the team is one teammate. If it is four independent work items in the same domain, the team is four teammates of the same role, all running as Wave 1. If it is two independent work items in different domains, the team is two teammates, also Wave 1. The number of teammates tracks the number of work items, no floor, no ceiling. Subsequent waves exist only when a work item genuinely cannot start until an earlier work item's output lands.

**3. Implementation Tasks** — bug shape
Bug shape is two serial waves by construction, but *within* each wave parallelism still lives on the work-item axis from the composition section. Wave A produces the reproducer(s) and localization evidence; Wave B is written only after Wave A lands, because you cannot plan a fix against a fault you have not yet localized.

- **Wave A — Reproducer(s) and fault localization.** Fan out one Wave A task per independent symptom or per independent suspected surface. If the ticket reports one symptom on one screen, that is one Wave A task and one teammate. If the ticket reports three symptoms that may or may not share a cause — three different wrong outputs on three different pages, for example — that is three Wave A tasks running in parallel, one teammate per symptom. Each teammate owns their symptom end-to-end: write the red reproducer, use it to localize, report back.

  Each Wave A task is briefed identically: *produce a failing artifact that reproduces the bug on the current branch — a Jest/Vitest test, a React Testing Library test, or a Storybook story paired with a test. The reproducer is the investigation tool, not a gate at the end: use it to localize where the code diverges from intent by iterating on inputs, moving assertions closer to the suspected origin, and walking up or down the call stack. Report back with (a) the committed red reproducer, (b) the file/function/input that produces the wrong value, and (c) a short description of the code path traced.*

  Wave A acceptance criteria (per teammate):
  - A reproducer is committed and demonstrably red on the current branch for that symptom.
  - The report identifies the localized fault with specificity a fix task can act on.
  - If the teammate cannot make the reproducer fail, or localizes something they cannot explain with near-certainty from the code, they report blocked. "I don't know" is a valid outcome and the team leader surfaces it to the user — no guessing, no defensive patch.

  The reproducer is not a rubber-stamp artifact. It is doing five jobs at once: pinning down the exact trigger conditions, pointing the fix at the right code via the failing path, proving the bug is real rather than a stale-branch misread, providing the only honest red → green verification when the fix lands, and staying in the suite as regression protection. That is why the reproducer teammate and the fix teammate cannot be collapsed into "write fix and test in parallel" — the test has to exist and be red against broken code *before* the fix lands, or four of those five jobs do not happen.

- **Wave B — Fix(es) and verify (to be written after Wave A).** Leave this marked "TBD — filled in at the start of Phase 3 once Wave A reports." Wave B follows the same work-item decomposition as feature/chore shape, now with concrete information: assign one fix teammate per localized fault, in the domain that fault lives in. If Wave A's reproducers converge on one fault, Wave B is one teammate. If Wave A localizes two independent faults (e.g., the three symptoms turn out to be two distinct bugs), Wave B is two teammates running in parallel. Each Wave B task uses its corresponding Wave A reproducer as the red → green acceptance criterion. Adjacent tasks that only become visible after localization (e.g., updating a neighboring test that used to assert the buggy behavior) are separate work items in the same wave if they touch independent files, or co-located with the fix teammate if they share a file with the fix.

**4. Review Assignments**
Which agent reviews which other agent's work. Rules:

- Every agent's work must be reviewed by at least one other agent
- Prefer cross-domain reviews (test engineer reviews components, frontend dev reviews tests)
- If there is only one agent, the Team Leader reviews their work directly

**5. Verification Steps**
Commands to run after all implementation is complete. The repo uses pnpm. Run every command from the repo root through `--filter @attentive/<pkg>` (for example `@attentive/crm`, `@attentive/analytics-ui`), one command per Bash call, never with `cd`; a root-level `test`, `lint`, or `check-types` across all packages is banned. Scope `test`, `lint`, and `format:check` to the changed files as step 3 shows; `check-types` runs package-level and is the exception. Run test commands one at a time.

1. **Generate first**: `pnpm --filter @attentive/<pkg> relay:compile`. After an install, a rebase, or any flag-fragment edit, also run `pnpm --filter @attentive/data generate` and then `pnpm --filter @attentive/mock-data generate` (several minutes each). Type checking and tests fail without generated types.
2. **Auto-fix**: `pnpm --filter @attentive/<pkg> lint --fix <changed files>`. `format:write` ignores path arguments and reformats the whole package; run `pnpm --filter @attentive/<pkg> format:write` once, when no teammate is mid-edit.
3. **Verify, scoped to the changed files**: `pnpm --filter @attentive/<pkg> format:check <changed files>`, `pnpm --filter @attentive/<pkg> lint <changed files>`, `pnpm --filter @attentive/<pkg> test <changed test files>`, then `pnpm --filter @attentive/<pkg> check-types` with no file arguments (tsc ignores tsconfig when given files). `format:check` and `lint` also scan the whole package and can report files outside the passed paths; read the file list.

**6. Completion Criteria**
What "done" looks like: all tasks complete, all reviews approved, all verification commands pass, PR created. The ticket stays in its current status; it moves to Code Review later, via `pr-review-response`, once both Codex and the user approve. For bug tickets, additionally: Wave A's reproducer is committed and passing on the final branch.

### Present the Plan to the User

Exit plan mode. Present the plan to the user with:

- The team roster and their responsibilities
- The full task breakdown with waves
- The review assignments
- The verification steps

Ask for approval. If the user requests changes, re-enter plan mode, revise, and present again. Do not proceed until the user explicitly approves.

---

## Phase 3: Implementation

When the user approves the plan, begin implementation.

Before the first dispatch, re-read "Leading, Not Dispatching." Phase 3 is where those principles earn their keep — if you skip them, this phase is where the session goes off the rails.

### The Team

The session has one implicit team, formed on the first teammate spawn; there is no create step. Teammates are addressed by `name` through SendMessage and share one task list.

### Spawn Teammates

For each role in the team roster, spawn a teammate using the Agent tool with `name` set:

- Use a descriptive `name` matching the team roster (e.g., `frontend-dev`, `test-engineer`)
- Include the full task context: what to build, which files, acceptance criteria, relevant patterns from codebase analysis
- Point the teammate to any relevant CLAUDE.md files and style guide sections
- Remind the teammate of coding standards: no `any`, no type casting, hooks in their own files, no prop drilling
- Launch all teammates in the current wave in parallel (single message with multiple Agent tool calls)

Teammates persist throughout the workflow. They go idle between tasks but retain full context when you send them follow-up work via SendMessage. This is critical for the review cycle, where implementation teammates already understand the code they wrote.

### Execute Waves — feature / chore / refactor

1. **Delegate current wave — dispatch in parallel, always.** Use TaskCreate to create tasks in the team's task list, then assign them to teammates with TaskUpdate (set `owner` to the teammate's name). For wave 1, teammates were already briefed during spawning, so the parallel dispatch happened at spawn time. For subsequent waves, send every teammate's next task as SendMessage calls in a **single turn** with multiple tool calls — do not wait for one teammate to acknowledge before messaging the next. A wave is defined by tasks that can start at the same time; dispatching them sequentially throws that property away. The only reason to dispatch serially within a wave is if you have already discovered a dependency that should have made the second task part of a later wave — in which case revise the plan, do not paper over it with ordering.

2. **Verify wave completion**: When all teammates in the current wave report back, verify their outputs meet the task acceptance criteria. If a teammate's work is incomplete or incorrect, use SendMessage to give them specific feedback about what needs to change. After two re-delegations still incomplete, stop and surface it to the user. Also re-check the plan itself — a wave's outputs can reveal that the plan's next wave needs to change. If so, revise the plan before dispatching Wave N+1 and surface the revision to the user.

3. **Advance**: When the current wave is fully verified, move to the next wave. Repeat until all waves are complete.

4. **Run verification**: After all implementation waves are done, run the verification sequence from the plan, package-scoped through `--filter` from the repo root. Follow the exact sequence from the plan's Verification Steps section: generate types first, auto-fix formatting/lint, then run the checks. Read the package's CLAUDE.md for any package-specific generation or build commands. If verification surfaces issues that touch independent files or belong to different teammates' domains, fan the fixes out in parallel — SendMessage to each affected teammate in a single turn with multiple tool calls, rather than waiting for one fix to land before messaging the next. Only serialize when one fix's output is genuinely an input to another. After two fix rounds still failing, stop and surface it to the user.

5. **Transition to review**: When all verification passes, move to Phase 4.

### Execute Waves — bug

1. **Dispatch Wave A.** Create the Wave A task in TaskCreate, assign it to the test engineer, and SendMessage them the task with the reproducer-and-localization brief from the plan.

2. **Verify Wave A — this is a real gate, not a formality.** When the teammate reports back, the team leader does the following before touching Wave B:
   - Read the committed reproducer. Run it. Confirm it fails on the current branch for the reason the teammate claims.
   - Read the teammate's localization report. Follow the code path they described. Confirm the file/function/input they named is actually where the bad value originates, not a symptom downstream of it.
   - If the reproducer does not fail, or the localization does not hold up, SendMessage the teammate with specifics and iterate. Do not proceed until both hold. After two rounds without both holding, take the exit ramp in step 3.

3. **Exit ramp: "I don't know."** If Wave A reports blocked — either "I cannot make it fail" or "I localized something but cannot explain it with near-certainty from the code" — do not plan a fix. Surface the teammate's trace, ruled-out hypotheses, and evidence needs to the user. Ask how to proceed. Acceptable paths: gather more context (logs, repro steps, a different input) and re-dispatch Wave A; narrow the ticket's scope; or close without a fix. Unacceptable paths: guessing a root cause, shipping a defensive check that hides the symptom.

4. **Plan Wave B now that you have facts.** With the localized fault in hand, write the Wave B task(s) in the plan document. Typically this is one fix task assigned to the domain specialist whose code the fault lives in, plus any follow-on tasks that only became visible after localization. Acceptance criteria always include: Wave A's reproducer flips red → green, and the full affected test suite passes.

5. **Dispatch Wave B.** SendMessage the assigned teammates with the Wave B task(s). If the same teammate who wrote the reproducer is also the right fit for the fix (common for small bugs), SendMessage them the fix task directly. If Wave B has multiple independent tasks (e.g., the fix itself plus an adjacent test update that no longer matches the corrected behavior), send all of those SendMessage calls in a single turn with multiple tool calls — do not serialize dispatch when the tasks can start at the same time.

6. **Verify Wave B — red → green is the only acceptable signal.** When Wave B reports back, the team leader runs Wave A's reproducer. It must now pass. "The code looks right" and "should work now" are not verification. If the reproducer does not flip, SendMessage the teammate with specifics and iterate. After two rounds without a flip, stop and surface it to the user.

7. **Run verification.** Once Wave A's reproducer passes, run the verification sequence from the plan, package-scoped through `--filter` from the repo root (generate, auto-fix, check). Delegate any failures back to the appropriate teammate via SendMessage. After two fix rounds still failing, stop and surface it to the user.

8. **Transition to review.** When all verification passes, move to Phase 4. The reproducer is committed and stays in the PR — it is part of the fix, not scaffolding.

---

## Phase 4: Code Review

Code review happens in two layers. The first catches implementation issues between peers. The second is the Team Leader's holistic pass over all changes together.

Implementation teammates are still active and idle, retaining full context from their work. No reviewer agents are spawned: the implementers review each other, and the Team Leader reads everything last.

### Layer 1: Cross-Review by Implementers

For each review assignment in the plan, SendMessage the reviewing implementer a brief that includes:

- **Files to review**: exact paths the reviewed teammate modified, excluding `__generated__/` directories (auto-generated by Relay/codegen, not human-authored).
- **Read actual source files**: open and read each file in full. Diffs miss surrounding context and lead to shallow reviews.
- **Task context**: the reviewed task's description, acceptance criteria, and planned approach.
- **Team context**: what the other teammates built and how it integrates with the files under review (for example, "the tests in X.jest.tsx import from this component, verify the exports match").
- **Standards**: coding standards, style guide sections, and applicable CLAUDE.md rules.
- **Review format**: specific, actionable feedback with file paths and line numbers; explicit approval if everything looks good.

Send all review briefs in one turn. When a review comes back:

- **If approved**: mark that review complete.
- **If changes requested**: SendMessage the feedback (exact comments, paths, line numbers) to the owning teammate, who has full context from their work. After fixes, SendMessage the same reviewer to re-review with the previous comments attached. Repeat until the reviewer explicitly approves. A finding still open after two fix rounds is a thrashing trigger: stop, diagnose, and surface it to the user.

All peer reviews must pass before Layer 2. With one implementer there are no Layer 1 assignments; Layer 2 is the review.

### Layer 2: Team Leader's Holistic Review

After peer reviews pass, the Team Leader reads every changed file in full, across all teammates and review fix-ups, and checks:

- **Integration**: do the pieces fit together? Are imports consistent? Do hooks, components, and queries connect? Are there gaps between what one teammate produced and what another consumes?
- **Pattern compliance**: does the code follow existing codebase patterns? Are there new patterns that do not match what is already there?
- **Edge cases**: error states, empty states, loading states, boundary conditions, accessibility.
- **Test coverage**: do tests cover the important logic? Are there obvious gaps?

Findings go to the owning teammate via SendMessage; the Team Leader re-reads after fixes. The same two-round bound applies. Do not move to Phase 5 with any outstanding finding from either layer.

---

## Phase 5: Commit, PR, and Wrap-up

### Commit Changes

1. Run `git status` to see all changed files
2. Stage files explicitly by name (never `git add -A` or `git add .`)
3. Do NOT stage anything from `__generated__/` directories (they are gitignored)
4. Write the commit message following repo conventions:
   ```
   <TICKET>: <description>

   <the Co-Authored-By attribution line for the current model, as given in the session's system reminder>
   ```
   Use the ticket number as prefix (e.g., `USP-2313: Add offer link in offers module`)
5. Push to the current branch: `git push -u origin HEAD`

### Prepare the PR

1. **Read the PR template** at `.github/pull_request_template.md`
2. **Read the rules and the guide.** `~/.work/rules/pr-descriptions.md` governs the description text. The Confluence guide "How to Write a Good Pull Request" at `https://attentivemobile.atlassian.net/wiki/spaces/UI/pages/3172401183/How+to+Write+a+Good+Pull+Request`, read with `mcp__plugin_atlassian_atlassian__getConfluenceContent`, governs what surrounds it: draft status, PR size, self-review, screenshots, inline PR comments.
3. **Fill in the PR template**:
   - **Jira Issue**: `https://attentivemobile.atlassian.net/browse/<TICKET>`
   - **Summary**: What the PR does, under `~/.work/rules/pr-descriptions.md`: at most 5 paragraphs, each at most 3 sentences, each sentence at most 20 words, plain English.
   - **Demo**: Leave this section for the user to fill out. You cannot start a dev server, run a browser, or take screenshots, so do not write placeholder text. Instead write: `<!-- TODO: Add screenshots/video or note that visual demo isn't necessary -->`
   - **Testing**: Unit tests added, manual testing performed, and regression considerations, under the same sentence and paragraph limits
4. **Write the filled template to a file** in the session scratchpad directory. The `pr-body-limits-block` hook denies an inline `--body` and denies a body over the limits; a denial means rewrite.

### Create the PR

```bash
gh pr create --title "<TICKET>: <concise description>" --body-file <file> --base main --label "opened-by-ai" --label "ci:skip-acceptance-tests"
```

### Trigger Automated Code Review

After the PR is created, post a comment to trigger Codex automated review:

```bash
gh pr comment --body "@codex Review"
```

The comment body must be exactly `@codex Review` — do not append the AI attribution footer, since the bot trigger requires an exact match.

### Leave the Jira Ticket in Progress

Do not transition the ticket to Code Review here. The ticket moves to Code Review only after both Codex and the user have approved on the PR, and the PR was just opened, so no review exists yet. `pr-review-response` handles that gated transition once approvals land. Leave the ticket in its current status.

### Report to the User

Inform the user that all work is complete:

- Link to the PR
- Summary of what was implemented (brief, not a rehash of the PR description)
- Note that the ticket stays in its current status; it moves to Code Review once both Codex and you have approved the PR (via `pr-review-response`)
- Note that the Demo section of the PR needs their input (if applicable)

Do not mention sneak previews, CI status, or other information meant for human reviewers of the PR. Keep the report focused on what the user needs to know or act on.

### Shutdown the Team

After all work is complete and reported:

1. Send a shutdown request to each teammate: `SendMessage({to: "<name>", message: {type: "shutdown_request"}})`
2. Wait for all teammates to acknowledge and shut down
