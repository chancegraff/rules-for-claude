#!/usr/bin/env node
'use strict';

/**
 * prompt-clock.js: UserPromptSubmit hook
 *
 * Injects the exact current time into the model's context on every prompt
 * submit: the ISO UTC instant and the machine's local time with its zone
 * abbreviation. The model then reads the clock instead of guessing it
 * (Chance, 2026-09-09 01:32 UTC: "Could we write a hook so that you always
 * receive the `date -u` when a user submits a message?"). project-aig rule 32
 * demands exact timestamps with a zone.
 *
 * It needs nothing from stdin (drained so the process exits cleanly), prints
 * one JSON object to stdout, and always exits 0. It never blocks the prompt.
 */

const LOCAL_FORMAT = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
  timeZoneName: 'short',
});

/**
 * @param {Date} now
 * @returns {string} e.g. 2026-09-09T01:32:45Z
 */
function formatUtc(now) {
  return now.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * @param {Date} now
 * @returns {string} e.g. 2026-09-08 21:32:45 EDT
 */
function formatLocal(now) {
  const parts = LOCAL_FORMAT.formatToParts(now).reduce(
    (accumulated, part) => ({ ...accumulated, [part.type]: part.value }),
    {},
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} ${parts.timeZoneName}`;
}

/**
 * Pure. Builds the context line the hook injects.
 *
 * @param {Date} now
 * @returns {string}
 */
function buildContext(now) {
  return `Clock at prompt submit: ${formatUtc(now)} (UTC); ${formatLocal(now)} (the machine's zone). Use these exact values when stamping anything; never estimate a time.`;
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
        const output = {
          hookSpecificOutput: {
            hookEventName: 'UserPromptSubmit',
            additionalContext: buildContext(new Date()),
          },
        };
        process.stdout.write(`${JSON.stringify(output)}\n`);
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

module.exports = { buildContext, formatLocal, formatUtc };
