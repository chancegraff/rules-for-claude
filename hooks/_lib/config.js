const fs = require("fs");
const { CONFIG_FILE, MUTE_FLAG } = require("./paths");
const { isInsideCursor } = require("./cursor");

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
  } catch {
    return null;
  }
}

function isMuted() {
  return fs.existsSync(MUTE_FLAG);
}

// Whether this hook should produce no output at all — no sound, no popup, and
// no signal (so the VS Code extension, which reads the signal file, is also
// silenced). Two reasons:
//   1. Cursor: it runs these hooks from its own Composer agent, not a Claude
//      Code session, so the notifier stays out of its way entirely. The
//      extension can't detect Cursor itself (it runs under VS Code's env), so
//      suppressing the signal at the hook is the only way to block it too.
//   2. CLAUDE_NOTIFIER_DISABLE: per-session opt-out — set it in the shell to
//      silence just that session (unlike the machine-wide mute flag). Any
//      non-empty value other than "0"/"false" counts as disabled. Useful for
//      an SSH user on a shared host.
function isDisabled() {
  if (isInsideCursor()) return true;
  const v = process.env.CLAUDE_NOTIFIER_DISABLE;
  return !!v && v !== "0" && v.toLowerCase() !== "false";
}

module.exports = { readConfig, isMuted, isDisabled };
