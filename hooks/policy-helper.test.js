#!/usr/bin/env node
'use strict';

// policy-helper.test.js: tests for the policy-helper managed-settings
// gatekeeper. The pure function is driven directly with config dir, work dir,
// and managed file text; the org CLAUDE.md capture is driven through its
// planner and against a temp directory; two cases spawn the entry point and
// check the envelope it prints for each profile.
//
// Run with: node --test /Users/cgraff/.work/hooks/policy-helper.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const helperPath = path.join(__dirname, 'policy-helper.js');
const { buildManagedSettings, planOrgClaudeMdSync, syncOrgClaudeMd, QUIET_MARKER } = require(helperPath);

const ORG_TEXT = '# Security Guardrails\n\n- Do not approve pull requests.\n';
const ORG_TEXT_UPDATED = '# Security Guardrails\n\n- Do not approve pull requests.\n- Do not delete repositories.\n';

// This directory exists, so realpath resolves it; it stands in for ~/.work.
const WORK_DIR = __dirname;
const MISSING_DIR = path.join(__dirname, 'no-such-directory-for-policy-helper-tests');

const FULL_POLICY = {
  otelHeadersHelper: '/Library/Application Support/ClaudeCode/otel-headers',
  policyHelper: { path: '/Users/cgraff/.work/hooks/policy-helper.js', timeoutMs: 10000 },
  permissions: {
    allow: ['Bash(gh pr view *)', 'Bash(npm *)'],
    deny: ['Bash(gh pr review --approve *)', 'Bash(gh repo delete *)'],
  },
  env: {
    CLAUDE_CODE_ENABLE_TELEMETRY: '1',
    OTEL_METRICS_EXPORTER: 'otlp',
    OTEL_LOGS_EXPORTER: 'otlp',
    OTEL_EXPORTER_OTLP_METRICS_ENDPOINT: 'https://otlp.example.test:4318',
    OTEL_RESOURCE_ATTRIBUTES: 'service.name=claude-code,team=platform',
  },
  enabledPlugins: { 'slack@attentive-marketplace': true },
};

// What the personal profile makes of FULL_POLICY: the deny list as is, and
// every env key pinned by the three value rules (the telemetry flag to '0',
// an _EXPORTER suffix to 'none', anything else to '').
const PERSONAL_FULL = {
  permissions: { deny: FULL_POLICY.permissions.deny },
  env: {
    CLAUDE_CODE_ENABLE_TELEMETRY: '0',
    OTEL_METRICS_EXPORTER: 'none',
    OTEL_LOGS_EXPORTER: 'none',
    OTEL_EXPORTER_OTLP_METRICS_ENDPOINT: '',
    OTEL_RESOURCE_ATTRIBUTES: '',
  },
};

function envWithout(name) {
  return Object.entries(process.env).reduce((acc, [key, value]) => {
    if (key === name) return acc;
    return { ...acc, [key]: value };
  }, {});
}

function runHelper(env) {
  return spawnSync(process.execPath, [helperPath], { env, encoding: 'utf8' });
}

test('work profile passes the policy through without policyHelper', () => {
  const text = JSON.stringify(FULL_POLICY);
  const result = buildManagedSettings(WORK_DIR, WORK_DIR, text);
  assert.deepEqual(result, {
    otelHeadersHelper: FULL_POLICY.otelHeadersHelper,
    permissions: FULL_POLICY.permissions,
    env: FULL_POLICY.env,
    enabledPlugins: FULL_POLICY.enabledPlugins,
  });
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'policyHelper'), false);
});

test('work profile builds a fresh object per call and leaves the source policy intact', () => {
  const text = JSON.stringify(FULL_POLICY);
  const first = buildManagedSettings(WORK_DIR, WORK_DIR, text);
  first.permissions.deny.push('Bash(rm *)');
  first.injected = true;
  const second = buildManagedSettings(WORK_DIR, WORK_DIR, text);
  assert.notEqual(first, second);
  assert.equal(Object.prototype.hasOwnProperty.call(second, 'injected'), false);
  assert.deepEqual(second.permissions.deny, FULL_POLICY.permissions.deny);
});

test('work profile matches through a symlinked config dir', () => {
  const realDir = fs.mkdtempSync(path.join(os.tmpdir(), 'policy-helper-work-'));
  const linkPath = `${realDir}-link`;
  fs.symlinkSync(realDir, linkPath);
  try {
    const result = buildManagedSettings(linkPath, realDir, JSON.stringify(FULL_POLICY));
    assert.deepEqual(result, {
      otelHeadersHelper: FULL_POLICY.otelHeadersHelper,
      permissions: FULL_POLICY.permissions,
      env: FULL_POLICY.env,
      enabledPlugins: FULL_POLICY.enabledPlugins,
    });
  } finally {
    // rmSync follows the link and refuses a directory; unlinkSync removes the
    // link itself.
    fs.unlinkSync(linkPath);
    fs.rmSync(realDir, { recursive: true, force: true });
  }
});

test('work profile with no policyHelper key passes the policy through unchanged', () => {
  const policy = { permissions: { deny: ['Bash(gh repo delete *)'] }, env: { A: '1' } };
  assert.deepEqual(buildManagedSettings(WORK_DIR, WORK_DIR, JSON.stringify(policy)), policy);
});

test('personal profile keeps the deny list and pins every env variable to a neutral value', () => {
  const result = buildManagedSettings(path.join(__dirname, 'lib'), WORK_DIR, JSON.stringify(FULL_POLICY));
  assert.deepEqual(result, PERSONAL_FULL);
});

test('personal profile pins env keys whatever their values are', () => {
  const policy = {
    env: { CLAUDE_CODE_ENABLE_TELEMETRY: 1, OTEL_TRACES_EXPORTER: null, OTEL_EXPORTER_OTLP_HEADERS: ['a'] },
  };
  const result = buildManagedSettings(undefined, WORK_DIR, JSON.stringify(policy));
  assert.deepEqual(result, {
    env: { CLAUDE_CODE_ENABLE_TELEMETRY: '0', OTEL_TRACES_EXPORTER: 'none', OTEL_EXPORTER_OTLP_HEADERS: '' },
  });
});

test('personal profile with env but no deny list returns only the env block', () => {
  const env = { CLAUDE_CODE_ENABLE_TELEMETRY: '1' };
  const cases = [
    { env },
    { permissions: { allow: ['Bash(npm *)'] }, env },
    { permissions: { deny: [] }, env },
    { permissions: { deny: 'Bash(gh repo delete *)' }, env },
    { permissions: { deny: ['Bash(gh repo delete *)', 7] }, env },
    { permissions: 'deny', env },
  ];
  for (const policy of cases) {
    const result = buildManagedSettings(undefined, WORK_DIR, JSON.stringify(policy));
    assert.deepEqual(result, { env: { CLAUDE_CODE_ENABLE_TELEMETRY: '0' } }, JSON.stringify(policy));
  }
});

test('personal profile with no deny list and no usable env returns an empty policy', () => {
  const cases = [
    { permissions: { allow: ['Bash(npm *)'] } },
    { permissions: { deny: [] } },
    { permissions: { deny: 'Bash(gh repo delete *)' } },
    { permissions: { deny: ['Bash(gh repo delete *)', 7] } },
    { permissions: 'deny' },
    { env: {} },
    { env: null },
    { env: 'CLAUDE_CODE_ENABLE_TELEMETRY=1' },
    { env: ['CLAUDE_CODE_ENABLE_TELEMETRY'] },
    { env: 42 },
    {},
  ];
  for (const policy of cases) {
    const result = buildManagedSettings(undefined, WORK_DIR, JSON.stringify(policy));
    assert.deepEqual(result, {}, JSON.stringify(policy));
  }
});

test('personal profile with a deny list but no usable env omits the env key', () => {
  const deny = ['Bash(gh repo delete *)'];
  const cases = [
    { permissions: { deny } },
    { permissions: { deny }, env: {} },
    { permissions: { deny }, env: null },
    { permissions: { deny }, env: 'CLAUDE_CODE_ENABLE_TELEMETRY=1' },
    { permissions: { deny }, env: ['CLAUDE_CODE_ENABLE_TELEMETRY'] },
    { permissions: { deny }, env: 42 },
  ];
  for (const policy of cases) {
    const result = buildManagedSettings(undefined, WORK_DIR, JSON.stringify(policy));
    assert.deepEqual(result, { permissions: { deny } }, JSON.stringify(policy));
  }
});

test('personal profile builds a fresh object per call and leaves the source policy intact', () => {
  const text = JSON.stringify(FULL_POLICY);
  const first = buildManagedSettings(undefined, WORK_DIR, text);
  first.env.CLAUDE_CODE_ENABLE_TELEMETRY = '1';
  first.env.INJECTED = 'x';
  first.permissions.deny.push('Bash(rm *)');
  const second = buildManagedSettings(undefined, WORK_DIR, text);
  assert.notEqual(first, second);
  assert.notEqual(first.env, second.env);
  assert.deepEqual(second, PERSONAL_FULL);
});

test('unset config dir is personal', () => {
  const result = buildManagedSettings(undefined, WORK_DIR, JSON.stringify(FULL_POLICY));
  assert.deepEqual(result, PERSONAL_FULL);
});

test('empty config dir is personal', () => {
  const result = buildManagedSettings('', WORK_DIR, JSON.stringify(FULL_POLICY));
  assert.deepEqual(result, PERSONAL_FULL);
});

test('config dir pointing at a nonexistent path is personal', () => {
  const result = buildManagedSettings(MISSING_DIR, WORK_DIR, JSON.stringify(FULL_POLICY));
  assert.deepEqual(result, PERSONAL_FULL);
});

test('a work dir that does not exist never matches', () => {
  const result = buildManagedSettings(MISSING_DIR, MISSING_DIR, JSON.stringify(FULL_POLICY));
  assert.deepEqual(result, PERSONAL_FULL);
});

test('invalid JSON, empty text, and non-object JSON yield an empty policy in both profiles', () => {
  const texts = ['not json', '', '[]', '["Bash(gh repo delete *)"]', 'null', '42', '"deny"', undefined];
  for (const text of texts) {
    assert.deepEqual(buildManagedSettings(WORK_DIR, WORK_DIR, text), {}, `work: ${JSON.stringify(text)}`);
    assert.deepEqual(buildManagedSettings(undefined, WORK_DIR, text), {}, `personal: ${JSON.stringify(text)}`);
  }
});

test('planner does nothing for non-string, blank, or already-quiet org text', () => {
  const texts = [undefined, null, 42, ['# text'], '', '   \n\t\n', QUIET_MARKER, QUIET_MARKER.trim(), `\n\n${QUIET_MARKER}\n`];
  for (const orgText of texts) {
    assert.deepEqual(planOrgClaudeMdSync(orgText, null), { snapshot: null, quiet: false }, `no snapshot: ${JSON.stringify(orgText)}`);
    assert.deepEqual(planOrgClaudeMdSync(orgText, ORG_TEXT), { snapshot: null, quiet: false }, `with snapshot: ${JSON.stringify(orgText)}`);
  }
});

test('planner captures real org text when no snapshot exists', () => {
  assert.deepEqual(planOrgClaudeMdSync(ORG_TEXT, null), { snapshot: ORG_TEXT, quiet: true });
});

test('planner quiets without rewriting a snapshot that already matches', () => {
  assert.deepEqual(planOrgClaudeMdSync(ORG_TEXT, ORG_TEXT), { snapshot: null, quiet: true });
});

test('planner rewrites the snapshot when the org text differs from it', () => {
  assert.deepEqual(planOrgClaudeMdSync(ORG_TEXT_UPDATED, ORG_TEXT), { snapshot: ORG_TEXT_UPDATED, quiet: true });
});

test('sync captures the org file into the snapshot and quiets the original, then stays put on a rerun', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'policy-helper-org-'));
  try {
    const orgPath = path.join(dir, 'CLAUDE.md');
    const snapshotPath = path.join(dir, 'org-CLAUDE.md');
    fs.writeFileSync(orgPath, ORG_TEXT, 'utf8');
    syncOrgClaudeMd(orgPath, snapshotPath);
    assert.equal(fs.readFileSync(snapshotPath, 'utf8'), ORG_TEXT);
    assert.equal(fs.readFileSync(orgPath, 'utf8'), QUIET_MARKER);
    const snapshotStatBefore = fs.statSync(snapshotPath);
    syncOrgClaudeMd(orgPath, snapshotPath);
    assert.equal(fs.readFileSync(snapshotPath, 'utf8'), ORG_TEXT);
    assert.equal(fs.readFileSync(orgPath, 'utf8'), QUIET_MARKER);
    assert.equal(fs.statSync(snapshotPath).mtimeMs, snapshotStatBefore.mtimeMs);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('sync with a missing org file creates no snapshot and throws nothing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'policy-helper-org-'));
  try {
    const orgPath = path.join(dir, 'CLAUDE.md');
    const snapshotPath = path.join(dir, 'org-CLAUDE.md');
    syncOrgClaudeMd(orgPath, snapshotPath);
    assert.equal(fs.existsSync(snapshotPath), false);
    assert.equal(fs.existsSync(orgPath), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('sync updates the snapshot and quiets again after the org file is rewritten with new text', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'policy-helper-org-'));
  try {
    const orgPath = path.join(dir, 'CLAUDE.md');
    const snapshotPath = path.join(dir, 'org-CLAUDE.md');
    fs.writeFileSync(orgPath, ORG_TEXT, 'utf8');
    syncOrgClaudeMd(orgPath, snapshotPath);
    fs.writeFileSync(orgPath, ORG_TEXT_UPDATED, 'utf8');
    syncOrgClaudeMd(orgPath, snapshotPath);
    assert.equal(fs.readFileSync(snapshotPath, 'utf8'), ORG_TEXT_UPDATED);
    assert.equal(fs.readFileSync(orgPath, 'utf8'), QUIET_MARKER);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('sync leaves the org file alone when the snapshot cannot be written', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'policy-helper-org-'));
  try {
    const orgPath = path.join(dir, 'CLAUDE.md');
    const snapshotPath = path.join(dir, 'no-such-directory', 'org-CLAUDE.md');
    fs.writeFileSync(orgPath, ORG_TEXT, 'utf8');
    syncOrgClaudeMd(orgPath, snapshotPath);
    assert.equal(fs.existsSync(snapshotPath), false);
    assert.equal(fs.readFileSync(orgPath, 'utf8'), ORG_TEXT);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('entry point prints a valid envelope for the personal profile', () => {
  const result = runHelper(envWithout('CLAUDE_CONFIG_DIR'));
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  assert.ok(result.stdout.endsWith('\n'));
  const parsed = JSON.parse(result.stdout);
  assert.equal(typeof parsed, 'object');
  assert.notEqual(parsed, null);
  assert.equal(typeof parsed.managedSettings, 'object');
  assert.notEqual(parsed.managedSettings, null);
  assert.equal(Array.isArray(parsed.managedSettings), false);
  // Content-independent proof that the wiring filters: whatever IT's file
  // holds today, only a deny list and a neutral env block can come through.
  const managed = parsed.managedSettings;
  const keys = Object.keys(managed);
  assert.ok(keys.every(key => key === 'permissions' || key === 'env'), `unexpected keys: ${JSON.stringify(keys)}`);
  if (Object.prototype.hasOwnProperty.call(managed, 'permissions')) {
    const permissions = managed.permissions;
    assert.deepEqual(Object.keys(permissions), ['deny']);
    assert.ok(Array.isArray(permissions.deny));
    assert.ok(permissions.deny.every(rule => typeof rule === 'string'));
  }
  if (Object.prototype.hasOwnProperty.call(managed, 'env')) {
    const env = managed.env;
    assert.equal(typeof env, 'object');
    assert.notEqual(env, null);
    assert.equal(Array.isArray(env), false);
    const values = Object.values(env);
    assert.ok(values.every(value => value === '0' || value === 'none' || value === ''), `unexpected env values: ${JSON.stringify(env)}`);
    if (Object.prototype.hasOwnProperty.call(env, 'CLAUDE_CODE_ENABLE_TELEMETRY')) {
      assert.equal(env.CLAUDE_CODE_ENABLE_TELEMETRY, '0');
    }
    if (Object.prototype.hasOwnProperty.call(env, 'OTEL_METRICS_EXPORTER')) {
      assert.equal(env.OTEL_METRICS_EXPORTER, 'none');
    }
  }
});

test('entry point prints a valid envelope for the work profile', () => {
  const env = { ...envWithout('CLAUDE_CONFIG_DIR'), CLAUDE_CONFIG_DIR: '/Users/cgraff/.work' };
  const result = runHelper(env);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  assert.ok(result.stdout.endsWith('\n'));
  const parsed = JSON.parse(result.stdout);
  assert.equal(typeof parsed, 'object');
  assert.notEqual(parsed, null);
  assert.equal(typeof parsed.managedSettings, 'object');
  assert.notEqual(parsed.managedSettings, null);
  assert.equal(Array.isArray(parsed.managedSettings), false);
  assert.equal(Object.prototype.hasOwnProperty.call(parsed.managedSettings, 'policyHelper'), false);
});
