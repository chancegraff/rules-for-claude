#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const FORCE_LSP_CONTEXT_AGENTS = [
  'backend-explorer', 'frontend-explorer', 'db-explorer',
];

const EXEMPT_AGENTS = [
  'explore', 'security-reviewer', 'performance-reviewer', 'conventions-reviewer',
  'conflict-detector', 'code-auditor', 'lint-types-checker', 'test-runner',
  'code-reviewer', 'go-reviewer', 'doc-updater', 'architect', 'planner',
  'deep-security-reviewer', 'typescript-reviewer', 'python-reviewer',
  'ai-integration-reviewer', 'supabase-auth-reviewer', 'scraper-reviewer',
  'nextjs-static-reviewer', 'build-error-resolver', 'e2e-runner',
  'performance-optimizer', 'tdd-guide',
];

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', d => { input += d; });
process.stdin.on('end', () => {
  let data;
  try { data = JSON.parse(input); } catch { process.exit(0); }
  if (data.tool_name !== 'Agent') process.exit(0);

  const toolInput = data.tool_input || {};
  // String coercion: non-string fields would throw on subsequent string methods.
  const prompt = String(toolInput.prompt ?? '');
  const subagentType = String(toolInput.subagent_type ?? '');
  const isForcedExplorer = FORCE_LSP_CONTEXT_AGENTS.includes(subagentType);

  if (!isForcedExplorer) {
    // Exact match only — previously `.includes(e)` allowed substring matches
    // like `exploit-deep-security-reviewer` to bypass by containing a
    // legitimate exempt name. Both checks now case-insensitive exact.
    const subType = subagentType.toLowerCase();
    if (EXEMPT_AGENTS.some(e => e.toLowerCase() === subType)) process.exit(0);
  }

  if (prompt.length < 200) process.exit(0);

  const isolation = String(toolInput.isolation ?? '');
  const cwd = String(data.cwd ?? process.cwd());
  const taskDir = path.join(cwd, '.task');

  if (!isForcedExplorer && isolation !== 'worktree') {
    if (!fs.existsSync(taskDir)) process.exit(0);
  }

  let inImplementPhase = isForcedExplorer || isolation === 'worktree';

  if (!inImplementPhase) {
    try {
      const entries = fs.readdirSync(taskDir).filter(e => {
        return e.startsWith('20') && fs.statSync(path.join(taskDir, e)).isDirectory();
      });
      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
      for (const entry of entries) {
        const folderPath = path.join(taskDir, entry);
        const stat = fs.statSync(folderPath);
        if (stat.mtimeMs < twoHoursAgo) continue;
        const statePath = path.join(folderPath, 'state.json');
        if (fs.existsSync(statePath)) {
          try {
            const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
            if (state.phase === 'implement') { inImplementPhase = true; break; }
          } catch {}
        }
        const taskMd = path.join(folderPath, '00-task.md');
        if (fs.existsSync(taskMd)) {
          try {
            const content = fs.readFileSync(taskMd, 'utf8');
            if (/\*{0,2}Phase\*{0,2}:\*{0,2}\s*implement/i.test(content)) { inImplementPhase = true; break; }
          } catch {}
        }
      }
    } catch {}
  }

  if (!inImplementPhase) process.exit(0);

  const hasLspContext =
    /\bLSP CONTEXT\b/i.test(prompt) ||
    /\bSymbol Map\b/i.test(prompt) ||
    /\bdefined\s+at\s+[\w\-\/]+\.\w{2,4}:\d+/i.test(prompt) ||
    /\bcalled\s+from\s+[\w\-\/]+\.\w{2,4}:\d+/i.test(prompt) ||
    /\bused\s+in\s+[\w\-\/]+\.\w{2,4}:\d+/i.test(prompt) ||
    /\bimported\s+(?:in|by)\s+[\w\-\/]+\.\w{2,4}:\d+/i.test(prompt);

  if (hasLspContext) process.exit(0);

  const agentLabel = isForcedExplorer ? `explorer "${subagentType}"` : 'implement agent';

  const decision = (isForcedExplorer || isolation === 'worktree') ? 'block' : 'warn';
  console.log(JSON.stringify({
    decision,
    reason: [
      `LSP PRE-DELEGATION: ${agentLabel} without "## LSP CONTEXT".`,
      '',
      'DO THIS NOW (3 steps, then retry the Agent call):',
      '1. mcp__cclsp__get_diagnostics("<any .ts file>")  — primes LSP',
      '2. mcp__cclsp__find_workspace_symbols("<keyword from task>")  — finds symbols',
      '3. Add to EVERY agent prompt:',
      '   ## LSP CONTEXT (pre-resolved — do NOT re-search)',
      '   - symbolName: defined at file.ts:42, called from a.ts:15',
      '',
      'Then re-launch the same Agent calls with ## LSP CONTEXT included.',
    ].join('\n'),
  }));
});
