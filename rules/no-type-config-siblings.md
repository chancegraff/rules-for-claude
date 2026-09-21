# No Type/Config Sibling Files

Per-source-file type and config siblings (`foo.ts` plus `foo-types.ts` plus `foo-config.ts`) are banned: they buy one decoupled contract per file and pay in duplication, drift and more hiding spots for a declaration that already exists. Declaring a type or a constant in the file that uses it is always fine. A directory-level `types.ts`, `config.ts` or `constants.ts` is one allowed home, never a mandate: never create one because a new file declares a type, and never create one empty or ahead of need.

Before declaring a new type or constant, run an LSP workspace-symbol search for the name; on a match, import it from where it already lives. An agent brief that introduces types or constants carries that step.

An existing sibling pair is consolidated in code you are already touching, and left alone everywhere else ([fix-known-issues](fix-known-issues.md)).

Two substitutes are not accepted: a periodic dedupe pass, and a lint rule against duplicate types, since an AST compares names and not shapes.
