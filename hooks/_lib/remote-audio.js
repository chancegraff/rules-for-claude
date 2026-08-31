const { execFileSync } = require("child_process");

/**
 * When remote-audio mode is on, push a notification event to the local
 * cn-daemon instead of playing on this (remote) host. The daemon listens on the
 * client machine; the event reaches it over an SSH reverse forward
 * (`RemoteForward <port> localhost:<port>`). See docs/REMOTE_HOSTS.md.
 *
 * Synchronous by design: a short child process performs the one-shot TCP write
 * and exits, so the calling hook's normal control flow and process.exit() are
 * untouched (no deferred-exit handling needed). Portable — uses Node, not a
 * bash /dev/tcp redirect. A connection failure (daemon down / not forwarded) is
 * swallowed: no sound rather than a hook error.
 *
 * @returns {boolean} true if remote-audio owns this event (caller skips local
 *   playback); false if remote-audio is disabled (caller plays locally).
 */
function pushRemoteAudio(reason, soundName, volume, config) {
  const ra = config && config.remoteAudio;
  if (!ra || !ra.enabled) return false;
  const port = ra.port || 47291;
  const host = ra.host || "127.0.0.1";
  const line = JSON.stringify({ reason, sound: soundName, volume }) + "\n";
  const child =
    `const s=require("net").connect(${port},${JSON.stringify(host)},()=>s.end(${JSON.stringify(line)}));` +
    `s.on("error",()=>process.exit(0));s.setTimeout(2000,()=>process.exit(0));`;
  try {
    execFileSync(process.execPath, ["-e", child], { stdio: "ignore", timeout: 3000 });
  } catch {}
  return true;
}

module.exports = { pushRemoteAudio };
