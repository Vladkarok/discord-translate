#!/usr/bin/env bash
# Deploy script for the self-hosted runner step.
#
# Required env:
#   REPO_OWNER         lowercased GitHub owner (e.g. "vladkarok")
#   IMAGE_TAG          image tag to deploy (short SHA, "latest", etc.)
#   GHCR_TOKEN         token with packages:read scope (GITHUB_TOKEN)
#   DEPLOY_SSH_ALIAS   SSH host alias on the runner (default: disctrans-vprojects)
#   DEPLOY_APP_DIR     remote app dir (default: /home/vladkarok/apps/discord-translate)

set -euo pipefail

target_alias="${DEPLOY_SSH_ALIAS:-disctrans-vprojects}"
app_dir="${DEPLOY_APP_DIR:-/home/vladkarok/apps/discord-translate}"

: "${REPO_OWNER:?REPO_OWNER is required}"
: "${IMAGE_TAG:?IMAGE_TAG is required}"
: "${GHCR_TOKEN:?GHCR_TOKEN is required}"

q() { printf "%q" "$1"; }

ssh "$target_alias" "mkdir -p $(q "$app_dir")"
scp docker-compose.yml "$target_alias:$(q "$app_dir")/docker-compose.yml"

printf "%s" "$GHCR_TOKEN" | ssh "$target_alias" \
  "umask 077; cat > $(q "$app_dir")/.ghcr-token"

ssh "$target_alias" \
  "APP_DIR=$(q "$app_dir") REPO_OWNER=$(q "$REPO_OWNER") IMAGE_TAG=$(q "$IMAGE_TAG") bash -s" <<'REMOTE'
set -euo pipefail

cd "$APP_DIR"
trap 'rm -f .ghcr-token' EXIT

docker login ghcr.io -u "$REPO_OWNER" --password-stdin < .ghcr-token

if [ ! -f .env ]; then
  echo "ERROR: $APP_DIR/.env missing. scp it from a workstation before first deploy." >&2
  exit 1
fi

export IMAGE_TAG
docker compose --env-file .env pull bot
docker compose --env-file .env up -d --remove-orphans --no-build

container_id=$(docker compose --env-file .env ps -q bot)
test -n "$container_id"

# No HEALTHCHECK in the image — give the bot ~20s to either crash-loop or
# stay up, then assert State.Status is still "running".
for _ in 1 2 3 4 5 6 7 8 9 10; do
  state=$(docker inspect --format '{{.State.Status}}' "$container_id")
  case "$state" in
    exited|dead)
      docker logs "$container_id" --tail 100
      exit 1
      ;;
  esac
  sleep 2
done

state=$(docker inspect --format '{{.State.Status}}' "$container_id")
if [ "$state" != "running" ]; then
  docker logs "$container_id" --tail 100
  exit 1
fi
restarts=$(docker inspect --format '{{.RestartCount}}' "$container_id")
if [ "$restarts" -gt 0 ]; then
  echo "WARN: container restarted $restarts time(s) during startup window" >&2
  docker logs "$container_id" --tail 100
  exit 1
fi

docker image prune -af --filter "until=168h" >/dev/null || true

echo "Deploy complete: $(date -u +%FT%TZ) image=$IMAGE_TAG"
REMOTE
