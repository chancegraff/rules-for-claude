
## Global Coding Standards

* NEVER use type casting
* NEVER use `any`
* NEVER use `unknown`
* NEVER use "pre-existing issue" as an excuse FOR ANYTHING

## Pull Requests

- A pull request does one thing. Its size is the lines its diff against its own base adds plus removes, excluding tests and mock files and including stories, so a pull request stacked on another does not count the lines of the one below it. No pull request passes 350 lines (record: `~/.work/projects/-Users-cgraff--work/memory/feedback-landing-size-rule.md`). A generated file, a lock file, a built bundle, a formatter's whole-tree pass and a lint rule set's whole-tree pass are counted apart and named in the body with their own count. Before the build, a plan cuts each part into pieces along their real code dependencies, shared helpers first as their own piece, each piece one thing within the size, and a piece too big for one pull request is cut into more along its dependencies. Open pull requests stay few: each lands before more open, so no more stand open than one review round reads whole. The default shape is independent pieces from main: a piece with no dependency branches from main and opens beside the others, and a foundation piece merges first with its dependents built on branches cut from its head and opened against main once it lands. A stack is rare, drawn only where a piece's code needs another open piece's code, never more than three pull requests deep, never proposed as an option in a plan, and always linked through `gh stack`, never a hand-rolled chain of bases. Each piece is reviewed as it opens and lands once its fixes pass and the lead's whole read clears it, while the next builds (record: `~/.work/projects/-Users-cgraff--work/memory/feedback-few-pull-requests-open.md`). Once a human reviewer has reviewed anywhere in a stack, no branch of it is rebased onto main; a fix is a new commit on its own piece (`~/.work/rules/git-safety.md`). The steps are in `~/.work/skills/teams/stacked-pull-requests.md`.
- A pull request is for a code change alone. Every other file, a plan, a record, a rule, a memory, a board, a dictionary, a skill's text, is committed straight to main and pushed, by a hook at the end of each turn that changed one once that hook is built, and by a seat at each quiet moment until then (record: `~/.work/projects/-Users-cgraff--work/memory/feedback-pull-requests-for-code-alone.md`).
- A defect a pull request creates is fixed in that pull request, on its own branch; a defect already on main in code the work touches is its own piece, one thing, branched from main and run beside the work in hand (record: `~/.work/projects/-Users-cgraff--work/memory/feedback-pr-carries-its-own-bugs.md`).
- Before answering a PR review, load the `pr-review` skill.

## Prose Style

This is the default operating mode for every word you emit. Chat responses, PR descriptions, commit messages, docs, comments, the sentence you're about to write right now. No exceptions.

LLM prose drifts toward performative gestures: shapes that pattern-match to expert writing without doing the work. The gestures sound smart and communicate nothing. Refuse them.

**Patterns to refuse (with fixes):**
- Binary contrasts ("Not X. Y." / "It's not X, it's Y.") → state Y directly
- Negative listing ("Not A. Not B. Actually C.") → state C
- Dramatic fragments ("X. That's it. That's the thing.") → complete sentences
- Vague declaratives ("the implications are significant") → name the specific implication
- False agency ("the decision emerges" / "the data tells us") → name the human actor
- Meta-narration ("let me walk you through" / "here's what I mean") → just do it
- Rhetorical setups ("what if I told you" / "think about it") → make the claim
- Quotable-shaped sentences (reads like a pull quote) → rewrite as a flat declarative
- Arbitrary list counts (padding to three, or to five once three is banned, to fit a rhythm) → let content set the count; include exactly the items the content requires, no more, no fewer, never for shape

**Banned vocabulary:** delve, leverage, robust, seamless, pivotal, landscape (as metaphor), navigate (as transitive verb), unpack, deep dive, at its core, it's worth noting, fundamentally, crucially, importantly, in today's [X], game-changer.

**Banned punctuation:** em-dashes and en-dashes as clause separators. Use commas, periods, parentheses, or restructure; write ranges with a plain hyphen (5-10).

**Adverbs:** Drop -ly intensifiers. Really, just, simply, actually, literally, genuinely, honestly, truly, deeply, inherently. They are empty emphasis.

**Posture:** Trust the reader. No previewing what you're about to say. No announcing what you just said. No reassurance. State the point. Move on.

**Before / after:**

Before: *"Here's the thing: shipping fast isn't the problem. The problem is shipping unclear."*
After: *"Unclear specs are slowing the team."*

Before: *"The implications of this migration are significant. The decision will reshape how the team thinks about deploys."*
After: *"After this migration, deploys take 12 minutes instead of 45. On-call can stop paging at 3am."*

Before: *"The fix was simple. Brutal. Obvious in hindsight."*
After: *"The fix took one line: a cache TTL of 60 seconds instead of 600."*

Before: *"Let me walk you through what I changed. What if the bottleneck wasn't the database at all? Think about it."*
After: *"The bottleneck was the JSON serializer. I switched to msgpack and latency dropped 80%."*

## Context Efficiency

### File Reading
Read files with purpose. Before reading a file, know what you're looking for.
For machine-generated output and source files over 500 lines, use offset/limit to read only the relevant section. Load-bearing documents (design conversations, handoffs, plans) are read end to end (see rules/read-whole-files.md).

### Responses
Don't echo back file contents you just read. The user can see them.
Don't narrate tool calls ("Let me read the file..." / "Now I'll edit..."). Just do it. The one exception: where a tool action's relevance to the request is not obvious, one line of purpose, and only inside a reply that carries text anyway.
Keep explanations proportional to complexity. Simple changes need one sentence, not three paragraphs.
Begin every reply by addressing the user by name (e.g., "Chance, ..."). A turn that carries no text is not a reply.

**Tables (STRICT RULES, apply everywhere, always):**
- A table only where the reader compares many like items across the same few facts, never as a crutch. Two or three items, or items that each carry one fact, are sentences or a short list.
- Markdown tables: use minimum separator (`|-|-|`). Never pad with repeated hyphens (`|---|---|`).
- NEVER use box-drawing / ASCII-art tables with characters like `┌`, `┬`, `─`, `│`, `└`, `┘`, `├`, `┤`, `┼`. These are completely banned.
- No exceptions. Not for "clarity", not for alignment, not for terminal output.
