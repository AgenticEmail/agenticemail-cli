#!/usr/bin/env bash
# Quickstart: an agent's email loop — create an inbox, send, wait for the
# reply, answer it.
#
#   export AGENTICEMAIL_API_KEY=am_...
#   ./examples/agent-loop.sh customer@example.com
set -euo pipefail
TO=${1:?usage: agent-loop.sh <recipient>}

INBOX=$(agenticemail inboxes create --username agent | jq -r .id)
echo "inbox: $INBOX" >&2

agenticemail messages send "$INBOX" \
  --to "$TO" \
  --subject "Hello from an agent" \
  --text "Reply to this email and I'll answer." >&2

echo "waiting for a reply (10 min)..." >&2
EVENT=$(agenticemail wait-for-message "$INBOX" --timeout 600)
MSG_ID=$(echo "$EVENT" | jq -r .data.message.id)
echo "$EVENT" | jq .data.message.text >&2

agenticemail messages reply "$INBOX" "$MSG_ID" --text "Got it — thanks!"
