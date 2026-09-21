# A Relational Store Gets a Relational Schema

The moment: data moves into a relational database, or from one store into another. Carrying the old store's shape across is the first workable answer, which [answer-method](answer-method.md) rejects. A document dropped into one JSON column hides every relationship from the database, so nothing can be joined, constrained or indexed.

Design the schema from the record: a table per kind of thing, a typed column per field, a table of its own for every list that grows (one row per item, a foreign key to its owner), a foreign key for every pointer, an index on every key that is read by. A JSON column only for a field whose shape truly varies, and the reason is written beside it.

Check every plan row and contract row that names a store shape against this before the build starts.
