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
const LOG_NAME = "read-provenance.jsonl";
const READ_HOOK_EVENT_NAME = "PostToolUse";
const READ_TOOL_NAME = "Read";
function isJsonObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isReadToolInput(value) {
  return isJsonObject(value) && typeof value["file_path"] === "string";
}
function isAbsentOrString(value) {
  return value === void 0 || typeof value === "string";
}
function isReadHookEvent(value) {
  if (!isJsonObject(value)) {
    return false;
  }
  const toolInput = value["tool_input"];
  return value["hook_event_name"] === READ_HOOK_EVENT_NAME && value["tool_name"] === READ_TOOL_NAME && isAbsentOrString(value["agent_id"]) && toolInput !== void 0 && isReadToolInput(toolInput);
}
function optionalString(object, key) {
  const value = object[key];
  if (typeof value === "string") {
    return value;
  }
  return void 0;
}
function optionalNumber(object, key) {
  const value = object[key];
  if (typeof value === "number") {
    return value;
  }
  return void 0;
}
function readLogLine(event) {
  const agentId = optionalString(event, "agent_id");
  const offset = optionalNumber(event.tool_input, "offset");
  const limit = optionalNumber(event.tool_input, "limit");
  return {
    ...agentId !== void 0 && { agent_id: agentId },
    file_path: event.tool_input.file_path,
    ...offset !== void 0 && { offset },
    ...limit !== void 0 && { limit }
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
  if (!isReadHookEvent(event)) {
    return;
  }
  appendLine(readLogLine(event));
}
process.exitCode = 0;
main().catch(() => void 0).finally(() => {
  process.exitCode = 0;
});
