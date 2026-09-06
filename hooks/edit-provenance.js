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
var import_node_crypto = require("node:crypto");
var import_node_fs = require("node:fs");
var import_node_os = require("node:os");
var import_node_path = require("node:path");
var import_consumers = require("node:stream/consumers");
const LOGS_DIRECTORY_VARIABLE = "PLAN_METHODOLOGY_HOOK_LOGS_DIR";
const DEFAULT_LOGS_DIRECTORY = (0, import_node_path.join)((0, import_node_os.homedir)(), ".claude", "hooks", "logs");
const LOG_NAME = "edit-provenance.jsonl";
const HASH_ALGORITHM = "sha256";
const HASH_ENCODING = "hex";
const EDIT_HOOK_EVENT_NAMES = ["PostToolUse", "PostToolUseFailure"];
const SUCCESS_EVENT_NAME = "PostToolUse";
const EDIT_TOOL_NAME = "Edit";
function isJsonObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isEditHookEventName(value) {
  return EDIT_HOOK_EVENT_NAMES.some((name) => name === value);
}
function isEditToolInput(value) {
  return isJsonObject(value) && typeof value["file_path"] === "string" && typeof value["old_string"] === "string" && typeof value["new_string"] === "string";
}
function isAbsentOrString(value) {
  return value === void 0 || typeof value === "string";
}
function isEditHookEvent(value) {
  if (!isJsonObject(value)) {
    return false;
  }
  const toolInput = value["tool_input"];
  return isEditHookEventName(value["hook_event_name"]) && value["tool_name"] === EDIT_TOOL_NAME && typeof value["tool_use_id"] === "string" && isAbsentOrString(value["agent_id"]) && toolInput !== void 0 && isEditToolInput(toolInput);
}
function optionalString(object, key) {
  const value = object[key];
  if (typeof value === "string") {
    return value;
  }
  return void 0;
}
function hash(value) {
  return (0, import_node_crypto.createHash)(HASH_ALGORITHM).update(value, "utf8").digest(HASH_ENCODING);
}
function errorField(event, success) {
  if (success) {
    return void 0;
  }
  return optionalString(event, "error");
}
function editLogLine(event) {
  const agentId = optionalString(event, "agent_id");
  const success = event.hook_event_name === SUCCESS_EVENT_NAME;
  const error = errorField(event, success);
  return {
    ...agentId !== void 0 && { agent_id: agentId },
    tool_use_id: event.tool_use_id,
    file_path: event.tool_input.file_path,
    old_string_length: event.tool_input.old_string.length,
    new_string_length: event.tool_input.new_string.length,
    old_string_hash: hash(event.tool_input.old_string),
    new_string_hash: hash(event.tool_input.new_string),
    success,
    ...error !== void 0 && { error }
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
  if (!isEditHookEvent(event)) {
    return;
  }
  appendLine(editLogLine(event));
}
process.exitCode = 0;
main().catch(() => void 0).finally(() => {
  process.exitCode = 0;
});
