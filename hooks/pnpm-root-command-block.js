#!/usr/bin/env node
'use strict';

// pnpm-root-command-block.js — PreToolUse hook (matcher: Bash)
// Blocks running `test`, `lint`, or `check-types`/`tsc` across the
// frontend-code monorepo ROOT (pnpm, or the legacy yarn form) — including any
// git worktree of it. Detection is based on the package.json at the session
// cwd having name === "@attentive/frontend-code".
//
// Allowed: package-scoped runs (`--filter`, `-F`, `--dir`, `-C`), any command
// with a `cd` before the run, script variants like `test:vitest`, and runs
// from inside a subpackage. Explicit workspace-wide runs (`-r`/`--recursive`/
// `-w`/`--workspace-root`) are blocked from anywhere.

const fs = require('fs');
const path = require('path');

const ROOT_PKG_NAME = '@attentive/frontend-code';

// A gated script target invoked via pnpm or yarn: `pnpm test`, `pnpm run lint`,
// `yarn check-types`, `pnpm tsc`, etc.
const GATED = /(^|[;&|\s])(pnpm|yarn)(\s+run)?\s+(test|lint|check-types|tsc)(\s|$)/;
// Direct type-check via the package runner: `pnpm exec tsc`.
const EXEC_TSC = /(^|[;&|\s])(pnpm|yarn)\s+exec\s+tsc(\s|$)/;
// A `cd <dir>` segment before the run — trust that the user changed directory.
const CD_BEFORE = /(^|[;&|\s])cd\s+\S+.*?(?:&&|\|\||;|\|)\s*(pnpm|yarn)\b/;
// Package-scoping flags — the run targets a specific package, so allow it.
const SCOPED = /(^|\s)(--filter|-F|--dir|-C)(\s|=)/;
// Explicit workspace-wide flags — block from anywhere.
const RECURSIVE = /(^|\s)(-r|--recursive|-w|--workspace-root)(\s|$)/;

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', d => { raw += d; });
process.stdin.on('end', () => {
  let data;
  try { data = JSON.parse(raw); } catch { process.exit(0); }
  if (data.tool_name !== 'Bash') process.exit(0);

  const cmd = String(data.tool_input?.command ?? '').trim();
  if (!cmd) process.exit(0);
  if (!GATED.test(cmd) && !EXEC_TSC.test(cmd)) process.exit(0);
  if (CD_BEFORE.test(cmd)) process.exit(0);

  // Explicit workspace-wide runs are blocked regardless of cwd. Otherwise a
  // package-scoped run is fine from anywhere, and a bare run is only blocked
  // when the session cwd is the monorepo root.
  if (!RECURSIVE.test(cmd)) {
    if (SCOPED.test(cmd)) process.exit(0);

    const cwd = data.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const pkgPath = path.join(cwd, 'package.json');
    let pkg;
    try {
      pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    } catch {
      process.exit(0);
    }
    if (pkg?.name !== ROOT_PKG_NAME) process.exit(0);
  }

  const reason =
    `Blocked: running \`test\`/\`lint\`/\`check-types\` across the frontend-code monorepo root.\n` +
    `These fan out across the entire workspace. Scope to the affected package:\n` +
    `  pnpm --filter @attentive/<pkg> test <path>\n` +
    `  pnpm --filter @attentive/<pkg> lint <path>\n` +
    `  pnpm --filter @attentive/<pkg> check-types\n` +
    `Or cd into the package dir first (libs/<pkg>, mfes/<pkg>, apps/<pkg>).`;

  process.stderr.write(`\n⛔ ${reason}\n\n`);

  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }));
});
