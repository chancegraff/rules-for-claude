# Scoped Verification

Verification scope matches change scope: run checks against the affected file(s), never whole-package or whole-repo suites. Bare `test`, `lint`, or `format:check` runs across an entire package after a small change are unwanted regardless of which command. Repo stores record the exceptions (commands that cannot be file-scoped, such as project-level type checks).
