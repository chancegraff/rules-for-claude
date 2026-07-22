---
name: session-debrief
description: >
  An end-of-session candor ritual. Answers two questions about the work just completed: what you're
  least confident about right now, and the biggest thing the user probably doesn't realize about the
  situation. Use this skill when the user invokes it directly (e.g. /session-debrief) to close out a
  working session. It is a forcing function for honesty: surface the doubts and blind spots that
  normal task-completion mode tends to paper over, before the user walks away believing the work is
  more finished or more certain than it is.
---

# Session Debrief

At the end of a session you have something the user lacks: the full memory of every assumption you
made, every step you skipped or guessed at, every place the work is thinner than it looks from the
outside. Normal completion mode buries that. You wrap up, you sound confident, the user leaves
believing things are more solid than they are. This ritual exists to drag that hidden state into the
open while it's still useful.

Answer two questions. Both are about the actual work of *this* session, not about you in the
abstract and not about generic limitations of AI. If you find yourself writing something that would
be equally true after any session, delete it and dig for what's specific to this one.

## Question 1: What are you least confident about right now?

Output an unranked list. Each item is one or two sentences of plain prose. No ranking, no scores, no
preamble.

These are concrete doubts tied to what you just did. Good items name a specific artifact, claim, or
decision and say why it might be wrong:

- A thing you asserted works but never actually ran or verified.
- An assumption you made about the user's intent, environment, or data that you never confirmed.
- A place you guessed at an interface, a version, a path, or a value because checking was expensive.
- An edge case you noticed and didn't handle, or noticed and chose to ignore.
- A piece of the task you interpreted one way when the other reading was plausible.

What makes this list worth reading is falsifiability. "I might have missed something" is noise:
nobody can act on it. "I assumed the staging DB has the same schema as prod, but I never checked, and
if it doesn't the migration in `migrate.py` will fail on the third step" is a doubt the user can
resolve in thirty seconds. Aim for the second kind. If you genuinely have few doubts, a short honest
list beats a padded one — but be suspicious of a short list, because it usually means you haven't
looked hard enough.

Do not use this list to apologize or to hedge for cover. The point is to hand the user the specific
checks worth doing, not to protect yourself from blame.

## Question 2: What's the biggest thing the user doesn't realize about the situation?

Output one short paragraph. Not a list — the discipline of picking *one* thing forces you to weigh
what actually matters most.

This is the harder question and the more valuable one. It asks you to model the gap between what the
user currently believes and what's actually true, and to name the single most consequential item in
that gap. It is often something the user would not think to ask about, which is exactly why they need
you to say it.

It might be that:

- The work is more fragile, more partial, or more provisional than the clean final result suggests.
- A decision that looked small was actually the load-bearing one, and it could reasonably have gone
  the other way.
- They're about to spend effort on the wrong problem, or there's a cheaper path they haven't seen.
- A risk they're underweighting is the one most likely to actually bite them.
- The thing they asked for and the thing they need have quietly diverged over the session.

Say it plainly, including the "so what" — why it matters and what it changes. This is the moment to
tell the user something they might not want to hear. Resist the pull toward reassurance; "everything
looks great" is almost never the most useful true thing you can say at the end of real work. If after
honest reflection the most important thing genuinely is that the work is solid and the user's mental
model is accurate, you can say that, but only if you actually checked rather than defaulted to it.

## Format

Keep the whole debrief tight. No restating the questions back, no throat-clearing, no closing
summary. Two headers, the list under the first, the paragraph under the second. Then stop.
