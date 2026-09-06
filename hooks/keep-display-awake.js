#!/usr/bin/env node
'use strict';

/**
 * keep-display-awake.js: SessionStart hook, macOS only
 *
 * Claude Code keeps the machine from sleeping with its own
 * `caffeinate -i -t 300`, renewed each turn. The `-i` flag holds system
 * sleep only; it holds no display assertion, so the screensaver and display
 * sleep still fire during a multi-hour workflow run (Chance, 2026-09-05).
 *
 * What it does: at SessionStart it finds the Claude Code process that owns
 * this session by walking up from its own parent, and starts
 * `caffeinate -d -i -w <that pid>` detached. `-d` holds the display, `-w`
 * ends the lock when that process exits, so nothing lingers past the
 * session. When such a lock already runs for that process (SessionStart
 * fires again on resume, clear and compact) it starts nothing.
 *
 * It only starts a lock. It never edits anything, never exits non-zero (exit
 * 2 would block session start), and any internal error exits 0 silently.
 */

const { execFileSync, spawn } = require('child_process');

const CLAUDE_COMMAND = /(^|\/)claude(\s|$)/;
const MAX_ANCESTORS = 8;

/**
 * Pure decision. Returns the pid to hold the display for, or null when no
 * lock should be started.
 *
 * @param {object} input
 * @param {number} input.hookPid the hook's own pid
 * @param {Array<{pid: number, ppid: number, command: string}>} input.processes the process table, or the part of it the ancestors sit in
 * @param {string[]} input.commands every running process's command line, for the duplicate check
 * @param {string} input.platform process.platform
 * @returns {number|null}
 */
function planKeepAwake({ hookPid, processes, commands, platform }) {
  if (platform !== 'darwin') return null;

  const byPid = new Map(processes.map(entry => [entry.pid, entry]));
  const claudePid = findClaudeAncestor(byPid, hookPid, MAX_ANCESTORS);
  if (claudePid === null) return null;

  const wanted = `caffeinate -d -i -w ${claudePid}`;
  const alreadyRunning = commands.some(command => command.trim() === wanted);
  if (alreadyRunning) return null;

  return claudePid;
}

function findClaudeAncestor(byPid, pid, remaining) {
  if (remaining === 0) return null;
  const entry = byPid.get(pid);
  if (entry === undefined) return null;
  if (CLAUDE_COMMAND.test(entry.command)) return entry.pid;
  if (entry.ppid <= 1) return null;
  return findClaudeAncestor(byPid, entry.ppid, remaining - 1);
}

function readProcessTable() {
  const output = execFileSync('ps', ['-axo', 'pid=,ppid=,command='], { encoding: 'utf8' });
  return output.split('\n').reduce((accumulated, line) => {
    const match = /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(line);
    if (match === null) return accumulated;
    return [
      ...accumulated,
      { pid: Number(match[1]), ppid: Number(match[2]), command: match[3] },
    ];
  }, []);
}

function main() {
  try {
    process.stdout.on('error', () => {
      process.exit(0);
    });
    process.stdin.on('error', () => {
      process.exit(0);
    });
    process.stdin.resume();
    process.stdin.on('end', () => {
      try {
        const processes = readProcessTable();
        const claudePid = planKeepAwake({
          hookPid: process.pid,
          processes,
          commands: processes.map(entry => entry.command),
          platform: process.platform,
        });
        if (claudePid !== null) {
          const child = spawn('caffeinate', ['-d', '-i', '-w', String(claudePid)], {
            detached: true,
            stdio: 'ignore',
          });
          child.unref();
        }
        process.exit(0);
      } catch {
        process.exit(0);
      }
    });
  } catch {
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

module.exports = { planKeepAwake };
