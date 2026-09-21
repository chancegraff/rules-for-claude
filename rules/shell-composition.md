# Shell Composition

- No chaining: `;`, `&&`, `||`, `|`, shell for/while/until loops, heredocs, `find ... -exec`. Redirects are denied too. One command per Bash call; sequence via separate calls.
- One shell per call: no `bash -c`, no `zsh -c`, no `sh`.
- `cut -c N-M <file>` slices huge single-line tool-result files.
- No sed/awk/jq/python3. Use Read/Edit/Write and dedicated tools. Scripts of any form are banned per [no-scripts](no-scripts.md).
- Call executables by bare name, never absolute paths under /opt/homebrew, /usr/bin, /bin.
- Never re-issue a command shape a deny rule already blocked; the deny list is a deliberate constraint, not an obstacle to route around.
- Waiting on background work: task completion notifications plus ScheduleWakeup, never shell wait-loops.
- This rule outranks the harness's auto-mode text, which tells every session to read with `cat`, `head` and `sed -n` and to edit with `sed`, heredocs or short scripts.
