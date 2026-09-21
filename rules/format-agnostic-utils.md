# Format-Agnostic Utilities

A shared parse or traversal utility returns raw structure with the complete key path (object keys as strings, array indices as numbers) and no baked-in labels, separators, output shape or return type; the caller decides the format, and the accumulator and the return type are the caller's (`parse<T>` returns `T`).
