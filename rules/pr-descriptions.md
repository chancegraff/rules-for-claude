# PR Descriptions

Chance, 2026-09-10, in chat, verbatim: "When updating PR descriptions, the entire description must be under examination. Simply adding to it is not allowed. If the description is somehow changing then there are likely second order and third order effects on the rest of the description which must be also dealt with." And: "When writing and/or updating PR descriptions, the entire description must accomplish its objectives in as few words as possible without making sacrificies to legibility or context. The description should be written using plain english and without jargon. Paragraphs should be no longer than 2-3 sentences and sentences should be no longer than 15-20 words."

Consult these rules BEFORE drafting or editing any PR body; never draft from working memory. `~/.work/hooks/pr-body-limits-block.js` denies a `gh pr create` or `gh pr edit` whose body breaks the measurable limits below or the Prose Style bans in `~/.work/CLAUDE.md` (em and en dashes, banned vocabulary, -ly intensifiers). A denial means rewrite, never route around.

## The whole description, every time

- Writing or updating, the unit of work is the entire description. Read all of it. Judge every sentence against these rules. Adding a sentence, a bullet, or an "Additional changes" section to an existing description is banned.
- A change anywhere ripples. A changed Summary sentence can make another Summary sentence redundant, a Testing bullet stale, or a Demo note wrong. Trace every ripple and fix it in the same edit.
- Who owns what: Summary and Testing are AI-written and get edited like any other AI text. Demo is Chance's. When a change makes a Demo note stale, name the note in the round report and leave it for him.
- Mechanics for an existing PR live in [pr-body-editing](pr-body-editing.md): read the live body, edit that text, write it back from a file.

## Length and plain English

- The description does its job in as few words as possible, with no loss of legibility or context. The limits below are ceilings, never targets: every sentence earns its place by carrying behavior or a choice the reader needs, and a sentence that carries neither is cut.- Plain English, no jargon. Name a file, symbol, or flag when the reader has to go there; describe the rest in words.
- Write each sentence the way you would say it to a teammate on a call. A sentence a reader has to read twice is rewritten, even when it is correct. Sean, 2026-10-14, on "a card for a channel the company does not have keeps its value and shows no pill" and on "identifiers carry no subscription type": the information is right, the reader still has to stop and ask what it means.
- Where a stated fact invites "why", give the reason when it is known, in one short sentence: identifiers collected for an email-only or SMS-only company carry no subscription type. Where the reason is unknown, say so or leave the fact bare; never invent one (Sean, 2026-10-14).
- Sentences are no longer than 15-20 words; the hook denies above 20. Paragraphs are no longer than 2-3 sentences; the hook denies above 3. A list item counts as a paragraph.
- The Summary is no longer than 4-5 paragraphs (Chance, 2026-09-10, ruling on the round-1 plan); the hook denies above 5.

## Summary content

- The Summary answers one question in plain English: what does this PR do for the product or for the modules that consume it. Chance, 2026-10-01, on PR #37039: "It should say what the PR is actually DOING, not what CHANGED in the code." A list of code changes is what the diff already shows, so it is never the Summary.
- Behavior is told by flag state (Sean, 2026-10-14). With the flag on, say what a user or a consuming module sees. With the flag off, say that the surface behaves as it does today. A PR with no flag says what the reader gets once it lands. Name a file or symbol only when the reader has to go there.
- A choice without a precedent, a departure from the norm or a call with no existing pattern to follow, is never a Summary paragraph. It goes as an inline comment on the PR at the line where it lives, saying what was considered and why it lost (Chance, 2026-10-15 00:42 UTC, choosing the inline comment over the paragraph Sean offered as the other way). A reviewer reads the description, then the code, and by the third file the description is out of mind; the inline comment meets them at the line. Before claiming a choice has no precedent, prove it in the package with LSP or a read of the sibling modules; a pattern that already exists is never claimed.
- Still banned, checked sentence by sentence before posting: stack context naming other PRs by number; review guidance (a sentence whose only job is preempting a reviewer question); before/after framing ("replacing", "instead of", "previously", "no longer", "now Xes"), state the end state instead; value enumerations, consumer or file lists, and parentheticals the diff already shows. The flag-off sentence states today's behavior as a present state, never as a "previously".
- Make phrasing self-contained: "that has a planned V2 counterpart", not "with a V2 counterpart in PRs 1-5".

## Inline PR comments on the self-review

On the self-review before review is requested, every place a reviewer might ask why it is this way and not another gets an inline PR comment: the alternative considered and the reason it lost, in one or two sentences. These are review comments on the PR, never comments in the code. The Confluence guide already asks for inline PR comments on dense hunks; this widens that to every "why" (Sean, 2026-10-14: "whenever you review your own code, look for places where someone might question why I made this decision").

## Demo

- Demo is Chance's section: he records the screenshots and videos himself, following [manual-test-demo-steps](manual-test-demo-steps.md). The lead writes the section as placeholders, one per screenshot or video, each a one-line title naming the state it shows ("email channel, subscribed", "contact subscription only"), for him to paste the media under (Chance, 2026-10-15 00:42 UTC; the titles are Sean's ask of 2026-10-14).
- A preview link in Demo carries the hash of the PR's head. At every push, the lead reads each link's hash against the new head, names every stale link in the round report with the new URL, and leaves the edit to him.

## Testing

- Testing tells a reviewer how to test the change, in order: the sneak preview link, the feature flags to turn on, the A/B arm, the company or user whose data the test needs, then the steps. A line that lists the automated tests the PR adds is not Testing; the diff shows those.
- This shape is ahead of the team's written guidance. Sean, 2026-10-14: not official yet, he will propose it to the team, and staying ahead of it is the aim. These rules adopt it now.

## Template and the Confluence guide

- Jira Issue, Summary, Demo, and Testing; exactly those four sections, no invented subsections. Demo and Testing stay separate.
- The team's Confluence guide "How to Write a Good Pull Request" still governs everything around the description: open as a draft while the PR is still being worked on, keep the PR small, review your own diff, screenshots or GIFs in Demo (before and after when changing behavior), inline PR comments for dense hunks and for every choice without a precedent, offline discussion for debates. Its asks for rationale and design-choice explanations do not apply to the description text; these rules win there.

## Gold standard

Summary shape under the 2026-10-01 ruling, from PR #37039 (USP-835 data layer): "Give the profile detail pages one shared way to read a channel's subscription status. A channel is Subscribed, Not subscribed, Never subscribed or Not captured. Contact subscriptions now count, so profiles that never opted in to marketing get a status." Then the rule the code applies, in one paragraph. The choice it then listed in a "Choices without a precedent:" paragraph (the status rule takes the subscription type as a plain string) now goes as an inline PR comment at its line, never as a paragraph.

Behavior paragraphs under Sean's 2026-10-14 feedback open on the flag state: "With ENABLE_NON_SUBS_UI on, a channel card the company does not use keeps its value and shows no status pill. With it off, the cards look as they do today."

The 2026-09-10 standard ("Copy every V1 file in `libs/crm/src/pages/SubscriberDetail/` that has a planned V2 counterpart to a `V2` sibling. ...") listed code changes and is retired as a shape; its sentence and paragraph limits still hold.
