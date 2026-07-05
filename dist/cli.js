#!/usr/bin/env node

// src/cli.ts
import { AgenticEmail, AgenticEmailError } from "agenticemail";

// src/lib.ts
import { readFileSync } from "fs";
import { basename } from "path";
var ARRAY_KEYS = /* @__PURE__ */ new Set([
  "to",
  "cc",
  "bcc",
  "eventTypes",
  "inboxIds",
  "labels",
  "addLabels",
  "removeLabels",
  "senders",
  "recipients",
  "scopes"
]);
var camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
var kebab = (s) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
function parseArgv(argv) {
  const positionals = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      positionals.push(arg === "-" ? null : arg);
      continue;
    }
    const eq = arg.indexOf("=");
    let key;
    let raw;
    if (eq !== -1) {
      key = arg.slice(2, eq);
      raw = arg.slice(eq + 1);
    } else {
      key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== void 0 && !next.startsWith("--")) {
        raw = next;
        i++;
      } else raw = true;
    }
    key = camel(key);
    let value = raw;
    if (value === "true") value = true;
    else if (value === "false") value = false;
    if (ARRAY_KEYS.has(key) && typeof value === "string")
      value = value.split(",").map((s) => s.trim()).filter(Boolean);
    if (key in flags) {
      const prev = flags[key];
      const prevArr = Array.isArray(prev) ? prev : [prev];
      flags[key] = prevArr.concat(value);
    } else flags[key] = value;
  }
  return { positionals, flags };
}
function applyAttachments(flags) {
  if (!("attach" in flags)) return flags;
  const files = Array.isArray(flags.attach) ? flags.attach : [flags.attach];
  const { attach: _drop, ...rest } = flags;
  return {
    ...rest,
    attachments: files.map((file) => ({
      filename: basename(String(file)),
      content: readFileSync(String(file)).toString("base64")
    }))
  };
}
function resolveCall(client, group, method) {
  const g = client[camel(group)];
  if (!g || typeof g !== "object") return null;
  const fn = g[camel(method)];
  return typeof fn === "function" ? fn : null;
}
function buildArgs(parsed) {
  const args = [...parsed.positionals];
  if (Object.keys(parsed.flags).length) args.push(parsed.flags);
  return args;
}
function commandTable(client) {
  const rows = [];
  for (const [group, value] of Object.entries(client)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    for (const [method, fn] of Object.entries(value))
      if (typeof fn === "function") rows.push(`${kebab(group)} ${kebab(method)}`);
  }
  return rows.sort();
}

// src/cli.ts
var VERSION = "0.1.0";
function fail(status, code, message, exit = 1) {
  console.error(JSON.stringify({ error: { status, code, message } }));
  process.exit(exit);
}
function printResult(result) {
  if (result === void 0) console.log(JSON.stringify({ ok: true }));
  else if (typeof result === "string") process.stdout.write(result);
  else if (result instanceof ArrayBuffer)
    process.stdout.write(Buffer.from(result));
  else console.log(JSON.stringify(result, null, 2));
}
function help(client) {
  console.log(`agenticemail ${VERSION} \u2014 email for AI agents, end to end.

Usage
  agenticemail <group> <command> [args...] [--flag value ...]
  agenticemail events tail [--inbox-ids id1,id2] [--event-types t1,t2]
  agenticemail wait-for-message <inbox-id> [--timeout 300] [--event-types message.received]

Auth
  AGENTICEMAIL_API_KEY   API key (am_...), or pass --api-key
  AGENTICEMAIL_API_URL   defaults to https://api.agenticemail.dev

Conventions
  Output is JSON on stdout (NDJSON for events tail); errors are JSON on stderr.
  Flags are kebab-case and become request fields: --display-name -> display_name.
  List-valued flags take commas or repeats: --to a@x.com,b@y.com
  Use "-" as a positional for org-level scope (e.g. lists list - receive block).
  --attach <file> (repeatable) uploads files as attachments.
  --json '{"any":"fields"}' merges raw fields into the request.
  Exit codes: 0 ok, 1 API error, 2 timeout, 64 usage error.

Commands
${commandTable(client).map((row) => `  ${row}`).join("\n")}
  events tail
  wait-for-message

Examples
  agenticemail inboxes create --username support
  agenticemail messages send inb_123 --to user@example.com --subject "Hi" --text "Hello!"
  agenticemail messages list inb_123 --limit 5
  agenticemail wait-for-message inb_123 --timeout 120
  agenticemail messages reply inb_123 msg_456 --text "On it."
  agenticemail webhooks create --url https://hooks.slack.com/services/... --event-types message.received --json '{"provider":"slack"}'

Docs: https://agenticemail.dev/docs`);
}
function connectStream(client, opts, onEvent) {
  const stream = client.events.connect(opts);
  stream.on(onEvent);
  stream.socket.addEventListener(
    "error",
    () => fail(0, "ws_error", "event stream connection failed")
  );
  stream.socket.addEventListener(
    "close",
    () => fail(0, "ws_closed", "event stream closed by server")
  );
  return stream;
}
async function main() {
  const argv = process.argv.slice(2);
  const { positionals, flags } = parseArgv(argv);
  const apiKey = flags.apiKey ?? process.env.AGENTICEMAIL_API_KEY ?? "";
  const baseUrl = flags.apiUrl ?? process.env.AGENTICEMAIL_API_URL ?? void 0;
  delete flags.apiKey;
  delete flags.apiUrl;
  const client = new AgenticEmail({ apiKey: apiKey || "am_unset", baseUrl });
  const [group, method, ...rest] = positionals;
  if (!group || group === "help" || flags.help === true) {
    help(client);
    process.exit(group ? 0 : 64);
  }
  if (group === "version" || flags.version === true) {
    console.log(JSON.stringify({ version: VERSION }));
    process.exit(0);
  }
  if (!apiKey)
    fail(
      401,
      "missing_api_key",
      "Set AGENTICEMAIL_API_KEY or pass --api-key (create one at https://app.agenticemail.dev/keys)",
      64
    );
  if (group === "wait-for-message") {
    const inboxId = method;
    if (typeof inboxId !== "string")
      fail(400, "usage", "wait-for-message requires an inbox id", 64);
    const timeoutSec = Number(flags.timeout ?? 300);
    const eventTypes = flags.eventTypes ?? ["message.received"];
    setTimeout(() => {
      fail(408, "timeout", `no matching event within ${timeoutSec}s`, 2);
    }, timeoutSec * 1e3).unref?.();
    connectStream(client, { inboxIds: [inboxId], eventTypes }, (event) => {
      console.log(JSON.stringify(event, null, 2));
      process.exit(0);
    });
    return;
  }
  if (group === "events" && method === "tail") {
    connectStream(
      client,
      {
        inboxIds: flags.inboxIds,
        eventTypes: flags.eventTypes
      },
      (event) => console.log(JSON.stringify(event))
    );
    return;
  }
  if (typeof method !== "string")
    fail(400, "usage", `missing command for "${group}" \u2014 see: agenticemail help`, 64);
  const fn = resolveCall(client, group, method);
  if (!fn)
    fail(400, "usage", `unknown command "${group} ${method}" \u2014 see: agenticemail help`, 64);
  let finalFlags = applyAttachments(flags);
  if (typeof finalFlags.json === "string") {
    const { json, ...restFlags } = finalFlags;
    finalFlags = { ...restFlags, ...JSON.parse(json) };
  }
  try {
    const result = await fn(...buildArgs({ positionals: rest, flags: finalFlags }));
    printResult(result);
  } catch (err) {
    if (err instanceof AgenticEmailError)
      fail(err.status, err.code, err.message);
    throw err;
  }
}
main().catch((err) => fail(0, "cli_error", err.message));
