#!/usr/bin/env node
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var stdin_exports = {};
module.exports = __toCommonJS(stdin_exports);
var import_node_fs = require("node:fs");
var import_node_os = require("node:os");
var import_node_path = require("node:path");
var import_consumers = require("node:stream/consumers");
const LOGS_DIRECTORY_VARIABLE = "PLAN_METHODOLOGY_HOOK_LOGS_DIR";
const DEFAULT_LOGS_DIRECTORY = (0, import_node_path.join)((0, import_node_os.homedir)(), ".claude", "hooks", "logs");
const LOG_NAME = "agent-usage.jsonl";
const SUBAGENT_STOP_EVENT_NAME = "SubagentStop";
const ASSISTANT_LINE_TYPE = "assistant";
function isJsonObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isSubagentStopEvent(value) {
  return isJsonObject(value) && value["hook_event_name"] === SUBAGENT_STOP_EVENT_NAME && typeof value["agent_id"] === "string" && typeof value["agent_type"] === "string" && typeof value["agent_transcript_path"] === "string";
}
function isUsageObject(value) {
  return isJsonObject(value) && typeof value["output_tokens"] === "number";
}
function parseTranscriptLine(line) {
  if (line.trim() === "") {
    return [];
  }
  try {
    const parsed = JSON.parse(line);
    if (!isJsonObject(parsed)) {
      return [];
    }
    return [parsed];
  } catch {
    return [];
  }
}
function readTranscript(path) {
  return (0, import_node_fs.readFileSync)(path, "utf8").split("\n").flatMap(parseTranscriptLine);
}
function lastAssistantUsage(lines) {
  const lastAssistant = lines.filter((line) => line["type"] === ASSISTANT_LINE_TYPE).at(-1);
  if (lastAssistant === void 0) {
    return void 0;
  }
  const message = lastAssistant["message"];
  if (message === void 0 || !isJsonObject(message)) {
    return void 0;
  }
  const usage = message["usage"];
  if (usage === void 0 || !isUsageObject(usage)) {
    return void 0;
  }
  return usage;
}
function lineTimestamp(line) {
  const stamp = line["timestamp"];
  if (typeof stamp !== "string" || Number.isNaN(Date.parse(stamp))) {
    return [];
  }
  return [stamp];
}
function transcriptSpan(lines) {
  const ordered = lines.flatMap(lineTimestamp).sort((left, right) => Date.parse(left) - Date.parse(right));
  const start = ordered.at(0);
  const end = ordered.at(-1);
  if (start === void 0 || end === void 0) {
    return void 0;
  }
  return { start, end };
}
function usageLogLine(event) {
  const lines = readTranscript(event.agent_transcript_path);
  const usage = lastAssistantUsage(lines);
  const span = transcriptSpan(lines);
  if (usage === void 0 || span === void 0) {
    return void 0;
  }
  return {
    agent_id: event.agent_id,
    agent_type: event.agent_type,
    agent_transcript_path: event.agent_transcript_path,
    usage,
    span
  };
}
function logsDirectory() {
  const configured = process.env[LOGS_DIRECTORY_VARIABLE];
  if (configured !== void 0 && configured !== "") {
    return configured;
  }
  return DEFAULT_LOGS_DIRECTORY;
}
function appendLine(line) {
  const directory = logsDirectory();
  (0, import_node_fs.mkdirSync)(directory, { recursive: true });
  (0, import_node_fs.appendFileSync)((0, import_node_path.join)(directory, LOG_NAME), `${JSON.stringify(line)}
`, { flag: "a" });
}
async function main() {
  const input = await (0, import_consumers.text)(process.stdin);
  const event = JSON.parse(input);
  if (!isSubagentStopEvent(event)) {
    return;
  }
  const line = usageLogLine(event);
  if (line === void 0) {
    return;
  }
  appendLine(line);
}
process.exitCode = 0;
main().catch(() => void 0).finally(() => {
  process.exitCode = 0;
});
