#!/usr/bin/env node
'use strict';

// yarn-test-root-block.js — PreToolUse hook (matcher: Bash)
// Blocks `yarn test` (and `yarn run test`) when invoked from the frontend-code
// monorepo root — including any git worktree of it. Detection is based on the
// package.json at the session cwd having name === "@attentive/frontend-code".
//
// Heuristic: if the command contains a `cd` segment before the `yarn test`,
// we trust that the user is running it from a different directory and let
// it through. Otherwise we check the session cwd's package.json.
//
// Allows: yarn test from subpackages (libs/*, mfes/*, apps/*, etc.) and any
// scripted variant like `yarn test:vitest`, `yarn test-something`.

const fs = require('fs');
const path = require('path');

const ROOT_PKG_NAME = '@attentive/frontend-code';

const YARN_TEST = /(^|[;&|\s])yarn(\s+run)?\s+test(\s|$)/;
const CD_BEFORE_YARN_TEST = /(^|[;&|\s])cd\s+\S.*?(?:&&|\|\||;|\|)\s*yarn(\s+run)?\s+test(\s|$)/;

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', d => { raw += d; });
process.stdin.on('end', () => {
  let data;
  try { data = JSON.parse(raw); } catch { process.exit(0); }
  if (data.tool_name !== 'Bash') process.exit(0);

  const cmd = String(data.tool_input?.command ?? '').trim();
  if (!cmd) process.exit(0);
  if (!YARN_TEST.test(cmd)) process.exit(0);
  if (CD_BEFORE_YARN_TEST.test(cmd)) process.exit(0);

  const cwd = data.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const pkgPath = path.join(cwd, 'package.json');

  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch {
    process.exit(0);
  }

  if (pkg?.name !== ROOT_PKG_NAME) process.exit(0);

  const reason =
    `Blocked: \`yarn test\` from the frontend-code monorepo root (${cwd}).\n` +
    `Running tests from the root fans out across the entire workspace. ` +
    `cd into the specific package directory first, e.g.:\n` +
    `  cd libs/<pkg> && yarn test\n` +
    `  cd mfes/<pkg> && yarn test\n` +
    `  cd apps/<pkg> && yarn test`;

  process.stderr.write(`\n⛔ ${reason}\n\n`);

  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }));
});
