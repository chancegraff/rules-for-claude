#!/usr/bin/env node
'use strict';

// pr-body-limits-block.test.js: tests for the pr-body-limits-block PreToolUse
// hook. Command cases spawn the hook with a Bash tool_input on stdin and check
// the permission decision; body fixtures live in a temp directory; a few cases
// drive the exported body functions directly.
//
// Run with: node --test /Users/cgraff/.work/hooks/pr-body-limits-block.test.js

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const hookPath = path.join(__dirname, 'pr-body-limits-block.js');
const { checkBody, splitSentences, countWords, normalizeUnit } = require(hookPath);

const TAIL = 'Rewrite the description under ~/.work/rules/pr-descriptions.md; do not route around this hook.';

const GOLD_SUMMARY = 'Copy every V1 file in `libs/crm/src/pages/SubscriberDetail/` that has a planned V2 counterpart to a `V2` sibling. Renames are mechanical only: filename, exported symbol, GraphQL names defined in the file, and the matching generated import paths. Add each new file to the `import/no-unused-modules.ignoreExports` list in `libs/crm/.eslintrc`.';
const DEMO_TODO = "<!-- TODO: Add screenshots/video or note that visual demo isn't necessary -->";
const SHORT_TESTING = '- Ran the copied tests; all pass.\n- Type check is green.';

// Built from code points so the test source carries no literal dash.
const EM_DASH = String.fromCharCode(0x2014);
const EN_DASH = String.fromCharCode(0x2013);

// One fixture directory for the whole file; every body file lands here and
// relative --body-file paths resolve against it through the payload cwd.
const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-body-limits-'));
after(() => {
  fs.rmSync(fixtureDir, { recursive: true, force: true });
});

function writeFixture(name, text) {
  const filePath = path.join(fixtureDir, name);
  fs.writeFileSync(filePath, text, 'utf8');
  return filePath;
}

// "word1 word2 ... wordN." so a sentence has exactly N words.
function sentenceOf(n) {
  return `${Array.from({ length: n }, (_, i) => `word${i + 1}`).join(' ')}.`;
}

// The four-section template with the given section bodies.
function template({ summary = GOLD_SUMMARY, demo = DEMO_TODO, testing = SHORT_TESTING } = {}) {
  return [
    '## Jira Issue',
    '',
    'https://attentivemobile.atlassian.net/browse/USP-805',
    '',
    '## Summary',
    '',
    summary,
    '',
    '## Demo',
    '',
    demo,
    '',
    '## Testing',
    '',
    testing,
    '',
    '---',
    '',
    '*This message was authored by an AI assistant on behalf of @someone.*',
    '',
  ].join('\n');
}

function runHook(input) {
  return spawnSync(process.execPath, [hookPath], { input, encoding: 'utf8' });
}

function decision(command, cwd = fixtureDir) {
  const result = runHook(JSON.stringify({ tool_name: 'Bash', tool_input: { command }, cwd }));
  if (result.stdout === '' && result.status === 0) return 'allow';
  const parsed = JSON.parse(result.stdout);
  if (parsed.hookSpecificOutput.permissionDecision === 'deny') return 'deny';
  return `unexpected output: ${result.stdout}`;
}

function denyReason(command, cwd = fixtureDir) {
  const result = runHook(JSON.stringify({ tool_name: 'Bash', tool_input: { command }, cwd }));
  return JSON.parse(result.stdout).hookSpecificOutput.permissionDecisionReason;
}

// --- payload and command shape ---------------------------------------------

test('ignores tools other than Bash', () => {
  const result = runHook(JSON.stringify({ tool_name: 'Read', tool_input: { file_path: 'gh pr create --body x' } }));
  assert.equal(`${result.stdout}|${result.status}`, '|0');
});

test('fails open on malformed JSON', () => {
  const result = runHook('not json');
  assert.equal(`${result.stdout}|${result.status}`, '|0');
});

test('allows gh pr view', () => {
  assert.equal(decision('gh pr view 12'), 'allow');
});

test('allows gh pr edit with no body flag', () => {
  assert.equal(decision('gh pr edit 12 --add-reviewer x'), 'allow');
});

test('allows gh pr create --web', () => {
  assert.equal(decision('gh pr create --web'), 'allow');
});

test('allows a command that only mentions gh pr create as data', () => {
  assert.equal(decision('echo "gh pr create --body x"'), 'allow');
});

test('allows a flag value that looks like -b', () => {
  assert.equal(decision('gh pr create --title "-b" --web'), 'allow');
});

test('denies --body', () => {
  assert.equal(decision('gh pr create --title t --body "x"'), 'deny');
});

test('denies -b', () => {
  assert.equal(decision('gh pr edit 12 -b x'), 'deny');
});

test('denies --body=', () => {
  assert.equal(decision('gh pr edit 12 --body=x'), 'deny');
});

test('denies --body after a global --repo flag', () => {
  assert.equal(decision('gh --repo owner/repo pr create --title t --body x'), 'deny');
});

test('denies --body in a later segment', () => {
  assert.equal(decision('git status && gh pr edit 12 -b x'), 'deny');
});

test('denies --fill on create', () => {
  assert.equal(decision('gh pr create --fill'), 'deny');
});

test('denies --fill-verbose on create', () => {
  assert.equal(decision('gh pr create --fill-verbose'), 'deny');
});

test('denies --body-file -', () => {
  assert.equal(decision('gh pr create --title t --body-file -'), 'deny');
});

test('denies -F -', () => {
  assert.equal(decision('gh pr edit 12 -F -'), 'deny');
});

test('denies a --body-file path the shell would expand', () => {
  assert.equal(decision('gh pr edit 12 --body-file "$BODY"'), 'deny');
});

test('allows a missing body file', () => {
  assert.equal(decision(`gh pr edit 12 --body-file ${path.join(fixtureDir, 'no-such-file.md')}`), 'allow');
});

test('denies a body file one byte over the GitHub maximum', () => {
  const filePath = writeFixture('huge.md', 'a'.repeat(65537));
  assert.ok(denyReason(`gh pr edit 12 --body-file ${filePath}`).includes("GitHub's PR body maximum"));
});

test('fails open on a payload over MAX_PAYLOAD_BYTES', () => {
  // The command alone is 1,048,577 characters and would deny if analyzed.
  assert.equal(decision(`gh pr create --title t --body ${'x'.repeat(1048577)}`), 'allow');
});

// --- the template -----------------------------------------------------------

test('checkBody passes the four-section template with the gold-standard Summary', () => {
  assert.deepEqual(checkBody(template()), []);
});

test('allows the four-section template on create', () => {
  const filePath = writeFixture('template.md', template());
  assert.equal(decision(`gh pr create --title t --body-file ${filePath}`), 'allow');
});

test('allows the template through --body-file=path and -F path', () => {
  const filePath = writeFixture('template-spellings.md', template());
  assert.equal(`${decision(`gh pr edit 12 --body-file=${filePath}`)} ${decision(`gh pr edit 12 -F ${filePath}`)}`, 'allow allow');
});

test('resolves a relative --body-file against the payload cwd', () => {
  writeFixture('relative-bad.md', template({ summary: sentenceOf(21) }));
  assert.equal(decision('gh pr edit 12 --body-file relative-bad.md', fixtureDir), 'deny');
});

// --- limits -----------------------------------------------------------------

test('allows a 20-word Summary sentence', () => {
  const filePath = writeFixture('twenty.md', template({ summary: sentenceOf(20) }));
  assert.equal(decision(`gh pr create --title t --body-file ${filePath}`), 'allow');
});

test('denies a 21-word Summary sentence', () => {
  const filePath = writeFixture('twenty-one.md', template({ summary: sentenceOf(21) }));
  assert.equal(decision(`gh pr create --title t --body-file ${filePath}`), 'deny');
});

test('denies a 4-sentence Summary paragraph', () => {
  const filePath = writeFixture('four-sentences.md', template({ summary: 'One thing. Two things. Three things. Four things.' }));
  assert.equal(decision(`gh pr create --title t --body-file ${filePath}`), 'deny');
});

test('allows a 3-sentence Summary paragraph', () => {
  const filePath = writeFixture('three-sentences.md', template({ summary: 'One thing. Two things. Three things.' }));
  assert.equal(decision(`gh pr create --title t --body-file ${filePath}`), 'allow');
});

test('denies a 6-paragraph Summary', () => {
  const summary = Array.from({ length: 6 }, (_, i) => `Paragraph number ${i + 1}.`).join('\n\n');
  const filePath = writeFixture('six-paragraphs.md', template({ summary }));
  assert.equal(decision(`gh pr create --title t --body-file ${filePath}`), 'deny');
});

test('allows a 5-paragraph Summary', () => {
  const summary = Array.from({ length: 5 }, (_, i) => `Paragraph number ${i + 1}.`).join('\n\n');
  const filePath = writeFixture('five-paragraphs.md', template({ summary }));
  assert.equal(decision(`gh pr create --title t --body-file ${filePath}`), 'allow');
});

test('denies a Summary of 6 bullets', () => {
  const summary = Array.from({ length: 6 }, (_, i) => `- Bullet number ${i + 1}.`).join('\n');
  const filePath = writeFixture('six-bullets.md', template({ summary }));
  assert.equal(decision(`gh pr create --title t --body-file ${filePath}`), 'deny');
});

test('allows a Summary of 5 bullets', () => {
  const summary = Array.from({ length: 5 }, (_, i) => `- Bullet number ${i + 1}.`).join('\n');
  const filePath = writeFixture('five-bullets.md', template({ summary }));
  assert.equal(decision(`gh pr create --title t --body-file ${filePath}`), 'allow');
});

test('denies a 25-word Testing bullet on create', () => {
  const filePath = writeFixture('testing-create.md', template({ testing: `- ${sentenceOf(25)}` }));
  assert.equal(decision(`gh pr create --title t --body-file ${filePath}`), 'deny');
});

test('denies a 25-word Testing bullet on edit', () => {
  const filePath = writeFixture('testing-edit.md', template({ testing: `- ${sentenceOf(25)}` }));
  assert.equal(decision(`gh pr edit 12 --body-file ${filePath}`), 'deny');
});

test('allows a 40-word Demo line', () => {
  const filePath = writeFixture('demo.md', template({ demo: sentenceOf(40) }));
  assert.equal(decision(`gh pr edit 12 --body-file ${filePath}`), 'allow');
});

test('denies an em dash in the Summary', () => {
  const filePath = writeFixture('em-dash.md', template({ summary: `Copy the file ${EM_DASH} then rename it.` }));
  assert.equal(decision(`gh pr edit 12 --body-file ${filePath}`), 'deny');
});

test('denies an en dash in the Summary', () => {
  const filePath = writeFixture('en-dash.md', template({ summary: `Pages 5${EN_DASH}10 change.` }));
  assert.equal(decision(`gh pr edit 12 --body-file ${filePath}`), 'deny');
});

test('denies "leverage"', () => {
  const filePath = writeFixture('leverage.md', template({ summary: 'Leverage the shared helper.' }));
  assert.equal(decision(`gh pr edit 12 --body-file ${filePath}`), 'deny');
});

test('denies "just"', () => {
  const filePath = writeFixture('just.md', template({ summary: 'Just copy the file.' }));
  assert.equal(decision(`gh pr edit 12 --body-file ${filePath}`), 'deny');
});

test('denies an inflected banned word', () => {
  const filePath = writeFixture('leveraging.md', template({ testing: '- Leveraging the existing suite.' }));
  assert.equal(decision(`gh pr edit 12 --body-file ${filePath}`), 'deny');
});

test('allows over-limit text inside a code fence', () => {
  const summary = `Copy the file.\n\n\`\`\`\n${sentenceOf(50)} Leverage ${EM_DASH} just.\n\`\`\``;
  const filePath = writeFixture('fence.md', template({ summary }));
  assert.equal(decision(`gh pr edit 12 --body-file ${filePath}`), 'allow');
});

test('allows over-limit text inside an HTML comment in the Summary', () => {
  const summary = `Copy the file.\n\n<!-- ${sentenceOf(50)} -->`;
  const filePath = writeFixture('comment.md', template({ summary }));
  assert.equal(decision(`gh pr edit 12 --body-file ${filePath}`), 'allow');
});

test('a URL with dots and e.g. do not split a sentence', () => {
  const summary = 'See https://example.com/a.b.c for the shape, e.g. the V2 page.';
  const filePath = writeFixture('url.md', template({ summary }));
  assert.equal(`${splitSentences(summary).length} ${decision(`gh pr edit 12 --body-file ${filePath}`)}`, '1 allow');
});

test('checks the whole body when there is no Summary heading', () => {
  const filePath = writeFixture('no-summary.md', sentenceOf(21));
  assert.equal(decision(`gh pr edit 12 --body-file ${filePath}`), 'deny');
});

// --- deny output shape ------------------------------------------------------

test('deny reason names the section, the problem, and the excerpt, and ends with the closing sentence', () => {
  const filePath = writeFixture('shape.md', template({ summary: sentenceOf(21) }));
  const result = runHook(JSON.stringify({ tool_name: 'Bash', tool_input: { command: `gh pr edit 12 --body-file ${filePath}` }, cwd: fixtureDir }));
  const output = JSON.parse(result.stdout).hookSpecificOutput;
  const reason = output.permissionDecisionReason;
  const checks = [
    output.hookEventName === 'PreToolUse',
    output.permissionDecision === 'deny',
    reason.startsWith('[Summary] sentence has 21 words; the limit is 20: word1 word2'),
    reason.endsWith(TAIL),
    result.stderr.includes('\n⛔ PR-BODY-LIMITS: '),
    result.status === 0,
  ];
  assert.deepEqual(checks, [true, true, true, true, true, true]);
});

test('deny reason for --body names the file requirement', () => {
  assert.ok(denyReason('gh pr create --title t --body x').includes('--body-file'));
});

test('deny reason for a 6-paragraph Summary counts the paragraphs', () => {
  const summary = Array.from({ length: 6 }, (_, i) => `Paragraph number ${i + 1}.`).join('\n\n');
  const filePath = writeFixture('six-reason.md', template({ summary }));
  assert.ok(denyReason(`gh pr edit 12 --body-file ${filePath}`).includes('[Summary] Summary has 6 paragraphs; the limit is 5'));
});

test('reports every violation, not only the first', () => {
  const summary = `${sentenceOf(21)}\n\nOne. Two. Three. Four.`;
  const violations = checkBody(template({ summary, testing: '- Just run it.' }));
  assert.deepEqual(violations.map(v => v.problem), [
    'sentence has 21 words; the limit is 20',
    'paragraph has 4 sentences; the limit is 3',
    'uses the banned word "Just"',
  ]);
});

// --- body helpers -----------------------------------------------------------

test('splitSentences splits on . ! and ? followed by whitespace', () => {
  assert.equal(splitSentences('Copy the file. Then rename it! Done? Yes.').length, 4);
});

test('splitSentences keeps a closing quote or bracket with its sentence', () => {
  assert.deepEqual(splitSentences('Rename it (see "notes"). Then stop.'), ['Rename it (see "notes").', 'Then stop.']);
});

test('splitSentences treats a unit with no terminal punctuation as one sentence', () => {
  assert.equal(splitSentences('Type check is green').length, 1);
});

test('countWords ignores tokens with no letter or digit', () => {
  assert.equal(countWords('a , b - c ... 4'), 4);
});

test('normalizeUnit turns inline code into one word and drops markup', () => {
  assert.equal(normalizeUnit('Add **each** file to `import/no-unused-modules.ignoreExports` in [the config](https://x.y/z).'), 'Add each file to CODE in the config.');
});

test('a list block yields one unit per item with continuation lines joined', () => {
  const violations = checkBody(`## Summary\n\n- ${sentenceOf(10)}\n  ${sentenceOf(10)}\n  ${sentenceOf(10)}\n  ${sentenceOf(10)}\n- Short.`);
  assert.deepEqual(violations.map(v => v.problem), ['paragraph has 4 sentences; the limit is 3']);
});
