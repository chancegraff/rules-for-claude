# When a Required Tool Is Unavailable

Never skip a step because a required tool or MCP server is unavailable mid-workflow. First test what the step needs. A step that needs a human act (a session restart, a click, a permission only the user can grant) is deferred to its next natural moment, recorded as one line in the run's record, and the work continues on everything that does not depend on it. Stop and ask only when nothing independent is left to do, and say then what the unblock is. A deferred list is finite: one line per deferred step, cleared when the run ends.
