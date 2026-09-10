#!/usr/bin/env node
'use strict';

// pr-body-limits-block.js: PreToolUse hook (matcher: Bash)
// Enforces ~/.work/rules/pr-descriptions.md on every `gh pr create` and
// `gh pr edit` that carries a description. The description must arrive as a
// file (--body-file <path>), and the hook reads that file and checks it.
//
// Denied, in this order:
//   1. --body / -b in any spelling: the description is inline and the hook
//      cannot check it before gh sends it (~/.work/rules/pr-body-editing.md).
//   2. --fill, --fill-first, --fill-verbose on create: gh writes the
//      description from commit messages, text never checked against the rules.
//   3. --body-file - (or -F -), /dev/stdin, /dev/fd/N, a process substitution,
//      or a path carrying an unresolved $VAR: the hook cannot read it.
//   4. --body-file <path>: a file over MAX_BODY_BYTES, or a body that breaks
//      any measurable limit below. A missing or unreadable file is allowed;
//      gh fails on its own.
//   5. No body flag at all (`gh pr edit 12 --add-reviewer x`,
//      `gh pr create --web`): allowed.
//
// Body checks (checkBody): sections split on `## ` headings. Demo and Jira
// Issue are skipped; Summary, Testing, and any other section are checked. With
// no `## Summary` heading the whole body is one checked section. Fenced code
// and HTML comments are stripped first. Headings, horizontal rules, tables,
// image-only lines, and bare URL lines are skipped. A list item is one unit; a
// paragraph is one unit; the Summary cap counts units. Inline code counts as
// one word; bold, italic, and link markup drop away.
//
// Limits, each with its source:
//   MAX_WORDS_PER_SENTENCE = 20      upper end of Chance's "15-20 words"
//   MAX_SENTENCES_PER_PARAGRAPH = 3  upper end of Chance's "2-3 sentences"
//   MAX_SUMMARY_PARAGRAPHS = 5       upper end of Chance's "4-5 paragraphs"
//     (all three: Chance, 2026-09-10, quoted in ~/.work/rules/pr-descriptions.md)
//   MAX_BODY_BYTES = 65536           GitHub's pull request body maximum
//   MAX_PAYLOAD_BYTES = 1048576      the lead's budget, set 2026-09-10, well
//     above GitHub's 65,536-byte body cap plus flags; a larger payload is not
//     a gh pr command this hook can act on
//   EXCERPT_LENGTH = 60              the lead's display budget for one deny
//     line, set 2026-09-10; Chance may reset it
//   Banned words and the em/en dash ban: the Prose Style section of
//   ~/.work/CLAUDE.md. `landscape` and `navigate` are conditional there and
//   stay out.
//
// Every loop walks a bounded array: the command string's characters, the
// token arrays, or the lines, blocks, units, and sentences of a body capped
// at MAX_BODY_BYTES. Analysis failures fail open so the hook never wedges a
// Bash call.

const fs = require('fs');
const os = require('os');
const path = require('path');

const MAX_WORDS_PER_SENTENCE = 20;
const MAX_SENTENCES_PER_PARAGRAPH = 3;
const MAX_SUMMARY_PARAGRAPHS = 5;
const MAX_BODY_BYTES = 65536;
const MAX_PAYLOAD_BYTES = 1048576;
const EXCERPT_LENGTH = 60;

const TAIL = 'Rewrite the description under ~/.work/rules/pr-descriptions.md; do not route around this hook.';

// Zero-width / formatting chars that would split tokens invisibly. Kept as a
// pattern string; the RegExp is built where it is used so no module-scope
// RegExp carries lastIndex state.
const ZERO_WIDTH_PATTERN = '[\\u00AD\\u200B-\\u200F\\u2060-\\u2064\\uFEFF]';

// Section names (lowercased) the body check leaves alone.
const SKIPPED_SECTIONS = new Set(['demo', 'jira issue']);

// Words that pass their remaining arguments on as the command to run, so a
// `gh` after them is still the segment's command.
const COMMAND_WRAPPERS = new Set([
  'env', 'command', 'builtin', 'exec', 'nohup', 'nice', 'time', 'timeout',
  'stdbuf', 'sudo', 'xargs',
]);

// gh flags on create and edit that take a value, so the value is never read
// as a flag. Long spellings and short letters, from `gh pr create --help` and
// `gh pr edit --help`.
const LONG_VALUE_FLAGS = new Set([
  '--assignee', '--base', '--body', '--body-file', '--head', '--label',
  '--milestone', '--project', '--recover', '--reviewer', '--template',
  '--title', '--repo', '--add-assignee', '--add-label', '--add-project',
  '--add-reviewer', '--remove-assignee', '--remove-label', '--remove-project',
  '--remove-reviewer',
]);
const SHORT_VALUE_FLAGS = new Set(['a', 'B', 'b', 'F', 'H', 'l', 'm', 'p', 'r', 'T', 't', 'R']);
const FILL_FLAGS = new Set(['--fill', '--fill-first', '--fill-verbose']);

// Prose Style bans, as regex fragments. Inflections of a banned word are the
// same word, so each fragment covers its plural, past, and -ing forms.
const BANNED_PATTERNS = [
  'delv(?:e|es|ed|ing)',
  'leverag(?:e|es|ed|ing)',
  'robust(?:ly|ness)?',
  'seamless(?:ly)?',
  'pivotal',
  'unpack(?:s|ed|ing)?',
  'deep[ -]dives?',
  'at its core',
  "it['\u2019]s worth noting",
  'fundamentally',
  'crucially',
  'importantly',
  "in today['\u2019]s",
  'game[ -]chang(?:er|ers|ing)',
  'really',
  'just',
  'simply',
  'actually',
  'literally',
  'genuinely',
  'honestly',
  'truly',
  'deeply',
  'inherently',
];
const BANNED_WORDS_PATTERN = `\\b(?:${BANNED_PATTERNS.join('|')})\\b`;

// Characters that may close a sentence after its terminal punctuation.
const CLOSERS = new Set([')', ']', '"', "'", '\u201D', '\u2019', '\u00BB', '*']);

// A list item marker: -, *, +, or a number with . or ), then whitespace.
const LIST_MARKER = /^[ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]+/;

// ---------------------------------------------------------------------------
// Command tokenizing (mirrors inline-script-block.js)
// ---------------------------------------------------------------------------

// Tokenize one command string, quote-aware, into segments. Each segment is an
// array of tokens with quotes stripped. Unquoted shell operators (&&, ||, ;,
// |&, |, &, newline) end the current segment. Unquoted redirects become their
// own tokens so a redirect target is never read as a flag value. Process
// substitutions (<( ... ), >( ... )) stay one token. Unquoted parentheses and
// backticks are token boundaries.
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
      if (next === '\n') { i += 2; continue; }
      current += next;
      hasToken = true;
      i += 2;
      continue;
    }
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

function isProcessSubstitution(tok) {
  return tok.startsWith('<(') || tok.startsWith('>(');
}

function isRedirect(tok) {
  return tok === '<' || tok === '<<' || tok === '<<-' || tok === '<<<' ||
    tok === '<&' || tok === '<>' || tok === '>' || tok === '>>' ||
    tok === '>&' || tok === '>|' || tok === '&>' || tok === '&>>' ||
    isProcessSubstitution(tok);
}

function basename(tok) {
  return tok.slice(tok.lastIndexOf('/') + 1);
}

function isAssignment(tok) {
  return /^[A-Za-z_][A-Za-z0-9_]*=/.test(tok);
}

// True when the `gh` at tokens[index] is what the segment runs: every token
// before it is an assignment, a flag, a bare number, a duration (5, 5s, 2m),
// or a wrapper word.
function isCommandPosition(tokens, index) {
  let i = 0;
  while (i < index) {
    const tok = tokens[i];
    const passes = isAssignment(tok) || tok.startsWith('-') ||
      /^\d+(\.\d+)?[smhd]?$/.test(tok) || COMMAND_WRAPPERS.has(basename(tok));
    if (!passes) return false;
    i += 1;
  }
  return true;
}

// Index of the first token at or after `start` that is not a global gh flag
// (-R/--repo with its value, --help, and the like).
function skipGlobalFlags(tokens, start) {
  let i = start;
  while (i < tokens.length && tokens[i].startsWith('-')) {
    if (tokens[i] === '-R' || tokens[i] === '--repo') { i += 2; continue; }
    i += 1;
  }
  return i;
}

function flagName(tok) {
  const eq = tok.indexOf('=');
  if (eq === -1) return tok;
  return tok.slice(0, eq);
}

// Value of the long flag at args[i], written "--name=value" or "--name value".
function longFlagValue(args, i) {
  const tok = args[i];
  const eq = tok.indexOf('=');
  if (eq === -1) return args[i + 1];
  return tok.slice(eq + 1);
}

// Walks the tokens after `gh pr create` / `gh pr edit`. Returns
// { body, fill, bodyFiles }: whether --body/-b appeared, whether a fill flag
// appeared, and every --body-file/-F value in order (undefined when the flag
// had no value).
function parseArgs(args) {
  const result = { body: false, fill: false, bodyFiles: [] };
  let i = 0;
  while (i < args.length) {
    const tok = args[i];
    if (tok === '--') break;
    if (isRedirect(tok)) {
      if (isProcessSubstitution(tok)) { i += 1; continue; }
      i += 2;
      continue;
    }
    if (tok.startsWith('--')) {
      const name = flagName(tok);
      if (name === '--body') result.body = true;
      if (name === '--body-file') result.bodyFiles.push(longFlagValue(args, i));
      if (FILL_FLAGS.has(name) && longFlagValue(args, i) !== 'false') result.fill = true;
      if (LONG_VALUE_FLAGS.has(name) && !tok.includes('=')) { i += 2; continue; }
      i += 1;
      continue;
    }
    if (tok.startsWith('-') && tok.length > 1) {
      // A short cluster: booleans may stack (-df); the first value-taking
      // letter takes the rest of the token (-Fpath, -F=path) or the next one.
      let k = 1;
      while (k < tok.length) {
        const letter = tok[k];
        if (SHORT_VALUE_FLAGS.has(letter)) {
          const rest = tok.slice(k + 1).replace(/^=/, '');
          if (letter === 'b') result.body = true;
          if (letter === 'F') {
            if (rest !== '') result.bodyFiles.push(rest);
            if (rest === '') result.bodyFiles.push(args[i + 1]);
          }
          if (rest === '') i += 1;
          break;
        }
        if (letter === 'f') result.fill = true;
        k += 1;
      }
      i += 1;
      continue;
    }
    i += 1;
  }
  return result;
}

// True when the hook cannot read the value as a file before gh runs: stdin,
// a descriptor, a process substitution, or a path the shell must expand.
function isUninspectable(value) {
  return value === '-' || value === '/dev/stdin' || value.startsWith('/dev/fd/') ||
    isProcessSubstitution(value) || value.includes('$');
}

// Absolute path for a --body-file value: a leading ~ expands to the home
// directory, a relative path resolves against the Bash tool's cwd.
function resolveBodyPath(value, cwd) {
  if (value === '~') return os.homedir();
  if (value.startsWith('~/')) return path.join(os.homedir(), value.slice(2));
  return path.resolve(cwd, value);
}

// Reads at most MAX_BODY_BYTES + 1 bytes so an oversized file is detected
// without being loaded whole.
function readCapped(absPath) {
  const fd = fs.openSync(absPath, 'r');
  try {
    const buffer = Buffer.alloc(MAX_BODY_BYTES + 1);
    const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    fs.closeSync(fd);
  }
}

// ---------------------------------------------------------------------------
// Body checks
// ---------------------------------------------------------------------------

// Drops fenced code blocks (``` or ~~~, three or more, closed by a fence of
// the same character at least as long). An unclosed fence runs to the end.
function stripFences(text) {
  const kept = [];
  let fence = null;
  for (const line of text.split('\n')) {
    if (fence === null) {
      const open = /^ {0,3}(`{3,}|~{3,})/.exec(line);
      if (open !== null) { fence = open[1]; continue; }
      kept.push(line);
      continue;
    }
    const close = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line);
    if (close !== null && close[1][0] === fence[0] && close[1].length >= fence.length) fence = null;
  }
  return kept.join('\n');
}

function stripHtmlComments(text) {
  return text.replace(/<!--[\s\S]*?(?:-->|$)/g, '');
}

// Splits on `## ` headings. Returns [{ name, text }]. With no `## Summary`
// heading the whole body is one section named "body". Text before the first
// heading is a section named "preamble" when it has content.
function splitSections(text) {
  const sections = [];
  let name = 'preamble';
  let lines = [];
  for (const line of text.split('\n')) {
    const heading = /^ {0,3}##[ \t]+(.+?)[ \t]*$/.exec(line);
    if (heading === null) { lines.push(line); continue; }
    sections.push({ name, text: lines.join('\n') });
    name = heading[1].replace(/[ \t]+#+$/, '').trim();
    lines = [];
  }
  sections.push({ name, text: lines.join('\n') });
  const hasSummary = sections.some(section => section.name.toLowerCase() === 'summary');
  if (!hasSummary) return [{ name: 'body', text }];
  return sections.filter(section => section.name !== 'preamble' || section.text.trim() !== '');
}

function isSkippedLine(line) {
  const trimmed = line.trim();
  if (/^ {0,3}#{1,6}(?:\s|$)/.test(line)) return true;
  if (/^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/.test(line)) return true;
  if (trimmed.startsWith('|')) return true;
  if (/^(?:!\[[^\]]*\]\([^)]*\)[ \t]*)+$/.test(trimmed)) return true;
  if (/^<img\b[^>]*>$/i.test(trimmed)) return true;
  if (/^<?https?:\/\/\S+>?$/.test(trimmed)) return true;
  return false;
}

// Splits a section into blocks on blank lines, dropping skipped lines. Each
// block is an array of its remaining lines; empty blocks are dropped.
function splitBlocks(text) {
  const blocks = [];
  let current = [];
  for (const line of text.split('\n')) {
    if (line.trim() === '') {
      if (current.length > 0) blocks.push(current);
      current = [];
      continue;
    }
    if (isSkippedLine(line)) continue;
    current.push(line);
  }
  if (current.length > 0) blocks.push(current);
  return blocks;
}

// One unit per list item (a continuation line joins the item above it); a
// block with no list markers is one unit.
function blockUnits(lines) {
  const units = [];
  for (const line of lines) {
    if (LIST_MARKER.test(line) || units.length === 0) {
      units.push(line.replace(LIST_MARKER, '').trim());
      continue;
    }
    units[units.length - 1] = `${units[units.length - 1]} ${line.trim()}`;
  }
  return units;
}

// Inline code becomes the one word CODE; images and links keep their text;
// HTML tags and emphasis markers drop; whitespace collapses.
function normalizeUnit(text) {
  return text
    .replace(/`+[^`]*`+/g, 'CODE')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<\/?[a-zA-Z][a-zA-Z0-9-]*(?:\s[^>]*)?>/g, ' ')
    .replace(/[*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// True when the token ending at text[index] is e.g. or i.e. (or ends with one,
// as in "(e.g.").
function isAbbreviation(text, index) {
  let start = index;
  while (start > 0 && !/\s/.test(text[start - 1])) start -= 1;
  const token = text.slice(start, index + 1).toLowerCase();
  return token.endsWith('e.g.') || token.endsWith('i.e.');
}

// A sentence ends at . ! or ? (a run of them counts once), optionally
// followed by closing quotes or brackets, then whitespace or the end of the
// unit. e.g. and i.e. never end a sentence. A unit with no terminal
// punctuation is one sentence.
function splitSentences(text) {
  const sentences = [];
  let start = 0;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch !== '.' && ch !== '!' && ch !== '?') { i += 1; continue; }
    let j = i + 1;
    while (j < text.length && (text[j] === '.' || text[j] === '!' || text[j] === '?')) j += 1;
    while (j < text.length && CLOSERS.has(text[j])) j += 1;
    const atEnd = j >= text.length;
    const beforeSpace = !atEnd && /\s/.test(text[j]);
    if ((atEnd || beforeSpace) && !isAbbreviation(text, i)) {
      const sentence = text.slice(start, j).trim();
      if (sentence !== '') sentences.push(sentence);
      start = j;
    }
    i = j;
  }
  const tail = text.slice(start).trim();
  if (tail !== '') sentences.push(tail);
  return sentences;
}

// A word is a whitespace-separated token containing a letter or a digit.
function countWords(sentence) {
  return sentence.split(/\s+/).filter(tok => /[\p{L}\p{N}]/u.test(tok)).length;
}

function excerptOf(raw) {
  return raw.replace(/\s+/g, ' ').trim().slice(0, EXCERPT_LENGTH);
}

// Violations for one unit: sentence length, sentence count, dashes, banned
// words. Each is { section, excerpt, problem }.
function checkUnit(section, raw) {
  const violations = [];
  const excerpt = excerptOf(raw);
  const text = normalizeUnit(raw);
  const sentences = splitSentences(text);
  if (sentences.length > MAX_SENTENCES_PER_PARAGRAPH) {
    violations.push({ section, excerpt, problem: `paragraph has ${sentences.length} sentences; the limit is ${MAX_SENTENCES_PER_PARAGRAPH}` });
  }
  for (const sentence of sentences) {
    const words = countWords(sentence);
    if (words > MAX_WORDS_PER_SENTENCE) {
      violations.push({ section, excerpt: excerptOf(sentence), problem: `sentence has ${words} words; the limit is ${MAX_WORDS_PER_SENTENCE}` });
    }
  }
  if (text.includes('\u2014')) violations.push({ section, excerpt, problem: 'contains an em dash (U+2014)' });
  if (text.includes('\u2013')) violations.push({ section, excerpt, problem: 'contains an en dash (U+2013)' });
  const seen = new Set();
  for (const match of text.matchAll(new RegExp(BANNED_WORDS_PATTERN, 'gi'))) {
    const word = match[0].toLowerCase();
    if (seen.has(word)) continue;
    seen.add(word);
    violations.push({ section, excerpt, problem: `uses the banned word "${match[0]}"` });
  }
  return violations;
}

// A list item counts as a paragraph, so the Summary cap counts units.
function checkSection(section) {
  const units = splitBlocks(section.text).flatMap(blockUnits);
  const violations = [];
  if (section.name.toLowerCase() === 'summary' && units.length > MAX_SUMMARY_PARAGRAPHS) {
    violations.push({ section: section.name, excerpt: excerptOf(units[MAX_SUMMARY_PARAGRAPHS]), problem: `Summary has ${units.length} paragraphs; the limit is ${MAX_SUMMARY_PARAGRAPHS}` });
  }
  for (const unit of units) {
    violations.push(...checkUnit(section.name, unit));
  }
  return violations;
}

// Every violation in the body text, as { section, excerpt, problem }. An
// empty array means the body passes.
function checkBody(text) {
  const cleaned = stripHtmlComments(stripFences(String(text).replace(/\r\n?/g, '\n')));
  const violations = [];
  for (const section of splitSections(cleaned)) {
    if (SKIPPED_SECTIONS.has(section.name.toLowerCase())) continue;
    violations.push(...checkSection(section));
  }
  return violations;
}

function formatViolations(violations) {
  const lines = violations.map(v => `[${v.section}] ${v.problem}: ${v.excerpt}`);
  return `${lines.join('\n')}\n${TAIL}`;
}

// ---------------------------------------------------------------------------
// Command analysis
// ---------------------------------------------------------------------------

// Reason string for one --body-file value, or null when it passes.
function checkBodyFile(value, cwd) {
  if (isUninspectable(value)) {
    return `--body-file "${value}" cannot be read before gh runs (stdin, a descriptor, a process substitution, or an unresolved expansion). Pass a plain file path. ${TAIL}`;
  }
  const absPath = resolveBodyPath(value, cwd);
  let stat;
  try { stat = fs.statSync(absPath); } catch { return null; }
  if (!stat.isFile()) return null;
  if (stat.size > MAX_BODY_BYTES) {
    return `body file "${value}" is ${stat.size} bytes; GitHub's PR body maximum is ${MAX_BODY_BYTES}. ${TAIL}`;
  }
  let bytes;
  try { bytes = readCapped(absPath); } catch { return null; }
  if (bytes.length > MAX_BODY_BYTES) {
    return `body file "${value}" is over ${MAX_BODY_BYTES} bytes, GitHub's PR body maximum. ${TAIL}`;
  }
  const violations = checkBody(bytes.toString('utf8'));
  if (violations.length === 0) return null;
  return formatViolations(violations);
}

// Analyze one segment's tokens. Returns the deny reason, or null.
function analyzeSegment(tokens, cwd) {
  const ghIndex = tokens.findIndex(tok => basename(tok) === 'gh');
  if (ghIndex === -1) return null;
  if (!isCommandPosition(tokens, ghIndex)) return null;
  const prIndex = skipGlobalFlags(tokens, ghIndex + 1);
  if (tokens[prIndex] !== 'pr') return null;
  const subIndex = skipGlobalFlags(tokens, prIndex + 1);
  const sub = tokens[subIndex];
  const isCreate = sub === 'create' || sub === 'new';
  if (!isCreate && sub !== 'edit') return null;

  const parsed = parseArgs(tokens.slice(subIndex + 1));
  if (parsed.body) {
    return `--body/-b passes the description inline, where this hook cannot check it. Write it to a file and pass --body-file <path> (~/.work/rules/pr-body-editing.md). ${TAIL}`;
  }
  if (isCreate && parsed.fill) {
    return `--fill writes the description from commit messages, text never checked against the rules. Write it to a file and pass --body-file <path>. ${TAIL}`;
  }
  for (const value of parsed.bodyFiles) {
    if (value === undefined) continue;
    const reason = checkBodyFile(value, cwd);
    if (reason !== null) return reason;
  }
  return null;
}

// Returns null when the command may run, else the deny reason. `cwd` is the
// directory relative --body-file paths resolve against.
function analyzeCommand(command, cwd) {
  const cmd = String(command).replace(new RegExp(ZERO_WIDTH_PATTERN, 'g'), '');
  for (const tokens of splitSegments(cmd)) {
    const reason = analyzeSegment(tokens, cwd);
    if (reason !== null) return reason;
  }
  return null;
}

function payloadCwd(data) {
  if (typeof data.cwd === 'string' && data.cwd !== '') return data.cwd;
  return process.cwd();
}

function main() {
  let raw = '';
  let overflow = false;
  let bytes = 0;
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => {
    // Stop accumulating past MAX_PAYLOAD_BYTES (counted as UTF-8 bytes); the
    // end handler fails open.
    if (overflow) return;
    bytes += Buffer.byteLength(chunk, 'utf8');
    if (bytes > MAX_PAYLOAD_BYTES) { overflow = true; raw = ''; return; }
    raw += chunk;
  });
  process.stdin.on('end', () => {
    if (overflow) process.exit(0);
    let data;
    try { data = JSON.parse(raw); } catch { process.exit(0); }
    if (!data || data.tool_name !== 'Bash') process.exit(0);

    let reason = null;
    try {
      const command = String(data.tool_input?.command ?? '').trim();
      if (!command) process.exit(0);
      reason = analyzeCommand(command, payloadCwd(data));
    } catch {
      process.exit(0);
    }
    if (reason === null) process.exit(0);

    process.stderr.write(`\n⛔ PR-BODY-LIMITS: ${reason}\n\n`);

    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    }));
  });
}

if (require.main === module) {
  main();
}

module.exports = { analyzeCommand, checkBody, splitSegments, splitSentences, countWords, normalizeUnit };
