# PR Descriptions

Chance, 2026-09-10, in chat, verbatim: "When updating PR descriptions, the entire description must be under examination. Simply adding to it is not allowed. If the description is somehow changing then there are likely second order and third order effects on the rest of the description which must be also dealt with." And: "When writing and/or updating PR descriptions, the entire description must accomplish its objectives in as few words as possible without making sacrificies to legibility or context. The description should be written using plain english and without jargon. Paragraphs should be no longer than 2-3 sentences and sentences should be no longer than 15-20 words."

Consult these rules BEFORE drafting or editing any PR body; never draft from working memory. `~/.work/hooks/pr-body-limits-block.js` denies a `gh pr create` or `gh pr edit` whose body breaks the measurable limits below or the Prose Style bans in `~/.work/CLAUDE.md` (em and en dashes, banned vocabulary, -ly intensifiers). A denial means rewrite, never route around.

## The whole description, every time

- Writing or updating, the unit of work is the entire description. Read all of it. Judge every sentence against these rules. Adding a sentence, a bullet, or an "Additional changes" section to an existing description is banned.
- A change anywhere ripples. A changed Summary sentence can make another Summary sentence redundant, a Testing bullet stale, or a Demo note wrong. Trace every ripple and fix it in the same edit.
- Who owns what: Summary and Testing are AI-written and get edited like any other AI text. Demo is Chance's. When a change makes a Demo note stale, name the note in the round report and leave it for him.
- Mechanics for an existing PR live in [pr-body-editing](pr-body-editing.md): read the live body, edit that text, write it back from a file.

## Length and plain English

- The description does its job in as few words as possible, with no loss of legibility or context. The limits below are ceilings, never targets: every sentence earns its place by carrying behavior or a choice the reader needs, and a sentence that carries neither is cut. Incident: `~/.work/incidents/2026-10/2026-10-01-pr-body-filled-to-ceiling/`.
- Plain English, no jargon. Name a file, symbol, or flag when the reader has to go there; describe the rest in words.
- Sentences are no longer than 15-20 words; the hook denies above 20. Paragraphs are no longer than 2-3 sentences; the hook denies above 3. A list item counts as a paragraph.
- The Summary is no longer than 4-5 paragraphs (Chance, 2026-09-10, ruling on the round-1 plan); the hook denies above 5.

## Summary content

- The Summary answers two questions in plain English: what does this PR do for the product or for the modules that consume it, and which choices did the author make without a precedent. Chance, 2026-10-01, on PR #37039: "It should say what the PR is actually DOING, not what CHANGED in the code. It should also include any choices made that are different from the norm or have no existing patterns to follow." A list of code changes is what the diff already shows, so it is never the Summary.
- Behavior paragraphs say what a user or a consuming module gets, under which flag, and what stays as it is with the flag off. Name a file or symbol only when the reader has to go there.
- One paragraph starts "Choices without a precedent:" and names each departure from the norm, each with its reason in one short sentence. Before writing one, prove the absence of a precedent in the package with LSP or a read of the sibling modules; a pattern that already exists is never listed. A PR with no such choice has no such paragraph.
- Still banned, checked sentence by sentence before posting: stack context naming other PRs by number; review guidance (a sentence whose only job is preempting a reviewer question); before/after framing ("replacing", "instead of", "previously", "no longer", "now Xes"), state the end state instead; value enumerations, consumer or file lists, and parentheticals the diff already shows.
- Make phrasing self-contained: "that has a planned V2 counterpart", not "with a V2 counterpart in PRs 1-5".

## Template and the Confluence guide

- Jira Issue, Summary, Demo, and Testing; exactly those four sections, no invented subsections. Demo and Testing stay separate.
- The team's Confluence guide "How to Write a Good Pull Request" still governs everything around the description: open as a draft while the PR is still being worked on, keep the PR small, review your own diff, screenshots or GIFs in Demo (before and after when changing behavior), inline PR comments for dense hunks, offline discussion for debates. Its asks for rationale and design-choice explanations do not apply to the description text; these rules win there.

## Gold standard

Summary shape under the 2026-10-01 ruling, from PR #37039 (USP-835 data layer): "Give the profile detail pages one shared way to read a channel's subscription status. A channel is Subscribed, Not subscribed, Never subscribed or Not captured. Contact subscriptions now count, so profiles that never opted in to marketing get a status." Then the rule the code applies, in one paragraph. Then: "Choices without a precedent: the status rule takes the subscription type as a plain string. Relay's string union does not fit the generated enum without a cast."

The 2026-09-10 standard ("Copy every V1 file in `libs/crm/src/pages/SubscriberDetail/` that has a planned V2 counterpart to a `V2` sibling. ...") listed code changes and is retired as a shape; its sentence and paragraph limits still hold.
