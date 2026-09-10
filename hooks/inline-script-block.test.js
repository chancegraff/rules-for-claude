#!/usr/bin/env node
'use strict';

// inline-script-block.test.js: tests for the inline-script-block PreToolUse
// hook. Each case spawns the hook with a Bash tool_input on stdin and checks
// the permission decision.
//
// Run with: node --test /Users/cgraff/.work/hooks/inline-script-block.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const hookPath = path.join(__dirname, 'inline-script-block.js');

const BAN_SENTENCE = 'Inline scripts are banned. Write the code to a file in the source tree and run that file.';

function runHook(input) {
  return spawnSync(process.execPath, [hookPath], { input, encoding: 'utf8' });
}

function decision(command) {
  const result = runHook(JSON.stringify({ tool_name: 'Bash', tool_input: { command } }));
  if (result.stdout === '' && result.status === 0) return 'allow';
  const parsed = JSON.parse(result.stdout);
  if (parsed.hookSpecificOutput.permissionDecision === 'deny') return 'deny';
  return `unexpected output: ${result.stdout}`;
}

const DENY = [
  // eval / print / interactive flags in any spelling
  'node -e "console.log(1)"',
  "node '-e' 'x'",
  'node "-e" x',
  'node --eval x',
  'node --eval=x',
  'node -p 1',
  'node -pe 1',
  'node -ep 1',
  'node -ie',
  'node -i',
  'node --interactive',
  'node --print 1',
  'node --print=1',
  'node --input-type=module -e x',
  'node --input-type module',
  'node --no-warnings -e x',
  "node $'-e' x",
  'node -e x file.js',
  // stdin scripts
  'node -',
  'node - --flag',
  'node --input-type=module -',
  'node -- -',
  'node /dev/stdin',
  'node /dev/fd/0',
  'node <<EOF\nconsole.log(1)\nEOF',
  'node <<-EOF\nconsole.log(1)\nEOF',
  'node < script.js',
  "node <<< 'x'",
  'node --no-warnings < script.js',
  'node <(echo x)',
  'node 0< script.js',
  // data: URL preloads
  "node --import 'data:text/javascript,console.log(1)'",
  'node --import=data:text/javascript,x',
  'node --loader data:text/javascript,x file.js',
  'node -r data:text/javascript,x file.js',
  "NODE_OPTIONS='--import=data:text/javascript,x' node --version",
  'export NODE_OPTIONS=--import=data:text/javascript,x',
  'env NODE_OPTIONS="--import=data:text/javascript,x" node file.js',
  // wrappers, env prefixes, absolute runtime paths
  'pnpm node -e x',
  'yarn node -e x',
  'npx tsx -e x',
  'timeout 5 node -e x',
  'FOO=1 node -e x',
  '/Users/cgraff/.nodenv/shims/node -e x',
  './node_modules/.bin/tsx -e x',
  'echo $(node -e x)',
  '(node -e x)',
  'xargs node -e x',
  // other runtimes
  'nodejs -e x',
  'ts-node -e x',
  'ts-node -p 1',
  'tsx -e x',
  'bun -e x',
  'bun -p 1',
  'bun -',
  // deno
  "deno eval 'x'",
  'deno repl',
  'deno run -',
  'deno run -A -',
  'deno run /dev/stdin',
  "deno run 'data:application/typescript,x'",
  'deno run --import-map map.json -',
  'deno <<EOF\nx\nEOF',
  'deno run < script.ts',
  // chained segments
  'git status && node -e x',
  'ls; node -p 1',
  'ls || node -e x',
  'echo x | node -e x',
  'node -e x &',
  'ls\nnode -e x',
  // line continuation and zero-width evasion (U+200B zero-width space, U+FEFF BOM)
  'node \\\n  -e x',
  `node ${String.fromCharCode(0x200b)}-e x`,
  `node -${String.fromCharCode(0x200b)}e x`,
  `node${String.fromCharCode(0xfeff)} -e x`,
  // command strings run by a shell or wrapper
  "bash -c 'node -e x'",
  'zsh -lc "node -p 1"',
  "sh -c 'node - <<EOF\nx\nEOF'",
  '/bin/bash -c "node -e x"',
  'bash -o pipefail -c "node -e x"',
  "timeout 5 bash -c 'node -e x'",
  "su -c 'node -e x'",
  "su - root -c 'node -e x'",
  "npm exec -c 'node -e x'",
  "npm x -c 'node -e x'",
  'npx -c "node -e x"',
  "bun exec 'node -e x'",
  'eval "node -e x"',
  'eval node -e x',
  `bash -c "bash -c 'node -e x'"`,
  // unresolved expansions in the flag window and NODE_OPTIONS
  'F=-e\nnode $F x',
  'node $F x',
  'node ${F} x',
  'node "$@"',
  'node --import "$U" file.js',
  'node --max-old-space-size=$MEM build.js',
  'NODE_OPTIONS="--import=$U" node file.js',
  'deno run $S',
  'deno run --config $C script.ts',
  // bun subcommands
  'bun repl',
  'bun run -',
  'bun run --watch -',
  // bare runtime: a REPL, or a script piped in on stdin
  'node',
  'bun',
  'tsx',
  'deno',
  'node 2>&1',
  'echo x | node',
  // bare runtime under a wrapper
  'pnpm node',
  'yarn node',
  'timeout 5 node',
  'timeout 5s node',
  'timeout 1.5s node',
  'timeout 2m node',
  'timeout --signal=KILL 5s node',
  'sudo node',
  'env node',
  'command node',
  'exec node',
  'nohup node',
  'stdbuf -oL node',
  'xargs node',
  'npx node',
  'pnpm exec node',
  // bun x runs the tokens after it as a fresh command
  'bun x tsx -e x',
  'bun x tsx -p 1',
  'bunx tsx -e x',
  // a command word that is an unresolved expansion
  'bash -c "$CMD"',
  "zsh -c '$CMD'",
  'eval "$CMD"',
  'eval $CMD',
  'CMD="node -e x"\n$CMD',
  '"$@"',
  '$(which node) -e x',
];

const ALLOW = [
  // file-based invocations
  'node file.mjs',
  'node file.mjs --flag -e value',
  'node script.js -p 3000',
  'node script.js -',
  'node -- file.js',
  'node --version',
  'node -v',
  'node --env-file=.env server.js',
  'node -r ./setup.js file.js',
  'node --require ./setup.js file.js',
  'node --import ./register.mjs file.js',
  'node --import=./register.mjs file.js',
  'node --test hooks/inline-script-block.test.js',
  'node hook.js < payload.json',
  'node hook.js <<EOF\n{"a":1}\nEOF',
  'node hook.js 2>&1',
  'node --max-old-space-size=4096 build.js',
  'node --max-old-space-size 4096 build.js',
  'node -C development file.js',
  'node --title myapp file.js',
  'node ~/.work/skills/archify/bin/archify.mjs deliver architecture spec.json out.html --quality showcase --json',
  'node build.js --import=data:text/javascript,x',
  'pnpm node file.js',
  'timeout 5 node file.js',
  'timeout 5s node file.js',
  'FOO=1 node file.js',
  'NODE_OPTIONS=--max-old-space-size=4096 node build.js',
  'NODE_OPTIONS="--import=./register.mjs" node file.js',
  'nodejs file.js',
  'ts-node file.ts',
  'tsx file.ts',
  'tsx watch file.ts',
  'bun run file.ts',
  'bun file.ts',
  'bun run build',
  'bun run --watch file.ts',
  'bun x vitest run',
  // deno
  'deno run script.ts',
  'deno run --allow-read script.ts < input.json',
  'deno run --import-map map.json script.ts',
  'deno run -A --unstable script.ts -- -',
  'deno run script.ts $ARG',
  'deno run $HOME/x.ts',
  'deno test',
  'deno fmt',
  'deno --version',
  // flags only, no REPL
  'node -h',
  'node --help',
  // expansions that can only be paths or script arguments
  'node $HOME/x.js',
  'node $DIR/run.mjs --flag',
  'node ${HOME}/x.js',
  'node file.js $ARG',
  'node file.js "$@"',
  '$HOME/bin/tool args',
  '$DIR/run.sh',
  // shells and wrappers with no inline script inside
  'bash script.sh',
  'bash -x script.sh',
  "bash -c 'ls -la'",
  "bash -c 'echo $HOME'",
  "bash -c '$DIR/run.sh'",
  'zsh -c "pnpm test"',
  'eval ls',
  'npm exec -- vitest run',
  // the runtime named as data, not run
  'which node',
  'command -v node',
  'brew install node',
  'cat node',
  'echo node',
  // no runtime at all
  'pnpm test',
  'git status',
  'ls -la',
  'echo "node -e x"',
  "git commit -m 'run node -e in CI'",
  'cat node.txt',
  'ls node_modules',
  '',
];

for (const command of DENY) {
  test(`denies ${JSON.stringify(command)}`, () => {
    assert.equal(decision(command), 'deny');
  });
}

for (const command of ALLOW) {
  test(`allows ${JSON.stringify(command)}`, () => {
    assert.equal(decision(command), 'allow');
  });
}

test('deny output names the form, ends with the ban sentence, and writes the stderr banner', () => {
  const result = runHook(JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'node -pe 1' } }));
  const parsed = JSON.parse(result.stdout);
  const output = parsed.hookSpecificOutput;
  assert.equal(output.hookEventName, 'PreToolUse');
  assert.equal(output.permissionDecision, 'deny');
  assert.ok(output.permissionDecisionReason.includes('-pe'));
  assert.ok(output.permissionDecisionReason.endsWith(BAN_SENTENCE));
  assert.ok(result.stderr.includes('\n⛔ INLINE-SCRIPT: '));
  assert.equal(result.status, 0);
});

test('deny reasons name each detected form', () => {
  const cases = [
    ['node -e x', 'inline flag "-e"'],
    ['node -', 'stdin (bare "-")'],
    ['node /dev/stdin', 'stdin descriptor'],
    ['node --import=data:text/javascript,x', 'data: URL'],
    ['node < a.js', 'input redirect'],
    ['export NODE_OPTIONS=--import=data:text/javascript,x', 'NODE_OPTIONS'],
    ['deno eval x', 'deno eval'],
    ['deno repl', 'deno repl'],
    ['deno run -', 'stdin (bare "-")'],
    ['node $F', 'unresolved expansion'],
    ['node --import $U file.js', 'unresolved expansion'],
    ['NODE_OPTIONS=$O node file.js', 'NODE_OPTIONS'],
    ['deno run $S', 'unresolved expansion'],
    ['bun repl', 'bun repl'],
    ['bun run -', 'stdin (bare "-")'],
    ['node', 'REPL'],
    ['deno', 'REPL'],
    ['pnpm node', 'REPL'],
    ['timeout 5 node', 'REPL'],
    ['bun x tsx -e x', 'tsx uses the inline flag "-e"'],
    ['bun x node', 'REPL'],
    ['eval $CMD', 'command word "$CMD" is an unresolved expansion'],
    ['"$@"', 'command word "$@" is an unresolved expansion'],
  ];
  for (const [command, fragment] of cases) {
    const result = runHook(JSON.stringify({ tool_name: 'Bash', tool_input: { command } }));
    const reason = JSON.parse(result.stdout).hookSpecificOutput.permissionDecisionReason;
    assert.ok(reason.includes(fragment), `${JSON.stringify(command)}: expected ${JSON.stringify(fragment)} in ${JSON.stringify(reason)}`);
  }
});

test('reasons found inside a wrapper command string name the wrapper', () => {
  const cases = [
    ["bash -c 'node -e x'", 'inside bash -c: node uses the inline flag "-e"'],
    ['zsh -lc "node -p 1"', 'inside zsh -c: '],
    ["su -c 'node -e x'", 'inside su -c: '],
    ["npm exec -c 'node -e x'", 'inside npm exec -c: '],
    ["npm x -c 'node -e x'", 'inside npm x -c: '],
    ["bun exec 'node -e x'", 'inside bun exec: '],
    ['eval "node -e x"', 'inside eval: '],
    [`bash -c "bash -c 'node -e x'"`, 'inside bash -c: inside bash -c: '],
    ['bash -c "$CMD"', 'inside bash -c: command word "$CMD" is an unresolved expansion'],
    ["zsh -c '$CMD'", 'inside zsh -c: command word "$CMD" is an unresolved expansion'],
  ];
  for (const [command, fragment] of cases) {
    const result = runHook(JSON.stringify({ tool_name: 'Bash', tool_input: { command } }));
    const reason = JSON.parse(result.stdout).hookSpecificOutput.permissionDecisionReason;
    assert.ok(reason.includes(fragment), `${JSON.stringify(command)}: expected ${JSON.stringify(fragment)} in ${JSON.stringify(reason)}`);
  }
});

// Wraps a command in `bash -c "..."`, escaping the backslashes and double
// quotes the inner string already carries so each nesting level unquotes
// cleanly.
function wrapInBashC(inner) {
  return `bash -c "${inner.replace(/["\\]/g, ch => `\\${ch}`)}"`;
}

test('wrapper recursion stops after four levels', () => {
  const fourDeep = [1, 2, 3, 4].reduce(wrapInBashC, 'node -e x');
  const fiveDeep = wrapInBashC(fourDeep);
  assert.equal(decision(fourDeep), 'deny');
  assert.equal(decision(fiveDeep), 'allow');
});

test('ignores tools other than Bash', () => {
  const result = runHook(JSON.stringify({ tool_name: 'Read', tool_input: { file_path: 'node -e x' } }));
  assert.equal(result.stdout, '');
  assert.equal(result.status, 0);
});

test('fails open on unparseable input', () => {
  const result = runHook('not json');
  assert.equal(result.stdout, '');
  assert.equal(result.status, 0);
});

test('fails open on a non-string command', () => {
  const result = runHook(JSON.stringify({ tool_name: 'Bash', tool_input: { command: { nested: true } } }));
  assert.equal(result.stdout, '');
  assert.equal(result.status, 0);
});

test('fails open on a null payload', () => {
  const result = runHook('null');
  assert.equal(result.stdout, '');
  assert.equal(result.status, 0);
});
