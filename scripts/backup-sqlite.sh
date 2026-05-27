#!/usr/bin/env bash
# Back up the discord-translate SQLite volume to a tar.gz archive.
#
# Usage: ./scripts/backup-sqlite.sh <output-archive.tgz>
#
# Strategy: spin up a throwaway alpine container, mount the named
# volume read-only, tar its contents to stdout, capture host-side.
# Works regardless of whether the bot container is running, but
# WAL/SHM files may be present — they're included so the archive is
# a consistent SQLite checkpoint as of the snapshot moment.

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <output-archive.tgz>" >&2
  exit 2
fi

OUT="$1"
VOLUME="${DT_VOLUME_NAME:-discord-translate_bot-data}"

if ! docker volume inspect "$VOLUME" >/dev/null 2>&1; then
  echo "error: volume '$VOLUME' does not exist." >&2
  echo "       set DT_VOLUME_NAME or run 'docker compose up' first." >&2
  exit 1
fi

mkdir -p "$(dirname "$OUT")"

docker run --rm \
  -v "$VOLUME:/data:ro" \
  alpine:3 \
  tar -czf - -C /data . > "$OUT"

SIZE=$(du -h "$OUT" | cut -f1)
echo "ok: backed up volume '$VOLUME' -> $OUT ($SIZE)"
