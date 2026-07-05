# agenticemail-cli

Command-line interface for [AgenticEmail](https://agenticemail.dev) — email infrastructure for AI agents. Every command prints JSON, takes an API key from the environment, and uses predictable exit codes, so agents can drive email end to end from a shell.

## Install

```sh
npm install -g github:AgenticEmail/agenticemail-cli
# or with bun:
bun install -g github:AgenticEmail/agenticemail-cli
```

Requires Node 22+ or Bun (uses the built-in `fetch` and `WebSocket`).

## Auth

Create an API key at [app.agenticemail.dev/keys](https://app.agenticemail.dev/keys), then:

```sh
export AGENTICEMAIL_API_KEY=am_...
```

`AGENTICEMAIL_API_URL` overrides the API host (default `https://api.agenticemail.dev`). Both are also available as `--api-key` / `--api-url` flags.

## Usage

```
agenticemail <group> <command> [args...] [--flag value ...]
```

Flags are kebab-case and map to API request fields (`--display-name` → `display_name`). List-valued flags accept commas or repeats (`--to a@x.com,b@y.com`). Output is pretty-printed JSON on stdout; errors are one-line JSON on stderr. Exit codes: `0` success, `1` API error, `2` timeout, `64` usage error.

## End-to-end example (what an agent does)

```sh
# 1. get an inbox
INBOX=$(agenticemail inboxes create --username assistant | jq -r .id)

# 2. send an email
agenticemail messages send "$INBOX" \
  --to customer@example.com \
  --subject "Your order shipped" \
  --text "Tracking: 1Z999. Reply here with any questions."

# 3. block until the human replies (exit code 2 on timeout)
REPLY=$(agenticemail wait-for-message "$INBOX" --timeout 600)
MSG_ID=$(echo "$REPLY" | jq -r .data.message.id)

# 4. answer it
agenticemail messages reply "$INBOX" "$MSG_ID" --text "Happy to help!"
```

## Commands

The CLI exposes the full [AgenticEmail API](https://agenticemail.dev/docs):

| Group | Commands |
|---|---|
| `inboxes` | `create`, `list`, `get`, `update`, `delete` |
| `messages` | `send`, `send-batch`, `reply`, `forward`, `list`, `get`, `raw`, `search`, `update` (labels), `get-attachment` |
| `threads` | `list`, `get`, `search`, `update` |
| `drafts` | `create`, `list`, `get`, `update`, `delete`, `send` (use `--send-at` for scheduled sends) |
| `lists` | `create`, `list`, `get`, `delete` — allow/block lists; use `-` as the inbox arg for org-level |
| `webhooks` | `create`, `list`, `get`, `update`, `delete`, `deliveries` |
| `domains` | `create`, `list`, `get`, `verify`, `delete` |
| `api-keys` | `create`, `list`, `delete` |
| `events` | `tail` — stream live events as NDJSON |
| `wait-for-message` | block until an event arrives in an inbox, print it, exit |

Run `agenticemail help` for the always-current list (it is introspected from the SDK) plus all conventions.

### More examples

```sh
# read the newest 5 messages
agenticemail messages list inb_123 --limit 5

# full-text search
agenticemail messages search inb_123 --q "invoice" --after 2026-07-01

# send with attachments
agenticemail messages send inb_123 --to a@x.com --subject Report --text "attached" \
  --attach ./report.pdf --attach ./data.csv

# schedule for later
agenticemail drafts create inb_123 --to a@x.com --subject "Reminder" \
  --text "ping" --send-at 2026-07-06T09:00:00Z

# notify Slack on every inbound email
agenticemail webhooks create --url https://hooks.slack.com/services/T000/B000/xxx \
  --event-types message.received --json '{"provider":"slack"}'

# watch everything live
agenticemail events tail

# scoped key for a sub-agent, pinned to one inbox
agenticemail api-keys create scoped-agent --scopes message_read,message_send \
  --scope-inbox-id inb_123

# escape hatch: merge raw JSON fields into any request
agenticemail inboxes create --json '{"username":"support","client_id":"agent-7"}'
```

## Related

- [agenticemail (TypeScript SDK)](https://github.com/AgenticEmail/agenticemail-typescript) — the CLI is a thin wrapper over it
- [agenticemail-python](https://github.com/AgenticEmail/agenticemail-python)
- [API reference](https://agenticemail.dev/docs) — REST + MCP server

## License

Apache-2.0
