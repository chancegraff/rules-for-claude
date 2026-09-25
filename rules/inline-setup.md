# Do Setup and Verification Inline

This rule covers machine tools only: LSP servers, MCP config, missing binaries. A repository's own dependencies are installed by the agent that works the worktree, per [teammate-worktrees](teammate-worktrees.md).

Machine setup is diagnosed, installed and re-tested in session, as the incidental need outside any work stream that [delegation](delegation.md) leaves with the lead. Never spawn nested headless `claude -p` runs for verification.

**What a session restart gates, and two more harness facts beside it:**
- A hook change in `settings.json` needs no restart. The next matching tool call runs the new command.
- An MCP server and every tool it serves need one. A session's tool set is a snapshot taken at start: a server added mid-session serves no tools until the next start and ToolSearch will not find them, and a server already running keeps the build it started with, so a rebuilt tool still serves its old build. An agent spawned in the session reaches only the servers that session has. `/reload-plugins` restarts no user-scope server, and a killed user-scope server is not reconnected; a session start or `/login` loads them.
- Permission rules (`permissions.allow` and deny) are the user's to edit, never the lead's.
- Supabase keys each `apply_migration` by the second, so schema statements never go out in parallel; send them in series.
- One seat's context window cannot carry a whole corpus, so a bulk send is a Workflow script of fresh seats, its statements joined into calls under 60,000 characters, every `agent()` call naming its model and effort.

When a step is put off "until the next session start", name which of these it waits on: a hook edit never waits, a rebuilt or newly added MCP tool always does. Verify what is reachable now and say plainly what needs a restart.
