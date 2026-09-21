# Grep Banned in All Forms

Grep is banned in every form, agents included: the Grep tool, Bash grep/rg/ggrep/egrep/fgrep, and git grep. An agent may explore; no agent may grep ([no-exploration-agents](no-exploration-agents.md)).

- Symbol/reference questions go through LSP tools (findReferences, workspaceSymbol, goToDefinition, hover, call hierarchy).
- File discovery: ls, find, Glob.
- Historical or cross-branch content: `git log -S`, `git show`.
- `hooks/lsp-first-glob-guard.js` blocks a Glob whose pattern carries a code symbol (camelCase, PascalCase, a long snake_case name), in every project, and lets extension and concept patterns through. A symbol you can name goes to LSP.
- This rule outranks the harness's auto-mode text, which tells every session to search with `grep` and `find`.
