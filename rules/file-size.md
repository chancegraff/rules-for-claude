# Code File Length and the Test-File Canary (HARD CRITICAL RULE)

**Code file length.** In every project, a code file's size biases every edit toward splitting it, and the bias grows with the size, with no threshold: the larger the file, the higher the bar for keeping it whole. Every agent that edits or writes a non-test code file reads its line count before finishing and states, in its report, either "Split <file> into <files>; <reason>" or "Did not split <file> (<N> lines); <reason>". A "did not split" line on a large file needs a reason naming why each split would break the module; "it is one concern" or "it is one workflow's loop" is not one. The lead refuses a report whose reason does not meet that bar and dispatches the split.

**Splitting needs no separate approval.** Splitting a file already being edited is inside the approved work, so it never waits on a further word. Splitting is routine work, never deferred cleanup, and it overrides "do not refactor beyond scope" ([approval-gates](approval-gates.md)).

**The test-file canary.** Test files are exempt from the length bias, and their length is the signal: a huge test file means the source it tests has not separated its concerns. The response is a split of the SOURCE into modules of one concern each, and the tests follow their modules under [test-file-naming](test-file-naming.md), one test file per source module.

The breaks of this rule and what was tried: `~/.claude/incidents/by-rule.md`.
