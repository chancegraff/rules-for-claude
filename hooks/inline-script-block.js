#!/usr/bin/env node
'use strict';

// inline-script-block.js: PreToolUse hook (matcher: Bash)
// Blocks every inline-script form of a JavaScript runtime (node, nodejs,
// ts-node, tsx, bun, deno) while letting file-based invocations run.
//
// Blocked forms: eval, print, and interactive flags in any spelling (quoted,
// combined short flags such as -pe, --eval=...), --input-type, stdin scripts
// (bare "-", /dev/stdin, /dev/fd/N), data: URL preloads in flags or in
// NODE_OPTIONS, input redirects with no script file (heredocs, here-strings,
// "< file"), unresolved expansions ($F, "$@") in the flag window, in
// NODE_OPTIONS, or as the command word itself ($CMD, "$@"), a bare runtime
// with no arguments (a REPL, or a script piped in on stdin) whether alone or
// under a wrapper (`pnpm node`, `timeout 5 node`, `sudo node`), bun repl,
// and deno eval / repl / stdin / data: specifiers. Command strings handed to
// a shell or wrapper (`bash -c`, `su -c`, `npm exec -c`, `bun exec`, `eval`)
// get the same analysis, and so do the tokens after `bun x`.
//
// Allowed: `node file.mjs --flag -e value`, `node hook.js < payload.json`,
// `node --version`, `node -r ./setup.js file.js`, `node $DIR/run.mjs`,
// `deno run script.ts`, `bash -c 'ls -la'`, `bash script.sh`,
// `$HOME/bin/tool args`, `which node`, `command -v node`.
//
// The deny rules in settings.json cover the plain spellings. This hook is the
// backstop for disguised ones: wrappers such as `pnpm node`, `timeout 5 node`,
// `npx tsx`; env-var preloads; redirects; absolute runtime paths. Analysis
// failures fail open so the hook never wedges a Bash call.

// Zero-width / formatting chars that would split tokens invisibly and
// bypass ASCII detection.
const ZERO_WIDTH = /[\u00AD\u200B-\u200F\u2060-\u2064\uFEFF]/g;

const RUNTIMES = new Set(['node', 'nodejs', 'ts-node', 'tsx', 'bun', 'deno']);

// Node-family flags that turn the invocation into an inline script or a REPL.
const NODE_INLINE_FLAGS = new Set([
  '-e', '--eval', '-p', '--print', '-i', '--interactive', '--input-type',
]);

// Node-family flags that consume the next token as their value when written
// without "=".
const NODE_VALUE_FLAGS = new Set([
  '-r', '--require', '--import', '--loader', '--experimental-loader',
  '--env-file', '--input-type', '--conditions', '-C', '--title',
  '--stack-size', '--max-old-space-size', '--max-semi-space-size',
  '--inspect-port',
]);

// Deno flags that consume the next token as their value when written
// without "=". Consuming them keeps a value from being mistaken for the
// script specifier.
const DENO_VALUE_FLAGS = new Set([
  '-c', '--config', '--import-map', '--lock', '--cert', '--seed',
  '--location', '-L', '--log-level', '--ext',
]);

// Shells whose "-c" option runs the next non-flag argument as a command
// string.
const SHELLS = new Set(['bash', 'zsh', 'sh', 'dash', 'ksh', 'fish']);

// Words that pass their remaining arguments on as the command to run, so a
// runtime after them is still the segment's command: `pnpm node`,
// `timeout 5 node`, `sudo node`, `pnpm exec node`. Flags, bare numbers (a
// nice level), and durations (`timeout 5s`) may sit between them and the
// runtime.
const COMMAND_WRAPPERS = new Set([
  'env', 'command', 'builtin', 'exec', 'nohup', 'nice', 'time', 'timeout',
  'stdbuf', 'sudo', 'xargs', 'pnpm', 'yarn', 'npm', 'npx', 'bunx', 'corepack',
  'dlx', 'x',
]);

// How many levels of wrapper command strings (`bash -c "bash -c ..."`) get
// analyzed before the hook stops recursing.
const MAX_WRAPPER_DEPTH = 4;

const TAIL = 'Inline scripts are banned. Write the code to a file in the source tree and run that file.';

// Tokenize one command string, quote-aware, into segments. Each segment is an
// array of tokens with quotes stripped, so `'-e'` and `"-e"` both become `-e`.
// Unquoted shell operators (&&, ||, ;, |&, |, &, newline) end the current
// segment. Unquoted redirects (<, <<, <<-, <<<, <&, <>, >, >>, >&, >|, &>,
// &>>) and process substitutions (<( ... ), >( ... )) become their own tokens
// so the analysis can tell a redirect target from a script path. Unquoted
// parentheses and backticks are token boundaries, so `$(node -e x)` and
// `(node -e x)` still expose the runtime token.
function splitSegments(cmd) {
  const segments = [];
  let tokens = [];
  let current = '';
  let hasToken = false;
  let i = 0;

  const endToken = () => {
    if (hasToken) tokens.push(current);
    current = '';
    hasToken = false;
  };
  const endSegment = () => {
    endToken();
    if (tokens.length > 0) segments.push(tokens);
    tokens = [];
  };
  const pushOperator = (op) => {
    endToken();
    tokens.push(op);
  };

  while (i < cmd.length) {
    const ch = cmd[i];
    const next = cmd[i + 1];

    if (ch === '\\') {
      if (next === undefined) { i += 1; continue; }
      // backslash-newline is a line continuation
      if (next === '\n') { i += 2; continue; }
      current += next;
      hasToken = true;
      i += 2;
      continue;
    }
    // $'...' and $"..." quote like '...' and "..." for our purposes
    if (ch === '$' && (next === "'" || next === '"')) { i += 1; continue; }
    if (ch === "'") {
      const close = cmd.indexOf("'", i + 1);
      hasToken = true;
      if (close === -1) { current += cmd.slice(i + 1); i = cmd.length; continue; }
      current += cmd.slice(i + 1, close);
      i = close + 1;
      continue;
    }
    if (ch === '"') {
      let j = i + 1;
      hasToken = true;
      while (j < cmd.length && cmd[j] !== '"') {
        if (cmd[j] === '\\' && j + 1 < cmd.length && '"\\$`\n'.includes(cmd[j + 1])) {
          if (cmd[j + 1] !== '\n') current += cmd[j + 1];
          j += 2;
          continue;
        }
        current += cmd[j];
        j += 1;
      }
      i = j + 1;
      continue;
    }
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '(' || ch === ')' || ch === '`') {
      endToken();
      i += 1;
      continue;
    }
    if (ch === '\n' || ch === ';') { endSegment(); i += 1; continue; }
    if (ch === '&') {
      if (next === '&') { endSegment(); i += 2; continue; }
      if (next === '>') {
        if (cmd[i + 2] === '>') { pushOperator('&>>'); i += 3; continue; }
        pushOperator('&>');
        i += 2;
        continue;
      }
      endSegment();
      i += 1;
      continue;
    }
    if (ch === '|') {
      if (next === '|' || next === '&') { endSegment(); i += 2; continue; }
      endSegment();
      i += 1;
      continue;
    }
    if (ch === '<' || ch === '>') {
      if (next === '(') {
        // process substitution: keep "<( ... )" as one token
        let depth = 0;
        let j = i + 1;
        while (j < cmd.length) {
          if (cmd[j] === '(') depth += 1;
          if (cmd[j] === ')') {
            depth -= 1;
            if (depth === 0) break;
          }
          j += 1;
        }
        pushOperator(cmd.slice(i, j + 1));
        i = j + 1;
        continue;
      }
      // a numeric fd prefix ("2>", "0<") belongs to the redirect, not to a token
      if (hasToken && /^\d+$/.test(current)) { current = ''; hasToken = false; }
      let j = i + 1;
      if (ch === '<' && cmd[j] === '<') {
        j += 1;
        if (cmd[j] === '<' || cmd[j] === '-') j += 1;
      } else if (ch === '<' && (cmd[j] === '&' || cmd[j] === '>')) {
        j += 1;
      } else if (ch === '>' && (cmd[j] === '>' || cmd[j] === '&' || cmd[j] === '|')) {
        j += 1;
      }
      pushOperator(cmd.slice(i, j));
      i = j;
      continue;
    }
    current += ch;
    hasToken = true;
    i += 1;
  }
  endSegment();
  return segments;
}

function isInputRedirect(tok) {
  return tok === '<' || tok === '<<' || tok === '<<-' || tok === '<<<' ||
    tok === '<&' || tok === '<>' || tok.startsWith('<(');
}

function isOutputRedirect(tok) {
  return tok === '>' || tok === '>>' || tok === '>&' || tok === '>|' ||
    tok === '&>' || tok === '&>>' || tok.startsWith('>(');
}

function isProcessSubstitution(tok) {
  return tok.startsWith('<(') || tok.startsWith('>(');
}

function basename(tok) {
  return tok.slice(tok.lastIndexOf('/') + 1);
}

// A token is a runtime if its basename (after the last "/") is in RUNTIMES,
// so `/Users/x/.nodenv/shims/node` and `./node_modules/.bin/tsx` count.
function runtimeName(tok) {
  const base = basename(tok);
  if (RUNTIMES.has(base)) return base;
  return null;
}

function flagName(tok) {
  const eq = tok.indexOf('=');
  if (eq === -1) return tok;
  return tok.slice(0, eq);
}

// Value of the flag at args[i], written as "--name=value" or "--name value".
// Undefined when nothing follows.
function flagValue(args, i) {
  const tok = args[i];
  const eq = tok.indexOf('=');
  if (eq === -1) return args[i + 1];
  return tok.slice(eq + 1);
}

// True for a short flag cluster that contains "c" (-c, -lc, -ic, -ec, -xc),
// the spelling shells and su use to take a command string.
function isCommandStringFlag(tok) {
  return /^-[a-zA-Z]+$/.test(tok) && tok.includes('c');
}

// True when nothing follows the runtime token but output redirects and their
// targets, so the runtime has neither flags nor a script.
function hasNoArguments(args) {
  let i = 0;
  while (i < args.length) {
    const tok = args[i];
    if (!isOutputRedirect(tok)) return false;
    if (isProcessSubstitution(tok)) { i += 1; continue; }
    i += 2;
  }
  return true;
}

function isAssignment(tok) {
  return /^[A-Za-z_][A-Za-z0-9_]*=/.test(tok);
}

// True when the runtime at tokens[index] is what the segment runs: every
// token before it is an assignment, a flag, a bare number, a duration, or a
// wrapper word. A duration is what `timeout` accepts: digits with an
// optional decimal part and an optional s, m, h, or d suffix (5, 5s, 1.5s,
// 2m, 1h, 1d). `which node` and `command -v node` name the runtime as data;
// a "v" or "V" flag makes `command` a lookup rather than an invocation.
function isCommandPosition(tokens, index) {
  let i = 0;
  while (i < index) {
    const tok = tokens[i];
    const base = basename(tok);
    if (base === 'command' && /^-[a-zA-Z]*[vV][a-zA-Z]*$/.test(tokens[i + 1])) return false;
    const passes = isAssignment(tok) || tok.startsWith('-') || /^\d+(\.\d+)?[smhd]?$/.test(tok) || COMMAND_WRAPPERS.has(base);
    if (!passes) return false;
    i += 1;
  }
  return true;
}

function checkScriptPath(runtime, tok) {
  if (tok === '-') return `${runtime} reads the script from stdin (bare "-")`;
  if (tok === '/dev/stdin' || tok.startsWith('/dev/fd/')) {
    return `${runtime} script path "${tok}" is a stdin descriptor`;
  }
  // "$F" may expand to a flag; "$DIR/run.mjs" can only be a path
  if (tok.includes('$') && !(tok.startsWith('$') && tok.includes('/'))) {
    return `${runtime} script path "${tok}" is an unresolved expansion`;
  }
  return null;
}

// node, nodejs, ts-node, tsx, bun: walk the flag window after the runtime
// token up to the script path. For bun the first positional may be a
// subcommand: repl blocks, exec runs its next token as a command string, x
// runs the tokens after it as a fresh command, and run restarts the walk on
// the tokens after it. Returns a reason string on block, else null.
function checkNodeFamily(runtime, args, segmentHasInputRedirect, depth) {
  let i = 0;
  while (i < args.length) {
    const tok = args[i];
    if (tok === '-') return checkScriptPath(runtime, tok);
    if (tok === '--') {
      const script = args[i + 1];
      if (script === undefined) break;
      return checkScriptPath(runtime, script);
    }
    if (isInputRedirect(tok) || isOutputRedirect(tok)) {
      if (isProcessSubstitution(tok)) { i += 1; continue; }
      // skip the redirect and its target (file, fd, heredoc delimiter, here-string)
      i += 2;
      continue;
    }
    if (tok.startsWith('-')) {
      if (tok.includes('data:')) return `${runtime} flag "${tok}" carries a data: URL`;
      if (tok.includes('$')) return `${runtime} flag "${tok}" carries an unresolved expansion`;
      const name = flagName(tok);
      if (NODE_INLINE_FLAGS.has(name)) return `${runtime} uses the inline flag "${name}"`;
      if (/^-[a-zA-Z]{2,}$/.test(tok) && /[epi]/.test(tok)) {
        return `${runtime} uses the short flag cluster "${tok}" (contains e, p, or i)`;
      }
      if (NODE_VALUE_FLAGS.has(name) && name === tok) {
        const value = args[i + 1];
        if (value !== undefined && value.includes('data:')) {
          return `${runtime} ${name} value "${value}" carries a data: URL`;
        }
        if (value !== undefined && value.includes('$')) {
          return `${runtime} ${name} value "${value}" carries an unresolved expansion`;
        }
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }
    if (runtime === 'bun') {
      if (tok === 'repl') return 'bun repl is an interactive session';
      if (tok === 'exec') {
        const cmd = args[i + 1];
        if (cmd === undefined) return null;
        return analyzeWrapped('bun exec', cmd, depth);
      }
      if (tok === 'x') return analyzeSegment(args.slice(i + 1), depth);
      if (tok === 'run') {
        return checkNodeFamily('bun run', args.slice(i + 1), segmentHasInputRedirect, depth);
      }
    }
    return checkScriptPath(runtime, tok);
  }
  if (segmentHasInputRedirect) {
    return `${runtime} has no script file and reads the script from an input redirect`;
  }
  return null;
}

// Index of the first positional token at or after `start`, skipping flags
// (with their values), redirects (with their targets), and process
// substitutions. A bare "-" is positional. Returns -1 when there is none.
function findDenoPositional(args, start) {
  let i = start;
  while (i < args.length) {
    const tok = args[i];
    if (tok === '-') return i;
    if (isInputRedirect(tok) || isOutputRedirect(tok)) {
      if (isProcessSubstitution(tok)) { i += 1; continue; }
      i += 2;
      continue;
    }
    if (tok.startsWith('-')) {
      if (DENO_VALUE_FLAGS.has(tok)) { i += 2; continue; }
      i += 1;
      continue;
    }
    return i;
  }
  return -1;
}

// Flags (and consumed flag values) from `start` up to the first positional
// that carry an unresolved expansion. Walks the same way findDenoPositional
// does. Returns a reason string on block, else null.
function checkDenoFlags(args, start) {
  let i = start;
  while (i < args.length) {
    const tok = args[i];
    if (tok === '-') return null;
    if (isInputRedirect(tok) || isOutputRedirect(tok)) {
      if (isProcessSubstitution(tok)) { i += 1; continue; }
      i += 2;
      continue;
    }
    if (!tok.startsWith('-')) return null;
    if (tok.includes('$')) return `deno flag "${tok}" carries an unresolved expansion`;
    if (DENO_VALUE_FLAGS.has(tok)) {
      const value = args[i + 1];
      if (value !== undefined && value.includes('$')) {
        return `deno ${tok} value "${value}" carries an unresolved expansion`;
      }
      i += 2;
      continue;
    }
    i += 1;
  }
  return null;
}

// deno: eval and repl subcommands, stdin, data:, or unresolved-expansion
// specifiers for `deno run`, data: URLs anywhere, unresolved expansions in
// flag slots, and input redirects with no specifier.
function checkDeno(args, segmentHasInputRedirect) {
  for (const tok of args) {
    if (tok === 'eval') return 'deno eval runs an inline script';
    if (tok === 'repl') return 'deno repl is an interactive session';
    if (tok.includes('data:')) return `deno argument "${tok}" carries a data: URL`;
  }
  const flagReason = checkDenoFlags(args, 0);
  if (flagReason !== null) return flagReason;
  const subcommandIndex = findDenoPositional(args, 0);
  if (subcommandIndex === -1) {
    if (segmentHasInputRedirect) {
      return 'deno has no script specifier and reads the script from an input redirect';
    }
    return null;
  }
  if (args[subcommandIndex] !== 'run') return null;
  const runFlagReason = checkDenoFlags(args, subcommandIndex + 1);
  if (runFlagReason !== null) return runFlagReason;
  const specifierIndex = findDenoPositional(args, subcommandIndex + 1);
  if (specifierIndex === -1) {
    if (segmentHasInputRedirect) {
      return 'deno run has no script specifier and reads the script from an input redirect';
    }
    return null;
  }
  return checkScriptPath('deno run', args[specifierIndex]);
}

// Run the full analysis on a command string that a wrapper will execute, one
// level deeper. A block reason found inside names the wrapper. Past
// MAX_WRAPPER_DEPTH the string is left alone.
function analyzeWrapped(label, cmd, depth) {
  if (depth >= MAX_WRAPPER_DEPTH) return null;
  const reason = analyze(cmd, depth + 1);
  if (reason === null) return null;
  return `inside ${label}: ${reason}`;
}

// bash, zsh, sh, dash, ksh, fish: once a "-c" cluster has been seen, the
// first non-flag token is the command string. "-o name" consumes its option
// name. `bash script.sh` has no "-c" and is left alone.
function checkShellCommandString(shell, args, depth) {
  let i = 0;
  let sawCommandFlag = false;
  while (i < args.length) {
    const tok = args[i];
    if (isInputRedirect(tok) || isOutputRedirect(tok)) {
      if (isProcessSubstitution(tok)) { i += 1; continue; }
      i += 2;
      continue;
    }
    if (tok.startsWith('-')) {
      if (isCommandStringFlag(tok)) sawCommandFlag = true;
      if (/^-[a-zA-Z]*[oO]$/.test(tok)) { i += 2; continue; }
      i += 1;
      continue;
    }
    if (!sawCommandFlag) return null;
    return analyzeWrapped(`${shell} -c`, tok, depth);
  }
  return null;
}

// su, npm exec, npm x, npx: a "-c" cluster or the long flag (--command for
// su, --call for npm) takes the next token, or its "=" value, as the command
// string. Tokens after "--" belong to the invoked program.
function checkCommandFlagString(label, longFlag, args, depth) {
  let i = 0;
  while (i < args.length) {
    const tok = args[i];
    if (tok === '--') return null;
    if (isCommandStringFlag(tok) || flagName(tok) === longFlag) {
      const cmd = flagValue(args, i);
      if (cmd === undefined) return null;
      return analyzeWrapped(`${label} -c`, cmd, depth);
    }
    i += 1;
  }
  return null;
}

// Wrappers that run a token as a command string. The first one in the
// segment is checked; wrappers nested inside its string are found by the
// recursive analysis. The eval builtin gets its remaining tokens joined by a
// single space. Returns a reason string on block, else null.
function checkWrappers(tokens, depth) {
  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i];
    const base = basename(tok);
    if (tok === 'eval') return analyzeWrapped('eval', tokens.slice(i + 1).join(' '), depth);
    if (SHELLS.has(base)) return checkShellCommandString(base, tokens.slice(i + 1), depth);
    if (base === 'su') return checkCommandFlagString('su', '--command', tokens.slice(i + 1), depth);
    if (base === 'npx') return checkCommandFlagString('npx', '--call', tokens.slice(i + 1), depth);
    if (base === 'npm' && (tokens[i + 1] === 'exec' || tokens[i + 1] === 'x')) {
      return checkCommandFlagString(`npm ${tokens[i + 1]}`, '--call', tokens.slice(i + 2), depth);
    }
    i += 1;
  }
  return null;
}

// Analyze one segment's tokens. Returns the detected form as a string, or
// null when the segment passes. `depth` counts the wrapper command strings
// this analysis is nested inside. Also runs on the tokens after `bun x`.
function analyzeSegment(tokens, depth) {
  // NODE_OPTIONS=... assignments (leading, env, or export) in any segment
  for (const tok of tokens) {
    if (tok.startsWith('NODE_OPTIONS=') && tok.includes('data:')) {
      return `NODE_OPTIONS carries a data URL preload ("${tok}")`;
    }
    if (tok.startsWith('NODE_OPTIONS=') && tok.includes('$')) {
      return `NODE_OPTIONS carries an unresolved expansion ("${tok}")`;
    }
  }
  // The command word (first token that is not a NAME=value assignment) may
  // expand to anything, a runtime included; "$DIR/run.sh" can only be a path.
  const commandWord = tokens.find(tok => !isAssignment(tok));
  if (commandWord !== undefined && commandWord.includes('$') && !commandWord.includes('/')) {
    return `command word "${commandWord}" is an unresolved expansion`;
  }
  const wrapped = checkWrappers(tokens, depth);
  if (wrapped !== null) return wrapped;
  const index = tokens.findIndex(tok => runtimeName(tok) !== null);
  if (index === -1) return null;
  const runtime = runtimeName(tokens[index]);
  const args = tokens.slice(index + 1);
  const segmentHasInputRedirect = tokens.some(isInputRedirect);
  // A runtime in command position with nothing after it opens a REPL, or
  // runs a script piped in on stdin.
  if (isCommandPosition(tokens, index) && hasNoArguments(args)) {
    return `${runtime} with no arguments opens a REPL or runs a script piped in on stdin`;
  }
  if (runtime === 'deno') return checkDeno(args, segmentHasInputRedirect);
  return checkNodeFamily(runtime, args, segmentHasInputRedirect, depth);
}

// Returns the detected form as a string, or null when the command passes.
// `depth` counts the wrapper command strings this analysis is nested inside.
function analyze(cmd, depth = 0) {
  for (const tokens of splitSegments(cmd)) {
    const reason = analyzeSegment(tokens, depth);
    if (reason !== null) return reason;
  }
  return null;
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', d => { raw += d; });
process.stdin.on('end', () => {
  let data;
  try { data = JSON.parse(raw); } catch { process.exit(0); }
  if (!data || data.tool_name !== 'Bash') process.exit(0);

  let form = null;
  try {
    // String coercion: a non-string command would throw and fail open.
    // Zero-width strip: prevents `node \u200B-e x` evasion.
    const cmd = String(data.tool_input?.command ?? '').trim().replace(ZERO_WIDTH, '');
    if (!cmd) process.exit(0);
    form = analyze(cmd);
  } catch {
    process.exit(0);
  }
  if (form === null) process.exit(0);

  const reason = `${form}. ${TAIL}`;

  process.stderr.write(`\n⛔ INLINE-SCRIPT: ${reason}\n\n`);

  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }));
});
