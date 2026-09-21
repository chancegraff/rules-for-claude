# Never Modify Generated Files

Never modify a generated file: anything under a `__generated__/` directory, any `*.schema.graphql`, any codegen artifact, and any file whose header comment says it was generated. An edit there is overwritten by the next build and never lands. Fix the source and regenerate. Name the forbidden paths in any agent brief that touches them, and back generated-file changes out of a diff before it is committed.
