# Grep Banned in All Forms

Grep is banned in every form: the Grep tool, Bash grep/rg/ggrep/egrep/fgrep, git grep, and agents instructed to search.

- Symbol/reference questions go through LSP tools (find_references, workspaceSymbol, goToDefinition, hover, call hierarchy).
- File discovery: ls, find, Glob.
- Historical or cross-branch content: `git log -S`, `git show`.
- Some repos layer stricter rules on top (project-aig also bans Glob and bash find for architecture work; its memory store governs there).
