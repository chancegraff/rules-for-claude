// Detect whether this hook is running under Cursor (its Composer agent).
//
// Cursor executes ~/.claude/settings.json hooks the same way Claude Code does,
// but it is NOT Claude Code — it runs its own agent and does not set the
// CLAUDECODE / CLAUDE_CODE_* environment. When Cursor fires these hooks,
// claude-notifier must stay out of the way entirely: the user is inside Cursor,
// which has its own UI, and the model the hook was set up for isn't necessarily
// the one being used.
//
// Used by isDisabled() in _lib/config.js so every hook bails at the top under
// Cursor — no sound, no popup, and no signal. Suppressing the signal matters:
// the VS Code extension reads the signal file and can't detect Cursor itself
// (it runs under VS Code's env), so not writing the signal is the only way to
// stop the extension from firing for a Cursor turn.
//
// Detection: Cursor injects CURSOR_* env vars into the hook process
// (cross-platform — e.g. CURSOR_VERSION, CURSOR_PROJECT_DIR, CURSOR_TRACE_ID)
// and, on macOS, runs under its ToDesktop bundle id. The CURSOR_* presence is
// the primary, OS-independent signal; the bundle id is a macOS backstop.
// Both were captured empirically from a live Composer hook fire.
function isInsideCursor() {
  if (process.env.__CFBundleIdentifier === "com.todesktop.230313mzl4w4u92") return true;
  return Object.keys(process.env).some((k) => k.startsWith("CURSOR_"));
}

module.exports = { isInsideCursor };
