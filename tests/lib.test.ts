import { describe, expect, test } from "bun:test";
import { AgenticEmail } from "agenticemail";

import {
  applyAttachments,
  buildArgs,
  camel,
  commandTable,
  kebab,
  parseArgv,
  resolveCall,
} from "../src/lib";

const client = new AgenticEmail({ apiKey: "am_test" });

describe("parseArgv", () => {
  test("positionals, flags, and --key=value", () => {
    const p = parseArgv(["messages", "send", "inb_1", "--subject=Hi", "--text", "yo"]);
    expect(p.positionals).toEqual(["messages", "send", "inb_1"]);
    expect(p.flags).toEqual({ subject: "Hi", text: "yo" });
  });

  test("array keys comma-split and kebab-case camelizes", () => {
    const p = parseArgv(["--to", "a@x.com,b@y.com", "--event-types", "message.received"]);
    expect(p.flags.to).toEqual(["a@x.com", "b@y.com"]);
    expect(p.flags.eventTypes).toEqual(["message.received"]);
  });

  test("repeated flags append", () => {
    const p = parseArgv(["--to", "a@x.com", "--to", "b@y.com"]);
    expect(p.flags.to).toEqual(["a@x.com", "b@y.com"]);
  });

  test("bare flag is true, true/false coerce, '-' positional is null", () => {
    const p = parseArgv(["-", "--enabled", "false", "--ascending"]);
    expect(p.positionals).toEqual([null]);
    expect(p.flags).toEqual({ enabled: false, ascending: true });
  });
});

describe("dispatch", () => {
  test("resolveCall finds SDK methods incl. kebab-case groups", () => {
    expect(resolveCall(client, "messages", "send")).toBeFunction();
    expect(resolveCall(client, "api-keys", "create")).toBeFunction();
    expect(resolveCall(client, "nope", "x")).toBeNull();
    expect(resolveCall(client, "messages", "nope")).toBeNull();
  });

  test("buildArgs appends flags object only when flags exist", () => {
    expect(buildArgs({ positionals: ["inb_1"], flags: {} })).toEqual(["inb_1"]);
    expect(buildArgs({ positionals: [null, "receive"], flags: { entry: "x" } })).toEqual([
      null,
      "receive",
      { entry: "x" },
    ]);
  });

  test("commandTable lists the full SDK surface", () => {
    const table = commandTable(client);
    expect(table).toContain("inboxes list");
    expect(table).toContain("messages send");
    expect(table).toContain("api-keys create");
    expect(table).toContain("webhooks deliveries");
  });
});

describe("helpers", () => {
  test("camel/kebab round trip", () => {
    expect(camel("api-keys")).toBe("apiKeys");
    expect(kebab("apiKeys")).toBe("api-keys");
  });

  test("applyAttachments reads files as base64", () => {
    const file = `${import.meta.dir}/lib.test.ts`;
    const out = applyAttachments({ attach: file, subject: "s" }) as {
      attachments: { filename: string; content: string }[];
      subject: string;
    };
    expect(out.subject).toBe("s");
    expect(out.attachments[0]!.filename).toBe("lib.test.ts");
    expect(Buffer.from(out.attachments[0]!.content, "base64").toString()).toContain(
      "applyAttachments",
    );
  });
});
