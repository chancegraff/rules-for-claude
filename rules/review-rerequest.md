# Re-Request Review After Every Push

Every push that answers review feedback ends by re-requesting review. The sequence is push, thread replies, description re-examination under [pr-descriptions](pr-descriptions.md), then the re-request, a fixed final step and never an afterthought. Re-request a human reviewer with `gh pr edit <n> --add-reviewer <login>`, except when the reviewer is the PR author. Repo stores record a repo's own re-request mechanics, review bots included.
