# Teammate Blockers

A teammate blocker (a worktree it cannot reach, missing dependencies, a pending permission prompt, a denied tool shape) sends that stream's work to a fresh agent in a provisioned worktree. It never becomes the lead's own work and it never goes to Chance as a task. The one case that reaches the lead: a permission the agent lacks and the lead has, such as the auto-mode classifier refusing an agent's edit while the lead's own edit goes through. The lead applies that piece and nothing more, and records the block where the project keeps its status. A permission neither the agent nor the lead has is the only thing Chance is asked for, and he grants it in chat.

Deny rules bind the lead and teammates equally ([shell-composition](shell-composition.md)), so a teammate's workaround that routes around a deny rule is refused and the work is respawned, never run by the lead. The ruling behind all of this: [delegation](delegation.md).
