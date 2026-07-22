# No Exploration Agents

Never dispatch agents (any type: general-purpose, Plan, fork, guide) to explore, search, read, or research. All exploration happens inline in the main context, using Read, ls/find/Glob, LSP tools, git, and WebFetch.

Forks inherit the full parent transcript; one dispatched for a "tiny search" can replay prior work. Never put any concurrent agent into a git worktree you are actively mutating.
