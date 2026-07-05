# Changelog

## 0.1.0

Initial public release.

- Full API surface as commands: inboxes, messages (send, batch, reply, forward, search, attachments, raw), threads, drafts (including scheduled send), allow/block lists, webhooks, domains, and API keys
- `events tail` — live event stream as NDJSON
- `wait-for-message` — block until an inbox receives a message, print it, exit (built for agent loops)
- JSON in, JSON out: kebab-case flags map to API fields, `--json` escape hatch, predictable exit codes (0 ok, 1 API error, 2 timeout, 64 usage)
- `--attach <file>` for base64 attachment upload
