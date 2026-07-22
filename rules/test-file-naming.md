# Test File Naming

A unit test file is named after an existing source module, never after a behavior; no free-floating test files. A test spanning two modules is not a new file: it belongs in the test file of the module whose behavior is being asserted, split per module if needed. Integration/E2E tests are a separate category with their own homes, not ad-hoc test files. When briefing agents to write tests, name the exact existing test file(s) to extend, and never offer "create a new test file" as an option unless a new SOURCE module is being created alongside it.
