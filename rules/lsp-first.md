# LSP-First Navigation (CRITICAL)

When cclsp MCP connected, ALL agents MUST use LSP over Grep for semantic navigation.

| Task | LSP Tool |
|------|----------|
| Definition | `find_definition` |
| References | `find_references` |
| Symbol search | `find_workspace_symbols` |
| Implementations | `find_implementation` |
| Call hierarchy | `get_incoming_calls` / `get_outgoing_calls` |
| Type info | `get_hover` |
| Diagnostics | `get_diagnostics` |

Grep/Glob = fallback ONLY when LSP returns empty or searching non-symbol text.
