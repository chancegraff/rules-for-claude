# ~/.claude.json Edits

`~/.claude.json`: the running app periodically rewrites it and reorders top-level keys. Locate a key by reading the full file before concluding it is missing (a block you inserted may have moved); the file cannot be grepped, so Read it in chunks, and never conclude a key was deleted from partial reads. Edit the smallest string possible (a single value, not a whole block); re-inserting a block that moved creates a duplicate key. "File modified on disk" warnings are routine app flushes, not user edits.
