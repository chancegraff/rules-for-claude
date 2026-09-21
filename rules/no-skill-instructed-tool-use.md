# Automatic Means Structural

Never propose, suggest or fall back to "the skill will instruct the agent to call X first" as a way to get automatic behavior. It is banned in every form: as the design, as a fallback, as a workaround, as an alternative worth naming. The shapes it hides in:

- a skill prompt that says "you must call X before responding"
- a CLI tool wrapped in skill instructions
- an MCP tool wrapped in "remember to call this" prose
- any design whose automatic part rests on an agent invoking a tool when the context calls for it

An agent does not reliably follow an in-context instruction to call a tool, so such a design only hopes for the behavior it claims.

**How to apply.** Automatic means structural: a `UserPromptSubmit` hook that runs before the model sees the message, a preprocessing step in the harness, or a context injection that needs no model decision. Where the platform offers no structural way, say "this is not possible without X" instead of papering over it with a skill instruction. An MCP tool is called for explicit mid-task work, never as an automatic priming step by convention.

The same test reads the other way on agent briefs: a sentence a brief must carry is a reminder, and no file may call it enforcement. Those sentences stand until a hook can add them.
