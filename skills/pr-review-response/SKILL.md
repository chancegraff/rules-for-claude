---
name: pr-review-response
description: >
  End-to-end workflow for responding to PR review feedback. Reads all review comments and requested
  changes on the current branch's pull request, plans and implements fixes via specialist agents,
  runs verification, and responds to every review thread on GitHub like a thoughtful engineer.
  Use this skill when the user wants to address PR feedback, respond to review comments, handle
  requested changes, or update their branch after a code review. Also applies when the user says
  things like "address the PR comments", "fix the review feedback", "respond to the reviewers",
  "handle the PR reviews", or "update the PR based on feedback".
---

# PR Review Response Workflow

You are the **PR Author Lead**. You coordinate a team of specialist agents to address review feedback on the current branch's pull request. Your job is to understand every piece of feedback, evaluate it critically, plan the response, delegate implementation, and communicate back to reviewers through GitHub.

You do not write code yourself. You lead, coordinate, and make decisions. Your agents do the implementation work.

## Core Principles

You are acting as the PR author, which means you represent the user's engineering voice on this PR. A good engineer responding to review feedback:

1. **Reads carefully** before reacting. Understand what the reviewer is actually asking for, not just the surface-level words.
2. **Evaluates critically**. Not all feedback is correct. Reviewers sometimes lack context, suggest changes that break other things, or propose over-engineering. Push back respectfully when warranted.
3. **Groups related feedback**. Multiple comments often point at the same underlying issue. Address the root cause, not each comment in isolation.
4. **Communicates clearly**. Every review thread gets a response. If you made the change, explain briefly what you did. If you disagreed, explain why with evidence. Silence is never acceptable.
5. **Keeps the PR focused**. Don't let review feedback expand scope. If a reviewer suggests something out of scope, acknowledge it and propose a follow-up ticket or PR.

## Non-Negotiable Rules

These rules apply throughout the entire workflow. They are not guidelines. Violating any of them is a workflow failure.

**No inline scripts.** Never write or execute inline scripts (Python, Node, shell scripts, etc.) to accomplish tasks. This means no `python3 -c`, no `node -e`, no heredoc scripts piped to interpreters. Use dedicated tools (Read, LSP, Glob, ls and find, Edit, Bash for CLI commands) and the `gh` CLI with `--jq` for JSON filtering. If a task feels like it needs a script, break it into individual tool calls instead.

**No skipping steps.** Every phase has a gate checklist at the end. You must complete every item on the checklist before moving to the next phase. If you feel the urge to skip ahead because things are going well, that is exactly when you are most likely to miss something.

**Stop on failure.** When any required tool, MCP server, or CLI command fails or is unavailable, STOP and report the failure to the user. Explain what failed, what step it blocked, and ask how they want to proceed. Do not silently skip the step. Do not substitute your own judgment for a tool that was supposed to provide information. The user may be able to fix the tool, or they may explicitly choose to skip that step - but that is their decision, not yours.

**No box-drawing characters in output.** Never use characters like `+`, `|`, `-` to draw ASCII table borders, and never use Unicode box-drawing characters. Use markdown tables with minimal separators (`|-|-|`) or plain bullet lists.

## AI Attribution

Public-facing messages you author (PR comments, thread replies, PR description updates) must include a standardized attribution footer so reviewers always know they are reading AI-generated text. Determine the user's GitHub username from the PR author field or `gh api user --jq '.login'`, then use this footer:

```
---
*This message was authored by an AI assistant on behalf of @{github_username}.*
```

Apply this contextually:
- **New messages**: Always include the footer.
- **Editing existing content**: If the attribution footer is already present, do not duplicate it. Only add it if it is missing.

---

## Prerequisites

Before starting, verify:

1. You are in a Git worktree on a feature branch (check `git branch --show-current`; it should not be `main`)
2. The branch has an open pull request (check with `gh pr view --json number,title,state,url`)
3. You have access to GitHub CLI (`gh`)

If any prerequisite fails, inform the user and stop.

---

## Phase 1: PR Analysis

### Gather the Full Picture

Fetch everything about the PR in parallel:

1. **PR metadata**: `gh pr view --json number,title,body,baseRefName,headRefName,url,labels,author,reviewRequests,files,additions,deletions,commits`
2. **Reviews**: `gh api repos/{owner}/{repo}/pulls/{number}/reviews` to get all review submissions (approved, changes requested, commented)
3. **Review comments** (inline code comments): `gh api repos/{owner}/{repo}/pulls/{number}/comments` to get all inline comments with file paths, line numbers, diff hunks, and thread structure (`in_reply_to_id`)
4. **PR-level comments** (conversation tab): `gh api repos/{owner}/{repo}/issues/{number}/comments` for top-level discussion comments
5. **Check runs**: `gh pr checks` to see if CI is passing or failing

To parse the JSON responses, use `gh api` with `--jq` filters. For complex filtering, make multiple `gh api` calls with different `--jq` expressions rather than trying to parse raw JSON. For example, to get all comments from a specific reviewer:

```bash
gh api repos/{owner}/{repo}/pulls/{number}/comments --jq '.[] | select(.user.login == "reviewer") | {id, path, body, line: (.line // .original_line)}'
```

### Build the Feedback Map

Organize the raw data into a structured understanding:

**For each review thread** (a top-level comment and its replies), extract:
- **Thread ID**: The `id` of the root comment (for replying later)
- **Reviewer**: Who left the comment
- **File and line**: Where the comment points
- **Content**: The full comment text and any replies
- **Status**: Whether the thread is resolved or still open
- **Type**: Categorize as one of:
  - `code_change` - Reviewer wants code modified
  - `question` - Reviewer is asking for clarification
  - `suggestion` - Reviewer suggests an alternative approach
  - `nit` - Minor style/naming preference
  - `bug` - Reviewer identified a potential bug
  - `scope_expansion` - Reviewer wants something beyond the PR's intent

**For the overall review status**, note:
- Which reviewers have approved
- Which have requested changes (and what their top-level review summary says)
- Which are still pending

### Verify Comment Coverage

After building the feedback map, verify you haven't missed anything. This step exists because it is easy to filter out comments accidentally, especially when multiple review rounds have occurred.

1. **Count total root comments per reviewer** using `--jq` and compare against your feedback map. If the counts don't match, you missed something. Go back and find it.
2. **Sort by date descending.** The most recent comments are the most likely to be unaddressed. Review these first and with extra care. Earlier comments may have already been addressed in prior commits.
3. **Check for comments on files that were subsequently renamed or deleted.** GitHub preserves comments on old file paths even after renames. These are easy to miss because they reference paths that no longer exist.
4. **Look for comments that reference other files.** A reviewer might comment on file A but say "also apply this to file B." The feedback map should capture both the explicit location and any implied locations.

### Pull Context

To evaluate feedback intelligently, you need context beyond the PR itself:

1. **Read the files** that have review comments. Don't just look at the diff; read enough of each file to understand the surrounding code.
2. **Check for linked Jira tickets** in the PR body. If a Jira link exists, fetch the ticket using `mcp__plugin_atlassian_atlassian__getJiraIssue` to understand the original requirements and acceptance criteria.
3. **Gather linked external resources** from the PR description, comments, and any linked Jira ticket:
   - **PRDs, tech specs, RFCs**: Look for linked foundational documents. These can live in either place:
     - **Google Workspace** (Docs, Sheets, Slides): Use the `gws` CLI. Run `gws --help` if unfamiliar with the tool.
     - **Confluence**: Fetch using `mcp__plugin_atlassian_atlassian__getConfluenceContent`.
   - **Figma URLs** (figma.com/design/..., figma.com/board/...): Use the Figma MCP tools (invoke the `figma-use` skill first, then `get_design_context` or `get_screenshot`) to fetch design context. This helps evaluate whether reviewer feedback aligns with the intended design.
   - **Jira attachments**: Download and read any attached files from the linked ticket.
4. **Read relevant CLAUDE.md files** in the directories where changes were made. These contain domain-specific rules that inform whether reviewer suggestions align with project conventions.
5. **Read relevant style guide sections** from `docs/style-guide/` based on the nature of the feedback.

### Present the Feedback Summary

Before planning anything, present the user with a structured summary using the template below. Use markdown tables with minimal separators (`|-|-|`) or bullet lists. Never use box-drawing or ASCII-art tables.

**Template:**

```
## PR #{number} Review Feedback

### Reviewers

**{reviewer_name}** - {APPROVED | CHANGES_REQUESTED | COMMENTED}
> "{their review summary text, if any}"

### Open Threads ({count})

| # | Thread ID | File:Line | Type | Summary |
|-|-|-|-|-|
| 1 | {id} | {file}:{line} | {type} | {one-line summary} |
| 2 | {id} | {file}:{line} | {type} | {one-line summary} |

### Already Addressed ({count})

{Brief description of what was addressed and when, grouped by reviewer. No need for a full table if this is just context.}

### My Assessment

{For each open thread or group of related threads, your evaluation: is it correct? Does it need pushback? Is it out of scope? Call out anything you think is wrong or needs discussion, with reasoning.}

### CI Status

{Passing/failing, relevant details}
```

After presenting the summary, ask the user if they want to adjust any categorizations, skip any comments, or add context you might be missing. Do not proceed until the user confirms.

### Phase 1 Gate

Before moving to Phase 2, confirm:

- [ ] All review comments discovered and categorized (counts verified)
- [ ] All relevant source files read (not just diffs)
- [ ] Linked tickets/docs fetched (or failures reported to user)
- [ ] CLAUDE.md files and style guides read for affected directories
- [ ] Feedback summary presented to user
- [ ] User has confirmed the summary and approved proceeding

---

## Phase 2: Planning

### Enter Plan Mode

Use EnterPlanMode. Everything in this phase happens in plan mode.

### Evaluate Each Thread

For every open review thread, decide the response strategy:

| Strategy | When to use |
|-|-|
| **Implement** | The feedback is correct and actionable. Plan a code change. |
| **Discuss** | The feedback needs pushback or clarification. Draft a reply explaining your position. |
| **Acknowledge** | The feedback is a nit or preference. Make the change if trivial, or explain why you prefer the current approach. |
| **Defer** | The feedback is valid but out of scope. Acknowledge and propose a follow-up. |
| **Already addressed** | The thread was resolved by a previous change or another thread's fix addresses it. Reply explaining this. |

For `Discuss` and `Defer` strategies, draft the reply text now. These don't require code changes and can be posted early.

### Plan Code Changes

For threads that require implementation:

1. **Group related threads**. If three comments all point at the same function being too complex, that's one task, not three.
2. **Identify the changes needed**. Be specific about files, functions, and what should change.
3. **Check for conflicts**. If two pieces of feedback contradict each other, flag this for the user.
4. **Separate bug threads from everything else.** Threads categorized `bug` in Phase 1 need a different plan shape, because the root cause is unknown and the team cannot write a meaningful fix task up front. Non-bug threads (suggestion, nit, scope_expansion, code_change where the reviewer pointed at the correct fix) can be planned as normal parallel tasks alongside the bug track. If there are no `bug` threads, skip the bug track entirely and use only the standard shape.

Structure the plan the same way as a ticket workflow:

**1. Overview**
Brief summary of the feedback themes and the approach. If any threads are categorized `bug`, call that out here and note that the bug track follows a serial Wave A / Wave B shape — Wave B will be defined at the start of Phase 3 once Wave A lands.

**2. Team Roster**
Which specialist agents are needed (only create roles the changes actually demand). If there is a bug track, include a test engineer (or a teammate comfortable writing tests) regardless of what the non-bug threads need; the bug track's Wave A requires one.

**3. Implementation Tasks — standard track (non-bug threads)**
Each task specifies:
- **Task ID** (T1, T2, etc.)
- **Assigned to** (agent name)
- **Review threads addressed** (which thread IDs this task resolves)
- **Description** of what to change
- **Files to modify** (specific paths)
- **Dependencies** (which tasks must complete first)
- **Acceptance criteria**

Group tasks into waves based on dependencies.

**3b. Implementation Tasks — bug track (only if any thread is `bug`)**
You cannot plan a fix for a bug whose root cause is unknown, so the bug track is two serial waves. Wave A produces the evidence needed to plan Wave B; the team leader fills Wave B in at the start of Phase 3 once Wave A lands. The bug track runs alongside the standard track — they do not block each other.

- **Wave A — Reproducer and fault localization.** One task, assigned to the test engineer. Collect every `bug` thread's observed-vs-expected description into the task brief. The task: *produce a failing artifact that reproduces the bug on the current branch — a Jest/Vitest test, a React Testing Library test, or a Storybook story paired with a test. The reproducer is the investigation tool, not a gate at the end: use it to localize where the code diverges from intent by iterating on inputs, moving assertions closer to the suspected origin, and walking up or down the call stack. Report back with (a) the committed red reproducer, (b) the file/function/input that produces the wrong value, and (c) a short description of the code path traced.*
  Wave A acceptance criteria:
  - A reproducer is committed and demonstrably red on the current branch.
  - The report identifies the localized fault with specificity a fix task can act on.
  - If the teammate cannot make the reproducer fail, or localizes something they cannot explain with near-certainty from the code, they report blocked. "I don't know" is a valid outcome and the team leader surfaces it to the user — no guessing, no defensive patch.

- **Wave B — Fix and verify (to be written after Wave A).** Leave this marked "TBD — filled in at the start of Phase 3 once Wave A reports." Note that Wave B will assign a fix task to the teammate whose domain the localized fault lives in; will use Wave A's committed reproducer as the acceptance criterion (must flip red → green, full affected test suite must pass); and will include any adjacent tasks that only become visible after localization.

**4. Review Assignments**
Cross-review between agents, same rules as the ticket workflow. Specify which agent reviews which other agent's work. Implementation agents must remain alive until cross-review is complete. With one implementer, record that Phase 4 Step 3 is the review.

**5. Verification Steps**
Commands to run after implementation. The repo uses pnpm. Run every command from the repo root through `--filter @attentive/<pkg>`, one command per Bash call, never with `cd`; a root-level `test`, `lint`, or `check-types` across all packages is banned. Scope `test`, `lint`, and `format:check` to the changed files as step 3 shows; `check-types` runs package-level and is the exception. Run test commands one at a time.
1. **Generate first**: `pnpm --filter @attentive/<pkg> relay:compile`. After an install, a rebase, or any flag-fragment edit, also run `pnpm --filter @attentive/data generate` and then `pnpm --filter @attentive/mock-data generate` (several minutes each).
2. **Auto-fix**: `pnpm --filter @attentive/<pkg> lint --fix <changed files>`. `format:write` ignores path arguments and reformats the whole package; run `pnpm --filter @attentive/<pkg> format:write` once, when no teammate is mid-edit.
3. **Verify, scoped to the changed files**: `pnpm --filter @attentive/<pkg> format:check <changed files>`, `pnpm --filter @attentive/<pkg> lint <changed files>`, `pnpm --filter @attentive/<pkg> test <changed test files>`, then `pnpm --filter @attentive/<pkg> check-types` with no file arguments (tsc ignores tsconfig when given files). `format:check` and `lint` also scan the whole package and can report files outside the passed paths; read the file list.

**6. GitHub Response Plan**
Map each review thread to its planned response:
- Thread ID, reviewer, planned strategy, and draft reply text
- For `Implement` threads: which Task ID addresses it, and what the reply will say after implementation
- For `Discuss`/`Defer`/`Acknowledge` threads: the exact reply text

### Present the Plan

Exit plan mode. Present the plan to the user with:
- The response strategy for each reviewer's feedback
- The implementation task breakdown with waves
- Draft replies for discussion/deferral threads
- Any conflicts or concerns

Ask for approval. If the user requests changes, re-enter plan mode, revise, and present again. Do not proceed until the user explicitly approves.

### Phase 2 Gate

Before moving to Phase 3, confirm:

- [ ] Every open thread has a response strategy
- [ ] Implementation tasks defined with clear acceptance criteria
- [ ] Review assignments defined (who reviews whom)
- [ ] Plan presented to user
- [ ] User has explicitly approved the plan

---

## Phase 3: Implementation

### Post Discussion Replies First

Before any code changes, post replies to threads that don't require implementation (`Discuss`, `Defer`, `Acknowledge`, `Already addressed`). Use the GitHub API to reply to each thread. Write each reply to a file in the session scratchpad first; `-f body=@file` posts the literal string "@file", only `-F` reads the file.

```bash
gh api repos/{owner}/{repo}/pulls/{number}/comments \
  --method POST \
  -F body=@<file> \
  -F in_reply_to=<thread_root_comment_id>
```

This gives reviewers early signal that their feedback is being addressed and opens dialogue on points of disagreement while code changes happen in parallel.

### Delegate Implementation

The session has one implicit team, formed on the first teammate spawn; there is no create step.

For each wave of implementation tasks, spawn teammates using the Agent tool with `name` set:

- Use a descriptive `name` matching the team roster
- Include full task context: what to change, which files, acceptance criteria, the review comment text that motivated the change
- Point agents to relevant CLAUDE.md files and style guide sections
- Remind agents of coding standards: no `any`, no type casting, hooks in their own files, no prop drilling

### Verify Wave Completion — standard track

When all agents in a wave report back:
1. Verify outputs meet task acceptance criteria
2. If an agent's work is incomplete, re-delegate with specific feedback. After two re-delegations still incomplete, stop and surface it to the user.
3. Advance to the next wave when the current one is fully verified

### Execute the Bug Track (only if any thread is `bug`)

The bug track runs in parallel with the standard track's waves — they do not block each other until final verification.

1. **Dispatch Wave A.** SendMessage the test engineer the Wave A task with the reproducer-and-localization brief from the plan. Include every `bug` thread's observed-vs-expected text so the teammate has the full signal.

2. **Verify Wave A — this is a real gate, not a formality.** When the teammate reports back, the team leader does the following before touching Wave B:
   - Read the committed reproducer. Run it. Confirm it fails on the current branch for the reason the teammate claims.
   - Read the teammate's localization report. Follow the code path they described. Confirm the file/function/input they named is actually where the bad value originates, not a symptom downstream of it.
   - If the reproducer does not fail, or the localization does not hold up, SendMessage the teammate with specifics and iterate. Do not proceed until both hold. After two rounds (see Phase 4 Step 2 for the bound's source) without both holding, take the exit ramp in step 3.

3. **Exit ramp: "I don't know."** If Wave A reports blocked — either "I cannot make it fail" or "I localized something but cannot explain it with near-certainty from the code" — do not plan a fix. Surface the teammate's trace, ruled-out hypotheses, and evidence needs to the user, along with the original review threads that raised the bug. Ask how to proceed. Acceptable paths: gather more context from the reviewer (ask them on the thread for repro steps, inputs, or environment), re-dispatch Wave A; narrow the scope; or reply to the reviewer explaining why you cannot reproduce and asking for help. Unacceptable paths: guessing a root cause, shipping a defensive check that hides the symptom.

4. **Plan Wave B now that you have facts.** With the localized fault in hand, write the Wave B task(s) in the plan document. Typically this is one fix task assigned to the domain specialist whose code the fault lives in, plus any follow-on tasks that only became visible after localization. Acceptance criteria always include: Wave A's reproducer flips red → green, and the full affected test suite passes.

5. **Dispatch Wave B.** SendMessage the assigned teammates with the Wave B task(s).

6. **Verify Wave B — red → green is the only acceptable signal.** When Wave B reports back, the team leader runs Wave A's reproducer. It must now pass. "The code looks right" and "should work now" are not verification. If the reproducer does not flip, SendMessage the teammate with specifics and iterate. After two rounds without a flip, stop and surface it to the user. The reproducer stays committed in the PR — it is part of the fix, not scaffolding.

### Phase 3 Gate

Before moving to Phase 4, confirm:

- [ ] All discussion/defer/acknowledge replies posted
- [ ] All implementation waves completed and outputs verified
- [ ] All implementation agents are still alive (do NOT shut them down yet - they are needed for cross-review)

---

## Phase 4: Verification & Internal Review

This phase has three sequential steps. All three must complete before any commit or push action. Do not parallelize review with committing. Do not commit "while waiting for review." The purpose of review is to catch problems before they are committed.

### Step 1: Run Verification

Run the plan's Verification Steps (Phase 2, item 5) as written, package-scoped through `--filter` from the repo root.

If verification fails after auto-fix, diagnose the issue. If it is a code problem introduced by an implementation agent, delegate the fix back to that agent using SendMessage (they retain context from their original work). Then re-run the full verification sequence. After two fix rounds still failing, stop and surface it to the user. Do not manually edit files to fix lint or format issues when auto-fix tools exist for that purpose.

### Step 2: Cross-Review

No reviewer agents are spawned. The implementers review each other per the plan's review assignments. For each assignment, SendMessage the reviewing implementer a brief that includes: the exact files to review (read in full, not as diffs), the task context and acceptance criteria, and the applicable standards. Ask for specific, actionable feedback with file paths and line numbers, or an explicit approval.

Send all review briefs in one turn. Changes requested means SendMessage the feedback to the owning implementation teammate (they retain full context), then SendMessage the same reviewer for re-review with the previous comments attached. Repeat until approval. A finding still open after two fix rounds (the thrashing threshold the jira-ticket-workflow and work-the-branch skills use) stops the loop: surface it to the user before going on. All internal reviews must pass before proceeding. With one implementer there are no cross-review assignments; Step 3 is the review.

### Step 3: Independent Code Review

After cross-review passes, perform your own independent review of every changed file. Read each file in full. Check for:
- Type safety (no `any`, no type casting)
- Adherence to project conventions (hooks in own files, no prop drilling, etc.)
- Correctness relative to the review feedback (did the change actually address what the reviewer asked for?)
- Regressions or unintended side effects

If you find issues, delegate fixes back to the relevant implementation agent, then re-run verification and re-review. The same two-round bound applies.

### Phase 4 Gate

Before moving to Phase 5, confirm all three steps completed:

- [ ] Verification passed (format, lint, types, tests)
- [ ] Cross-review completed and all feedback resolved
- [ ] Independent code review completed with no outstanding issues
- [ ] Implementation agents still alive (shut them down AFTER committing, not before)

---

## Phase 5: Respond & Push

### Commit and Push

1. Run `git status` to see all changed files
2. Stage files explicitly by name (never `git add -A` or `git add .`)
3. Do NOT stage anything from `__generated__/` directories
4. Write the commit message:
   ```
   <ticket-or-context>: Address PR review feedback

   <brief description of what changed and why>

   <the Co-Authored-By attribution line for the current model, as given in the session's system reminder>
   ```
   If a Jira ticket is linked in the PR, use that as the prefix. Otherwise use a descriptive prefix based on the PR title.
5. Push to the current branch: `git push`

### Reply to Implementation Threads

Now that the code is pushed, reply to every review thread that was addressed by code changes. For each thread, write the reply to a file in the session scratchpad, then:

```bash
gh api repos/{owner}/{repo}/pulls/{number}/comments \
  --method POST \
  -F body=@<file> \
  -F in_reply_to=<thread_root_comment_id>
```

Each reply should briefly explain what was changed and why. Reference the specific approach taken. Be concise but informative. Examples of good replies:

- "Good catch. Moved the state derivation into a `useMemo` to avoid the re-render on every keystroke."
- "Updated to use `Stack` with `$space4` gap instead of manual margin. Also applied this to the sibling component since it had the same pattern."
- "I see the concern, but this is intentional: the `useEffect` dependency array excludes `onClose` because it's unstable (re-created on every parent render). Added a comment explaining why."

Avoid generic replies like "Fixed" or "Done". The reviewer should understand what changed without having to re-read the diff.

### Re-examine the PR Description

1. Read `~/.work/rules/pr-descriptions.md` and `~/.work/rules/pr-body-editing.md`; they govern every word of the description. Read the Confluence guide "How to Write a Good Pull Request" at `https://attentivemobile.atlassian.net/wiki/spaces/UI/pages/3172401183/How+to+Write+a+Good+Pull+Request` with `mcp__plugin_atlassian_atlassian__getConfluenceContent` for what surrounds the description: draft status, PR size, self-review, screenshots, inline PR comments.
2. Read the live body: `gh pr view {number} --json body --jq '.body'`.
3. Examine the entire description. Every Summary sentence states a change the final diff contains. Nothing describes a pre-review version. Testing reflects the tests as they now stand. Sentences are at most 20 words, paragraphs at most 3 sentences, the Summary at most 5 paragraphs, all in plain English. A change in one section ripples into the others; trace each ripple and fix it in the same edit. A Demo note made stale by the change is named in the report to the user and left for him; Demo is his.
4. Write the corrected body to a file in the session scratchpad and run `gh pr edit {number} --body-file <file>`. Never append a bullet or an "Additional changes" section. Never pass `--body` inline; the `pr-body-limits-block` hook denies it and denies a body over the limits. A denial means rewrite, never route around.

### Leave a Top-Level Comment

After all thread replies are posted, write the summary to a file in the session scratchpad, then leave a single top-level comment on the PR:

```bash
gh pr comment {number} --body-file <file>
```

The summary should be brief and structured:

```
Addressed review feedback:

- [Brief description of change 1]
- [Brief description of change 2]
- [Brief description of change 3]

[If any threads were deferred: "Deferred X to a follow-up: <brief reason>"]
```

### Re-request Reviews

After all replies are posted, re-request reviews from every reviewer you responded to. This notifies them that their feedback has been addressed and the PR is ready for another look.

```bash
gh pr edit {number} --add-reviewer {reviewer1},{reviewer2},...
```

Use the GitHub usernames collected during Phase 1. Include every reviewer who had open threads, regardless of whether you implemented their feedback or pushed back.

### Transition the Jira Ticket

Move the linked Jira ticket to Code Review only when both approvals are present on the PR. Until both hold, leave the ticket in its current status.

1. **Codex has approved.** Its most recent review shows no open P1/P2/P3 findings and no unresolved inline change requests (the "no major issues" state, not merely a COMMENTED review). A review still carrying actionable findings is not an approval.
2. **The user has approved in a comment.** Read the PR's comments and judge, in context, whether the user has signalled approval to move forward. This is your judgment, not a keyword match: "looks good, ship it" or a plain "approved" counts; a question, a nit, or no comment does not. The user authors this PR, so GitHub blocks a formal Approve review; the signal is always a plain comment.

When and only when both hold:
1. Find the transitions operation with `mcp__plugin_atlassian_atlassian__discover` (goal: list transitions for a Jira issue) and run it with `mcp__plugin_atlassian_atlassian__executeRead`
2. Identify the Code Review transition (states like "Code Review", "In Review", "Ready for Review", "PR Submitted")
3. Execute it: `mcp__plugin_atlassian_atlassian__transitionJiraIssue`

If either approval is missing, do not transition, and say so in the report.

### Report to the User

Inform the user that all work is complete:

- Confirmation that changes were pushed
- How many review threads were responded to, broken down by strategy (implemented, discussed, deferred, etc.)
- Any threads where you pushed back or deferred, so the user can follow up if needed
- Which reviewers were re-requested for review
- Any Demo note left stale for the user to fix
- Whether the ticket moved to Code Review (both Codex and you approved), or that it stays in its current status pending one or both approvals
- Any CI checks the user should monitor
- Link to the PR

### Shutdown the Team

After all work is complete and reported:

1. Send a shutdown request to each teammate: `SendMessage({to: "<name>", message: {type: "shutdown_request"}})`
2. Wait for all teammates to acknowledge and shut down
