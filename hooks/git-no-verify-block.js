#!/usr/bin/env node
'use strict';

// git-no-verify-block.js — PreToolUse hook (matcher: Bash)
// Blocks all known forms of pre-commit/pre-push hook bypass when the
// command is `git commit` or `git push`. Mirrors the zsh guard in
// ~/.zshenv but tightens it to also catch:
//   - `git -C path commit/push --no-verify` (zsh guard misses this)
//   - `git -c core.hooksPath=/dev/null commit/push` (stealth bypass)
//   - `GIT_CONFIG_PARAMETERS="'core.hooksPath=...'" git commit/push`
//   - `GIT_CONFIG_KEY_*=core.hooksPath ... git commit/push`
//
// `-n` is only blocked on `commit` (where it == `--no-verify`).
// On `push`, `-n` means `--dry-run`, which is harmless and allowed.

// MAX_PAYLOAD_BYTES: the lead's budget, set 2026-09-10 (well above GitHub's 65,536-byte body cap plus flags); a larger payload is not a tool call this hook can act on.
const MAX_PAYLOAD_BYTES = 1048576;

let raw = '';
let overflow = false;
let bytes = 0;
process.stdin.setEncoding('utf8');
process.stdin.on('data', d => {
  if (overflow) return;
  bytes += Buffer.byteLength(d, 'utf8');
  if (bytes > MAX_PAYLOAD_BYTES) { overflow = true; raw = ''; return; }
  raw += d;
});
process.stdin.on('end', () => {
  if (overflow) process.exit(0);
  let data;
  try { data = JSON.parse(raw); } catch { process.exit(0); }
  if (data.tool_name !== 'Bash') process.exit(0);

  const cmd = String(data.tool_input?.command ?? '');

  // Detect `git ... push` or `git ... commit`, allowing prefix flags
  // (-C path, --git-dir=path, -c key=val) between `git` and the subcommand.
  const sub = cmd.match(
    /\bgit\b(?:\s+(?:-C\s+\S+|--git-dir(?:=|\s+)\S+|-c\s+\S+))*\s+(push|commit)\b/
  );
  if (!sub) process.exit(0);
  const subcmd = sub[1];

  const reasons = [];

  if (/(?:^|\s)--no-verify(?=\s|$)/.test(cmd)) {
    reasons.push('--no-verify');
  }
  if (subcmd === 'commit' && /(?:^|\s)-n(?=\s|$)/.test(cmd)) {
    reasons.push('-n (== --no-verify for git commit)');
  }
  if (/core\.hooksPath/i.test(cmd)) {
    reasons.push('core.hooksPath override');
  }
  if (/\bGIT_CONFIG_PARAMETERS\b/.test(cmd)) {
    reasons.push('GIT_CONFIG_PARAMETERS env override');
  }

  if (reasons.length === 0) process.exit(0);

  process.stderr.write(
    'ERROR: --no-verify is forbidden. Fix the underlying issue instead of bypassing hooks.\n' +
    `Detected bypass: ${reasons.join(', ')}\n`
  );
  process.exit(2);
});
