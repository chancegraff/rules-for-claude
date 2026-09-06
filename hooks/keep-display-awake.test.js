#!/usr/bin/env node
'use strict';

// keep-display-awake.test.js: tests for the keep-display-awake SessionStart
// hook. Pure-function cases call planKeepAwake directly. One entry-point case
// spawns the hook with JSON on stdin and checks it exits 0. One case reads
// settings.json to check the hook is registered under SessionStart.
//
// Run with: node --test /Users/cgraff/.claude/hooks/keep-display-awake.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const hookPath = path.join(__dirname, 'keep-display-awake.js');
const settingsPath = path.join(__dirname, '..', 'settings.json');
const { planKeepAwake } = require(hookPath);

const table = [
  { pid: 1, ppid: 0, command: '/sbin/launchd' },
  { pid: 500, ppid: 1, command: '/Applications/iTerm.app/Contents/MacOS/iTerm2' },
  { pid: 96009, ppid: 500, command: 'claude --resume 154f11ee-7e27-4925-a1ce-1d87f678dac6' },
  { pid: 27999, ppid: 96009, command: 'caffeinate -i -t 300' },
  { pid: 31000, ppid: 96009, command: '/bin/sh -c node ~/.claude/hooks/keep-display-awake.js' },
  { pid: 31001, ppid: 31000, command: 'node /Users/cgraff/.claude/hooks/keep-display-awake.js' },
];

function plan(overrides) {
  return planKeepAwake({
    hookPid: 31001,
    processes: table,
    commands: table.map(entry => entry.command),
    platform: 'darwin',
    ...overrides,
  });
}

test('finds the claude process above the hook and returns its pid', () => {
  assert.equal(plan({}), 96009);
});

test('starts nothing when a display lock for that pid already runs', () => {
  const commands = [...table.map(entry => entry.command), 'caffeinate -d -i -w 96009'];
  assert.equal(plan({ commands }), null);
});

test('the system-only lock Claude Code runs does not count as the display lock', () => {
  assert.equal(plan({}), 96009);
});

test('starts nothing off macOS', () => {
  assert.equal(plan({ platform: 'linux' }), null);
});

test('starts nothing when no claude process is an ancestor', () => {
  const orphan = [
    { pid: 1, ppid: 0, command: '/sbin/launchd' },
    { pid: 700, ppid: 1, command: '/bin/zsh' },
    { pid: 701, ppid: 700, command: 'node /Users/cgraff/.claude/hooks/keep-display-awake.js' },
  ];
  assert.equal(plan({ hookPid: 701, processes: orphan, commands: orphan.map(entry => entry.command) }), null);
});

test('starts nothing when the hook pid is not in the table', () => {
  assert.equal(plan({ hookPid: 42 }), null);
});

test('the entry point exits 0 on SessionStart JSON', () => {
  const result = spawnSync(process.execPath, [hookPath], {
    input: JSON.stringify({ session_id: 'test', cwd: '/tmp', hook_event_name: 'SessionStart' }),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0);
});

test('the hook is registered under SessionStart in settings.json', () => {
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  const commands = settings.hooks.SessionStart.flatMap(entry => entry.hooks.map(hook => hook.command));
  assert.ok(commands.includes('node ~/.claude/hooks/keep-display-awake.js'));
});
