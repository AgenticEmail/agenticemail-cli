import { readFileSync } from "node:fs";
import { basename } from "node:path";

import { AgenticEmail } from "agenticemail";

/** Flags whose values the API expects as arrays; comma-split single values. */
const ARRAY_KEYS = new Set([
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
  "scopes",
]);

export const camel = (s: string) =>
  s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
export const kebab = (s: string) =>
  s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

export type Parsed = {
  positionals: (string | null)[];
  flags: Record<string, unknown>;
};

/**
 * `--key value`, `--key=value`, bare `--key` (true), repeated keys append.
 * Positional `-` means null (e.g. org-level list commands take `-` for inbox).
 */
export function parseArgv(argv: string[]): Parsed {
  const positionals: (string | null)[] = [];
  const flags: Record<string, unknown> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (!arg.startsWith("--")) {
      positionals.push(arg === "-" ? null : arg);
      continue;
    }
    const eq = arg.indexOf("=");
    let key: string;
    let raw: string | true;
    if (eq !== -1) {
      key = arg.slice(2, eq);
      raw = arg.slice(eq + 1);
    } else {
      key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        raw = next;
        i++;
      } else raw = true;
    }
    key = camel(key);
    let value: unknown = raw;
    if (value === "true") value = true;
    else if (value === "false") value = false;
    if (ARRAY_KEYS.has(key) && typeof value === "string")
      value = value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    if (key in flags) {
      const prev = flags[key];
      const prevArr = Array.isArray(prev) ? prev : [prev];
      flags[key] = prevArr.concat(value);
    } else flags[key] = value;
  }
  return { positionals, flags };
}

/** `--attach <file>` (repeatable) → attachments: [{filename, content: base64}] */
export function applyAttachments(flags: Record<string, unknown>) {
  if (!("attach" in flags)) return flags;
  const files = Array.isArray(flags.attach) ? flags.attach : [flags.attach];
  const { attach: _drop, ...rest } = flags;
  return {
    ...rest,
    attachments: files.map((file) => ({
      filename: basename(String(file)),
      content: readFileSync(String(file)).toString("base64"),
    })),
  };
}

export function resolveCall(
  client: AgenticEmail,
  group: string,
  method: string,
): ((...args: unknown[]) => Promise<unknown>) | null {
  const g = (client as unknown as Record<string, unknown>)[camel(group)];
  if (!g || typeof g !== "object") return null;
  const fn = (g as Record<string, unknown>)[camel(method)];
  return typeof fn === "function"
    ? (fn as (...args: unknown[]) => Promise<unknown>)
    : null;
}

export function buildArgs(parsed: Parsed): unknown[] {
  const args: unknown[] = [...parsed.positionals];
  if (Object.keys(parsed.flags).length) args.push(parsed.flags);
  return args;
}

/** All `group method` pairs, introspected from the client instance. */
export function commandTable(client: AgenticEmail): string[] {
  const rows: string[] = [];
  for (const [group, value] of Object.entries(client)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    for (const [method, fn] of Object.entries(value))
      if (typeof fn === "function") rows.push(`${kebab(group)} ${kebab(method)}`);
  }
  return rows.sort();
}
