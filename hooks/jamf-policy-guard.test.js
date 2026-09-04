#!/usr/bin/env node
'use strict';

// jamf-policy-guard.test.js: tests for the jamf-policy-guard SessionStart
// hook. Pure-function cases call checkPolicyGate directly. Entry-point cases
// spawn the hook with JSON on stdin and check the exit code and stdout; the
// env passed to spawnSync applies only to that child process. One case reads
// settings.json to check the hook is registered under SessionStart.
//
// Run with: node --test /Users/cgraff/.claude/hooks/jamf-policy-guard.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const hookPath = path.join(__dirname, 'jamf-policy-guard.js');
const settingsPath = path.join(__dirname, '..', 'settings.json');
const { checkPolicyGate } = require(hookPath);

const PREFIX = 'JAMF POLICY GUARD:';
const WORK_DIR = '/Users/cgraff/.work';
const MISSING_DIR = path.join(__dirname, 'no-such-directory-for-jamf-policy-guard-tests');
const DROP_IN_PATH = '/Library/Application Support/ClaudeCode/managed-settings.d/50-profile-gate.json';
const DROP_IN_SIGNAL = `drop-in file ${DROP_IN_PATH} is missing`;
const TELEMETRY_SIGNAL = 'CLAUDE_CODE_ENABLE_TELEMETRY is 1';
const OTEL_SIGNAL = 'OTEL_METRICS_EXPORTER is set to "otlp"';
const RELAY_SENTENCE = 'Relay this message to Chance verbatim before doing anything else.';
const SUDO_COMMAND = 'sudo install -d -o cgraff -g admin -m 755 "/Library/Application Support/ClaudeCode/managed-settings.d"';

const healthy = {
  configDir: '/Users/cgraff/.claude',
  workDir: WORK_DIR,
  dropInExists: true,
  enableTelemetry: undefined,
  otelMetricsExporter: undefined,
};

function runHook(env, input) {
  return spawnSync(process.execPath, [hookPath], { input, env, encoding: 'utf8' });
}

function personalEnv(extra) {
  const base = Object.entries(process.env).reduce((acc, [key, value]) => {
    if (key === 'CLAUDE_CONFIG_DIR') return acc;
    return { ...acc, [key]: value };
  }, {});
  return { ...base, ...extra };
}

test('work profile returns null even with every signal present', () => {
  const result = checkPolicyGate({
    configDir: WORK_DIR,
    workDir: WORK_DIR,
    dropInExists: false,
    enableTelemetry: '1',
    otelMetricsExporter: 'otlp',
  });
  assert.equal(result, null);
});

test('personal profile with the drop-in present and no env signals returns null', () => {
  assert.equal(checkPolicyGate(healthy), null);
});

test('unset config dir counts as personal', () => {
  assert.equal(checkPolicyGate({ ...healthy, configDir: null }), null);
  const message = checkPolicyGate({ ...healthy, configDir: null, dropInExists: false });
  assert.ok(message.startsWith(PREFIX));
});

test('telemetry "0", an empty exporter, and an exporter of "none" are not signals', () => {
  assert.equal(checkPolicyGate({ ...healthy, enableTelemetry: '0' }), null);
  assert.equal(checkPolicyGate({ ...healthy, otelMetricsExporter: '' }), null);
  assert.equal(checkPolicyGate({ ...healthy, otelMetricsExporter: 'none' }), null);
  assert.equal(checkPolicyGate({ ...healthy, enableTelemetry: '0', otelMetricsExporter: 'none' }), null);
});

test('missing drop-in alone warns and names only that signal', () => {
  const message = checkPolicyGate({ ...healthy, dropInExists: false });
  assert.ok(message.startsWith(PREFIX));
  assert.ok(message.includes(DROP_IN_SIGNAL));
  assert.ok(!message.includes(TELEMETRY_SIGNAL));
  assert.ok(!message.includes('OTEL_METRICS_EXPORTER'));
});

test('CLAUDE_CODE_ENABLE_TELEMETRY=1 alone warns and names only that signal', () => {
  const message = checkPolicyGate({ ...healthy, enableTelemetry: '1' });
  assert.ok(message.startsWith(PREFIX));
  assert.ok(message.includes(TELEMETRY_SIGNAL));
  assert.ok(!message.includes(DROP_IN_SIGNAL));
  assert.ok(!message.includes('OTEL_METRICS_EXPORTER'));
});

test('OTEL_METRICS_EXPORTER alone warns and names only that signal', () => {
  const message = checkPolicyGate({ ...healthy, otelMetricsExporter: 'otlp' });
  assert.ok(message.startsWith(PREFIX));
  assert.ok(message.includes(OTEL_SIGNAL));
  assert.ok(!message.includes(DROP_IN_SIGNAL));
  assert.ok(!message.includes(TELEMETRY_SIGNAL));
});

test('all three signals together are all listed', () => {
  const message = checkPolicyGate({
    ...healthy,
    dropInExists: false,
    enableTelemetry: '1',
    otelMetricsExporter: 'otlp',
  });
  assert.ok(message.startsWith(PREFIX));
  assert.ok(message.includes(DROP_IN_SIGNAL));
  assert.ok(message.includes(TELEMETRY_SIGNAL));
  assert.ok(message.includes(OTEL_SIGNAL));
});

test('the message explains the situation, the relay instruction, and the fix', () => {
  const message = checkPolicyGate({ ...healthy, dropInExists: false });
  assert.ok(message.includes("running under IT's full Jamf policy"));
  assert.ok(message.includes('Datadog usage reporting and org settings are active in this session'));
  assert.ok(message.includes(RELAY_SENTENCE));
  assert.ok(message.includes('/status'));
  assert.ok(message.includes(SUDO_COMMAND));
  assert.ok(message.includes('relaunch'));
});

test('entry point: work profile exits 0 with empty stdout', () => {
  const result = runHook({ ...process.env, CLAUDE_CONFIG_DIR: WORK_DIR }, '{}');
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '');
});

test('entry point: personal profile with telemetry on prints one systemMessage line and exits 0', () => {
  const result = runHook(personalEnv({ CLAUDE_CODE_ENABLE_TELEMETRY: '1' }), '{}');
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  assert.ok(result.stdout.endsWith('\n'));
  assert.equal(result.stdout.indexOf('\n'), result.stdout.length - 1);
  const parsed = JSON.parse(result.stdout);
  assert.ok(parsed.systemMessage.startsWith(PREFIX));
  assert.ok(parsed.systemMessage.includes(TELEMETRY_SIGNAL));
});

test('entry point: personal profile with telemetry 0 and exporter none exits 0 with empty stdout', () => {
  const result = runHook(personalEnv({ CLAUDE_CODE_ENABLE_TELEMETRY: '0', OTEL_METRICS_EXPORTER: 'none' }), '{}');
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '');
});

test('entry point: a config dir that does not exist is personal', () => {
  const result = runHook(personalEnv({ CLAUDE_CONFIG_DIR: MISSING_DIR, CLAUDE_CODE_ENABLE_TELEMETRY: '1' }), '{}');
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  const parsed = JSON.parse(result.stdout);
  assert.ok(parsed.systemMessage.startsWith(PREFIX));
});

test('entry point: unparseable stdin still exits 0', () => {
  const result = runHook({ ...process.env, CLAUDE_CONFIG_DIR: WORK_DIR }, 'not json');
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
});

test('hook is registered under SessionStart in settings.json', () => {
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  const entries = settings.hooks.SessionStart;
  const registered = entries.some(entry => entry.hooks.some(hook => hook.command === 'node ~/.claude/hooks/jamf-policy-guard.js'));
  assert.ok(registered);
});
