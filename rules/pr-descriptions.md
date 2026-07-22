# PR Descriptions

- The Summary answers one question: what does this PR do. Nothing else. No "why this exists", no stack context referencing other PRs by number (meaningless to a reviewer without stack context: if they need it they have it, and if they don't, the description won't give it to them), no review guidance, no before/after framing. Write the mechanical "what changed" only; the global Prose Style rules keep it terse.
- Check every Summary sentence against each ban BEFORE posting, not by paraphrasing the rules but by applying them:
  - Before/after framing includes "replacing", "instead of", "previously", "no longer", "now Xes". State the end state: "A imports from B", not "A imports from B, replacing C".
  - Review guidance includes any sentence whose only job is preempting a reviewer question (e.g. explaining why a test scenario uses a particular value). If it explains rather than states a change, cut it.
  - Rationale includes trailing "so ..." outcome clauses and "per the ticket/spec" references.
  - After writing, reread each bullet asking: does this sentence state a change the diff contains? If it explains, justifies, compares, or guides, delete it.
- ONE short paragraph of one to a few imperative sentences stating the diff's changes, nothing else; imperative shape alone is not enough. The Summary names each change once, at the highest altitude that still says what changed. Cut anything the diff already shows: value enumerations (name the count, not the identifier names), consumer/file lists, parentheticals like "(barrel-exported)" or "(first occurrence wins)", and full paths where the symbol name identifies the change.
- Make phrasing self-contained: "that has a planned V2 counterpart", not "with a V2 counterpart in PRs 1-5".
- The PR template is Jira Issue, Summary, Demo, and Testing; exactly those four sections, no invented subsections (no "What is in here", "Why this exists", "How to review", "Stack"). Demo and Testing sections stay separate; never rewrite the user's Testing checklists, which reflect actual verification work and are theirs.
- Consult these rules BEFORE drafting any PR body; never draft from working memory.
- Gold-standard approved Summary, for shape: "For every V1 file in `libs/crm/src/pages/SubscriberDetail/` that has a planned V2 counterpart, copy the V1 source to a `V2` sibling with mechanical renames only (filename, exported symbol, GraphQL names defined in the file, matching generated import paths). Add each new file to `libs/crm/.eslintrc`'s `import/no-unused-modules.ignoreExports`."
