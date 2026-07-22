#!/usr/bin/env node
'use strict';

// deny-rule-redirect.js — PreToolUse hook (matcher: Bash)
// Reads Bash(...) deny rules from ~/.claude/settings.json, matches the
// incoming command against each pattern, and on a hit emits a structured
// block response naming the exact rule + a redirect to the right tool.
//
// Why this exists: Claude Code's built-in deny enforcement blocks the call
// but does not always tell the agent WHICH rule fired or what to do
// instead. This hook surfaces both, so the agent self-corrects rather than
// guessing.
//
// Precedence: per Claude Code IAM docs, deny > allow always. So matching
// a deny rule is sufficient to block — no need to inspect allow rules.

const fs = require('fs');
const os = require('os');
const path = require('path');

const SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');

// ── Redirect map: rule "subject" → suggested alternative ──────────────────
// Subject is the cleaned form of the pattern (see describeRule below).
// Order matters for substring fallback — list more specific keys first.
const REDIRECTS = {
  // search tools
  'grep':         'Do not use Grep. For code symbols, use the LSP tool (operation: workspaceSymbol / findReferences / goToDefinition).',
  'grep -r':      'Do not use Grep. For code symbols, use LSP({operation: "workspaceSymbol", ...}).',
  'rg':           'Do not use Ripgrep. For code symbols, use LSP({operation: ..., filePath, line, character}).',
  'egrep':        'Do not use Egrep. For code symbols, use LSP({operation: ..., filePath, line, character}).',
  'fgrep':        'Do not use Fgrep. For code symbols, use LSP({operation: ..., filePath, line, character}).',
  'ggrep':        'Do not use Ggrep. For code symbols, use LSP({operation: ..., filePath, line, character}).',

  // text mutation
  'sed':          'Do not use Sed. Use the Edit tool for in-file text changes.',
  'awk':          'Do not use Awk. Use the Edit tool, or Read + analyze inline.',

  // language runtimes
  'python3':      'Avoid ad-hoc python — use Read/Edit/Write or a project script defined in package.json.',
  'node':         'Avoid running node directly — invoke scripts via yarn / package.json.',
  'npx':          'Avoid npx — use yarn / pnpm scripts defined in package.json.',
  'sh':           'Run the underlying command directly instead of piping through sh.',
  'jest':         'Use yarn test (or yarn test:* variants) — never invoke jest directly.',

  // git destructive / state-altering
  'git stash':    'Avoid git stash — commit WIP or leave changes uncommitted.',
  'git checkout': 'git checkout can overwrite work. Use git switch for branches; ask before touching files.',
  'git reset':    'git reset can lose work. Confirm with the user before any reset.',
  'git clean':    'git clean deletes untracked files. Confirm with the user first.',
  'git revert':   'Confirm with the user before reverting.',
  'git merge':    'Confirm with the user before merging.',
  'git rebase':   'Confirm with the user before rebasing.',
  'git mv':       'Use a regular mv + git add instead of git mv.',

  // shell control flow
  '&&':           'Run commands separately in distinct Bash calls — do not chain with &&.',
  '||':           'Run commands separately in distinct Bash calls — do not chain with ||.',
  ';':            'Run commands separately in distinct Bash calls — do not chain with ;.',
  '|':            'Pipes are denied. Run commands separately. Redirecting output to files is denied.',
  '2>&1':         'Redirecting stderr to stdout is denied. Run commands in the session instead.',
  '>':            'Redirecting output to files is denied. Run commands in the session instead.',
  'for':          'Run commands individually instead of shell for-loops.',
  'pushd':        'Use absolute paths instead of pushd/popd.',

  // hashing / misc
  'md5':          'Use shasum (or another hash) if you genuinely need a digest.',

  // path-prefix denies
  'node_modules/':'Do not operate inside node_modules — let the package manager own it.',
  '/opt/homebrew/':'Use the command name directly (PATH resolves it). Do not hardcode /opt/homebrew/.',
  '/usr/bin/':    'Use the command name directly (PATH resolves it). Do not hardcode /usr/bin/.',
  '/bin/':        'Use the command name directly (PATH resolves it). Do not hardcode /bin/.',
  '-exec':        'Avoid find -exec. Run a targeted Read/Edit/Grep instead.',
};

// ── Helpers ───────────────────────────────────────────────────────────────

function readSettingsSilent() {
  try {
    const raw = fs.readFileSync(SETTINGS_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Extract "Bash(<pattern>)" → <pattern>. Returns null for non-Bash rules.
function unwrapBashRule(rule) {
  if (typeof rule !== 'string') return null;
  const m = rule.match(/^Bash\((.*)\)$/s);
  return m ? m[1] : null;
}

// Convert a Claude Code Bash permission pattern to a regex matching the
// full command string.
//
// Pattern semantics (matching Claude Code's documented behavior):
//   `cmd:*`   → `cmd` alone OR `cmd` followed by whitespace + args
//   `*`       → glob wildcard (any chars, including spaces)
//   anything else → literal
//
// Regex specials are escaped first; `*` is then replaced with `.*` so it
// keeps glob semantics. Anchored on both ends so partial-string matches
// don't sneak through.
function patternToRegex(pat) {
  const trailingColonStar = /:\*$/.test(pat);
  let body = trailingColonStar ? pat.slice(0, -2) : pat;
  // Escape every regex metachar except `*` (which we handle next).
  body = body.replace(/[.+?^${}()[\]\\|]/g, '\\$&');
  body = body.replace(/\*/g, '.*');
  const tail = trailingColonStar ? '(?:\\s+.*)?' : '';
  return new RegExp('^' + body + tail + '$', 's');
}

// Boil a pattern down to a human-readable "subject" used to look up a
// redirect. Strips the glob/colon ornaments so substring matching works.
function describeRule(pat) {
  let s = String(pat).trim();
  s = s.replace(/:\*$/, '');
  s = s.replace(/\s*\*\s*/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  return s || pat;
}

function suggestionFor(pattern) {
  const subj = describeRule(pattern);
  if (REDIRECTS[subj]) return REDIRECTS[subj];
  // Substring fallback: longest key first so 'grep -r' beats 'grep'.
  const keys = Object.keys(REDIRECTS).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (subj.includes(k)) return REDIRECTS[k];
  }
  return 'No preset redirect — re-read the deny rule and choose a different approach (or ask the user to relax the rule).';
}

// ── Main ──────────────────────────────────────────────────────────────────

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', d => { raw += d; });
process.stdin.on('end', () => {
  let data;
  try { data = JSON.parse(raw); } catch { process.exit(0); }
  if (data.tool_name !== 'Bash') process.exit(0);

  const cmd = String(data.tool_input?.command ?? '');
  if (!cmd) process.exit(0);

  const settings = readSettingsSilent();
  const denyList = Array.isArray(settings?.permissions?.deny) ? settings.permissions.deny : [];
  if (denyList.length === 0) process.exit(0);

  const hits = [];
  for (const rule of denyList) {
    const pat = unwrapBashRule(rule);
    if (pat == null) continue;
    let re;
    try { re = patternToRegex(pat); } catch { continue; }
    if (re.test(cmd)) {
      hits.push({ rule, pattern: pat, suggestion: suggestionFor(pat) });
    }
  }

  if (hits.length === 0) process.exit(0);

  // Deduplicate suggestions for cleaner output (multiple variants of the
  // same rule — e.g. `grep:*`, `grep *`, `grep` — all redirect identically).
  const seenSuggestions = new Set();
  const uniqueSuggestions = [];
  for (const h of hits) {
    if (seenSuggestions.has(h.suggestion)) continue;
    seenSuggestions.add(h.suggestion);
    uniqueSuggestions.push(h.suggestion);
  }

  const ruleList = hits.map(h => `  • ${h.rule}`).join('\n');
  const redirects = uniqueSuggestions.map(s => `  → ${s}`).join('\n');

  const reason =
    `Command blocked by user-level deny rule(s) in ~/.claude/settings.json:\n` +
    `${ruleList}\n\n` +
    `Command: ${cmd}\n\n` +
    `Redirect:\n${redirects}`;

  process.stderr.write('\n⛔ DENY-RULE: ' + reason + '\n\n');

  console.log(JSON.stringify({
    decision: 'block',
    reason,
    hook: 'deny-rule-redirect',
    matchedRules: hits.map(h => h.rule),
    suggestions: uniqueSuggestions,
    command: cmd,
  }));
});
