const { playSound } = require("./play");
const { resolveSound } = require("./sounds");
const { pushRemoteAudio } = require("./remote-audio");

/**
 * Emit a notification sound for one event. The single place that decides
 * local playback vs. remote push:
 *
 *   - remote-audio off (default) → play on this machine, exactly as before.
 *   - remote-audio on            → push the event to the local cn-daemon.
 *
 * @param {string} reason  "done" | "question" | "input" — carried to the daemon.
 * @param {string} soundName  Configured preset name (e.g. "Hero").
 * @param {{mac: string, win: string, fallback: string}} defaults  Per-event
 *   default sound paths + bundled fallback used for local playback.
 * @param {number} volume
 * @param {object|null} config  Parsed notifier config.
 */
function emitSound(reason, soundName, defaults, volume, config) {
  if (pushRemoteAudio(reason, soundName, volume, config)) return;
  playSound(resolveSound(soundName, defaults.mac, defaults.win), defaults.fallback, volume);
}

module.exports = { emitSound };
