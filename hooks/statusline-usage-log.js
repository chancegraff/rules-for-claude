// Statusline entry-point for Claude Code (configured in ~/.claude/settings.json statusLine).
// Receives the statusline JSON payload on stdin, appends any CHANGED rate-limit meter
// reading to ~/.claude/usage-meter-log.jsonl (timestamped), and renders the meters.
const fs = require('fs');
const os = require('os');

const logPath = `${os.homedir()}/.claude/usage-meter-log.jsonl`;
const lastPath = `${os.homedir()}/.claude/usage-meter-last.json`;

let raw = '';
process.stdin.on('data', (chunk) => {
  raw += chunk;
});
process.stdin.on('end', () => {
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    process.stdout.write('usage: unreadable');
    return;
  }
  const limits = payload.rate_limits;
  if (!limits) {
    process.stdout.write('usage: pending');
    return;
  }

  const serialized = JSON.stringify(limits);
  let last = '';
  try {
    last = fs.readFileSync(lastPath, 'utf8');
  } catch {}
  if (serialized !== last) {
    const entry = JSON.stringify({
      ts: new Date().toISOString(),
      sessionId: payload.session_id,
      rate_limits: limits,
    });
    fs.appendFileSync(logPath, `${entry}\n`);
    fs.writeFileSync(lastPath, serialized);
  }

  const pct = (window) => {
    if (window && typeof window.used_percentage === 'number') {
      return `${Math.round(window.used_percentage)}%`;
    }
    return '?';
  };
  const parts = Object.entries(limits).map(([name, window]) => `${name.replace(/_/g, ' ')} ${pct(window)}`);
  process.stdout.write(parts.join(' | '));
});
