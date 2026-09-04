#!/usr/bin/env node
'use strict';

/**
 * jamf-policy-guard.js: SessionStart hook, personal profile only
 *
 * Watchdog for the Jamf policy gate. IT's Jamf policy writes
 * /Library/Application Support/ClaudeCode/managed-settings.json, which turns
 * on Datadog telemetry and org settings for every Claude Code session on
 * this machine. The drop-in file
 * /Library/Application Support/ClaudeCode/managed-settings.d/50-profile-gate.json
 * names a policyHelper that keeps that policy out of personal (~/.claude)
 * sessions.
 *
 * When it runs: at SessionStart. In the work profile (CLAUDE_CONFIG_DIR
 * resolves to ~/.work) it exits silently; the gate is not its job there.
 *
 * What it checks in the personal profile:
 *   - the drop-in file exists
 *   - CLAUDE_CODE_ENABLE_TELEMETRY is not "1"
 *   - OTEL_METRICS_EXPORTER is unset, empty, or none
 *
 * Any failed check prints one systemMessage line telling Claude to relay the
 * warning to Chance, with the fix. It only warns. It never edits anything,
 * never exits non-zero (exit 2 would block session start), and any internal
 * error exits 0 silently.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const DROP_IN_DIR = '/Library/Application Support/ClaudeCode/managed-settings.d';
const DROP_IN_PATH = path.join(DROP_IN_DIR, '50-profile-gate.json');
const MESSAGE_PREFIX = 'JAMF POLICY GUARD:';

/**
 * Pure decision. Returns null when the session should start silently, or the
 * warning text Claude must relay.
 *
 * @param {object} input
 * @param {string|null} input.configDir realpath of CLAUDE_CONFIG_DIR, or null when unset or unresolvable
 * @param {string|null} input.workDir realpath of ~/.work, or null when unresolvable
 * @param {boolean} input.dropInExists whether the drop-in file exists
 * @param {string|undefined} input.enableTelemetry value of CLAUDE_CODE_ENABLE_TELEMETRY
 * @param {string|undefined} input.otelMetricsExporter value of OTEL_METRICS_EXPORTER
 * @returns {string|null}
 */
function checkPolicyGate({ configDir, workDir, dropInExists, enableTelemetry, otelMetricsExporter }) {
  const isWorkProfile = typeof configDir === 'string' && configDir !== '' && configDir === workDir;
  if (isWorkProfile) return null;

  const otelIsSignal = typeof otelMetricsExporter === 'string'
    && otelMetricsExporter !== ''
    && otelMetricsExporter !== 'none';
  const checks = [
    [!dropInExists, `drop-in file ${DROP_IN_PATH} is missing`],
    [enableTelemetry === '1', 'CLAUDE_CODE_ENABLE_TELEMETRY is 1'],
    [otelIsSignal, `OTEL_METRICS_EXPORTER is set to "${otelMetricsExporter}"`],
  ];
  const signals = checks.reduce((acc, [failed, text]) => {
    if (!failed) return acc;
    return [...acc, text];
  }, []);

  if (signals.length === 0) return null;

  return [
    `${MESSAGE_PREFIX} this personal session is running under IT's full Jamf policy, so Datadog usage reporting and org settings are active in this session.`,
    'Signals:',
    ...signals.map(signal => `  - ${signal}`),
    'Relay this message to Chance verbatim before doing anything else.',
    'Fix: run /status to see which managed source applied. If the drop-in directory is gone, recreate it with',
    `  sudo install -d -o cgraff -g admin -m 755 "${DROP_IN_DIR}"`,
    `then rewrite the drop-in file ${DROP_IN_PATH} and relaunch.`,
  ].join('\n');
}

function resolveRealpath(value) {
  if (typeof value !== 'string' || value === '') return null;
  try {
    return fs.realpathSync(value);
  } catch {
    return null;
  }
}

function main() {
  try {
    // An EPIPE on stdout (the harness closed the pipe) must not become a
    // non-zero exit.
    process.stdout.on('error', () => {
      process.exit(0);
    });
    // stdin carries the SessionStart JSON. Its content is not used, but it is
    // drained to end like the other hooks.
    process.stdin.on('error', () => {
      process.exit(0);
    });
    process.stdin.resume();
    process.stdin.on('end', () => {
      try {
        const message = checkPolicyGate({
          configDir: resolveRealpath(process.env.CLAUDE_CONFIG_DIR),
          workDir: resolveRealpath(path.join(os.homedir(), '.work')),
          dropInExists: fs.existsSync(DROP_IN_PATH),
          enableTelemetry: process.env.CLAUDE_CODE_ENABLE_TELEMETRY,
          otelMetricsExporter: process.env.OTEL_METRICS_EXPORTER,
        });
        if (message !== null) {
          process.stdout.write(`${JSON.stringify({ systemMessage: message })}\n`, () => {
            process.exit(0);
          });
          return;
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

module.exports = { checkPolicyGate };
