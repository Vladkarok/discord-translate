#!/usr/bin/env bash
# Restore the discord-translate SQLite volume from a backup archive.
#
# Usage: ./scripts/restore-sqlite.sh <archive.tgz>
#
# Stops the bot if running, wipes the volume's current contents,
# extracts the archive in. Bring the bot back up with
# `docker compose up -d` after this finishes.

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <archive.tgz>" >&2
  exit 2
fi

SRC="$1"
VOLUME="${DT_VOLUME_NAME:-discord-translate_bot-data}"

if [[ ! -f "$SRC" ]]; then
  echo "error: backup archive not found: $SRC" >&2
  exit 1
fi

# Refuse to restore while the bot is running — it has the SQLite file
# open and our changes would be silently overwritten on next checkpoint.
if docker compose ps --status running --services 2>/dev/null | grep -qx bot; then
  echo "error: bot container is running. Stop it first:" >&2
  echo "         docker compose down" >&2
  exit 1
fi

# Create the volume if it doesn't exist yet (fresh-host restore).
docker volume create "$VOLUME" >/dev/null

echo "warning: about to wipe and replace contents of volume '$VOLUME'."
read -r -p "type 'yes' to continue: " CONFIRM
if [[ "$CONFIRM" != "yes" ]]; then
  echo "aborted."
  exit 1
fi

# Wipe, then extract. Use one container so the wipe and extract are
# atomic from the host's perspective.
docker run --rm \
  -v "$VOLUME:/data" \
  -v "$(realpath "$SRC"):/backup.tgz:ro" \
  alpine:3 \
  sh -c 'rm -rf /data/* /data/.[!.]* /data/..?* 2>/dev/null; tar -xzf /backup.tgz -C /data'

echo "ok: restored '$SRC' -> volume '$VOLUME'"
echo "    now bring the bot back up: docker compose up -d"
