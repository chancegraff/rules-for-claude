# Agent Lifecycle

- One fresh agent per task. An agent spawned for one purpose is never repurposed for another; accumulated context is not a reason to reuse (task briefs carry context), and reused agents miss discovery passes the fresh briefing would force. Sole exception: implementation teammates cross-reviewing each other's work.
- A teammate that completed its task and went idle is dead. Any follow-up, even a one-line fix to the work it just finished, gets a fresh agent; shut the finished teammates down first, via SendMessage shutdown_request ([team-mechanics](team-mechanics.md)). This applies to verifiers too.
