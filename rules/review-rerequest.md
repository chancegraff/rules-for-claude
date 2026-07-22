# Re-Request Review After Every Push

Every push that responds to review feedback ends with re-requesting review; the push sequence is push, thread replies, body patch, then the re-request as its fixed final step, not an afterthought. Human reviewer re-requests still apply where possible (not when the reviewer is the PR author). Repo stores record repo-specific re-request mechanics (e.g. review bots).
