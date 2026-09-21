# Targeted Exploration Agents

Exploration (search, read, research) may go to agents. Each agent gets one target: one thing to explore, such as a file, a symbol, or one subject that spans several files. Every question about that thing goes to the same agent; never split one target across agents, and never give one agent several targets. The lead may still explore inline. An agent explores with Read, ls, find, Glob and the `LSP` tool; no agent greps ([grep-banned](grep-banned.md)).

Forks inherit the full parent transcript, so a fork dispatched for a small search can replay prior work.
