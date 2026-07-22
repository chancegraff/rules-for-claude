# Do Setup and Verification Inline

Do local machine setup and verification tasks (LSP servers, MCP config, missing binaries) directly in-session: diagnose, install, and re-test yourself. Never spawn nested headless `claude -p` runs for verification. MCP servers added to config mid-session expose no tools until the next session start (toolsets snapshot at startup; ToolSearch won't find them); verify what is reachable now, and state plainly what needs a restart.
