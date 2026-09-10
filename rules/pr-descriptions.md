# PR Descriptions

Chance, 2026-09-10, in chat, verbatim: "When updating PR descriptions, the entire description must be under examination. Simply adding to it is not allowed. If the description is somehow changing then there are likely second order and third order effects on the rest of the description which must be also dealt with." And: "When writing and/or updating PR descriptions, the entire description must accomplish its objectives in as few words as possible without making sacrificies to legibility or context. The description should be written using plain english and without jargon. Paragraphs should be no longer than 2-3 sentences and sentences should be no longer than 15-20 words."

Consult these rules BEFORE drafting or editing any PR body; never draft from working memory. `~/.work/hooks/pr-body-limits-block.js` denies a `gh pr create` or `gh pr edit` whose body breaks the measurable limits below or the Prose Style bans in `~/.work/CLAUDE.md` (em and en dashes, banned vocabulary, -ly intensifiers). A denial means rewrite, never route around.

## The whole description, every time

- Writing or updating, the unit of work is the entire description. Read all of it. Judge every sentence against these rules. Adding a sentence, a bullet, or an "Additional changes" section to an existing description is banned.
- A change anywhere ripples. A changed Summary sentence can make another Summary sentence redundant, a Testing bullet stale, or a Demo note wrong. Trace every ripple and fix it in the same edit.
- Who owns what: Summary and Testing are AI-written and get edited like any other AI text. Demo is Chance's. When a change makes a Demo note stale, name the note in the round report and leave it for him.
- Mechanics for an existing PR live in [pr-body-editing](pr-body-editing.md): read the live body, edit that text, write it back from a file.

## Length and plain English

- The description does its job in as few words as possible, with no loss of legibility or context.
- Plain English, no jargon. Name a file, symbol, or flag when the reader has to go there; describe the rest in words.
- Sentences are no longer than 15-20 words; the hook denies above 20. Paragraphs are no longer than 2-3 sentences; the hook denies above 3. A list item counts as a paragraph.
- The Summary is no longer than 4-5 paragraphs (Chance, 2026-09-10, ruling on the round-1 plan); the hook denies above 5.

## Summary content

- The Summary answers one question: what does this PR do. Nothing else. No "why this exists", no design-choice explanations, no stack context naming other PRs by number, no review guidance, no before/after framing. State the mechanical "what changed" only.
- Check every Summary sentence against each ban BEFORE posting, by applying the bans, not by paraphrasing them:
  - Before/after framing includes "replacing", "instead of", "previously", "no longer", "now Xes". State the end state: "A imports from B", not "A imports from B, replacing C".
  - Review guidance includes any sentence whose only job is preempting a reviewer question. If it explains rather than states a change, cut it.
  - Rationale includes trailing "so ..." outcome clauses and "per the ticket/spec" references.
  - After writing, reread each sentence asking: does it state a change the diff contains? If it explains, justifies, compares, or guides, delete it.
- Imperative sentences stating the diff's changes; imperative shape alone is not enough. Name each change once, at the highest altitude that still says what changed. Cut anything the diff already shows: value enumerations (name the count, not the identifier names), consumer or file lists, parentheticals like "(barrel-exported)", and full paths where the symbol name identifies the change.
- Make phrasing self-contained: "that has a planned V2 counterpart", not "with a V2 counterpart in PRs 1-5".

## Template and the Confluence guide

- Jira Issue, Summary, Demo, and Testing; exactly those four sections, no invented subsections. Demo and Testing stay separate.
- The team's Confluence guide "How to Write a Good Pull Request" still governs everything around the description: open as a draft while the PR is still being worked on, keep the PR small, review your own diff, screenshots or GIFs in Demo (before and after when changing behavior), inline PR comments for dense hunks, offline discussion for debates. Its asks for rationale and design-choice explanations do not apply to the description text; these rules win there.

## Gold standard

Approved Summary shape, re-cut to the sentence limit on 2026-09-10: "Copy every V1 file in `libs/crm/src/pages/SubscriberDetail/` that has a planned V2 counterpart to a `V2` sibling. Renames are mechanical only: filename, exported symbol, GraphQL names defined in the file, and the matching generated import paths. Add each new file to the `import/no-unused-modules.ignoreExports` list in `libs/crm/.eslintrc`."
