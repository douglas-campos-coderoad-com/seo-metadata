#!/usr/bin/env bash
# Runs ON THE VM, invoked over SSH by .github/workflows/deploy.yml.
#
# The deploy job has already uploaded docker-compose.prod.yml and .env into
# ~/seo-metadata-staging/. This script installs them into /opt/seo-metadata,
# pulls the new images, migrates the database, and rolls the stack forward.
#
# Usage: deploy-remote.sh <registry-host> [both|backend|frontend]
#   e.g. deploy-remote.sh europe-west1-docker.pkg.dev backend
set -euo pipefail

REGISTRY_HOST="${1:?usage: deploy-remote.sh <registry-host> [both|backend|frontend]}"
COMPONENTS="${2:-both}"

# Overridable so the tag-resolution logic can be exercised outside a VM.
APP_DIR="${APP_DIR:-/opt/seo-metadata}"
STAGING_DIR="${STAGING_DIR:-${HOME}/seo-metadata-staging}"
STAGED_ENV="${STAGING_DIR}/.env"
COMPOSE=(sudo docker compose -f "${APP_DIR}/docker-compose.prod.yml" --env-file "${APP_DIR}/.env")

log() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }

case "${COMPONENTS}" in
  backend)  SERVICES=(api) ;;
  frontend) SERVICES=(web) ;;
  both)     SERVICES=(api web) ;;
  *)        echo "Unknown component selection: ${COMPONENTS}" >&2; exit 2 ;;
esac

log "Deploying: ${COMPONENTS} (services: ${SERVICES[*]})"

# ── Resolve image tags ────────────────────────────────────────────────────
# The deploy job writes __KEEP__ for whichever component is not being deployed;
# that component stays on the tag the VM is already running.
read_env_value() {
  local key="$1" file="$2"
  sudo grep -E "^${key}=" "${file}" 2>/dev/null | tail -1 | cut -d= -f2- || true
}

resolve_tag() {
  local key="$1" staged previous
  staged="$(read_env_value "${key}" "${STAGED_ENV}")"
  if [ "${staged}" != '__KEEP__' ]; then
    printf '%s' "${staged}"
    return
  fi
  previous="$(read_env_value "${key}" "${APP_DIR}/.env")"
  # `latest` is the first-deploy fallback: there is no previous release to keep.
  printf '%s' "${previous:-latest}"
}

API_TAG="$(resolve_tag API_IMAGE_TAG)"
WEB_TAG="$(resolve_tag WEB_IMAGE_TAG)"
log "Image tags — api: ${API_TAG}, web: ${WEB_TAG}"

sed -i \
  -e "s|^API_IMAGE_TAG=.*|API_IMAGE_TAG=${API_TAG}|" \
  -e "s|^WEB_IMAGE_TAG=.*|WEB_IMAGE_TAG=${WEB_TAG}|" \
  "${STAGED_ENV}"

# ── Install the release ───────────────────────────────────────────────────
log 'Installing release files'
sudo mkdir -p "${APP_DIR}"
sudo install -m 644 "${STAGING_DIR}/docker-compose.prod.yml" "${APP_DIR}/docker-compose.prod.yml"
# The .env holds API keys and the database password: root-only, never 644.
sudo install -m 600 -o root -g root "${STAGED_ENV}" "${APP_DIR}/.env"
shred -u "${STAGED_ENV}" 2>/dev/null || rm -f "${STAGED_ENV}"

log "Authenticating Docker against ${REGISTRY_HOST}"
# Uses the VM's attached service account; it needs roles/artifactregistry.reader.
sudo gcloud auth configure-docker "${REGISTRY_HOST}" --quiet

log 'Pulling images'
"${COMPOSE[@]}" pull "${SERVICES[@]}"

# ── Migrate, but only when the backend is part of this release ────────────
if [[ " ${SERVICES[*]} " == *" api "* ]]; then
  log 'Running database migrations'
  # --wait blocks until Postgres reports healthy, so the migration cannot race
  # the database coming up. It runs on the new API image, before any new API
  # container starts serving traffic.
  "${COMPOSE[@]}" up -d --wait postgres
  "${COMPOSE[@]}" run --rm --no-deps api alembic upgrade head
else
  log 'Frontend-only release — skipping migrations'
fi

log 'Starting the stack'
"${COMPOSE[@]}" up -d --remove-orphans "${SERVICES[@]}"

# ── Verify what we just deployed ──────────────────────────────────────────
if [[ " ${SERVICES[*]} " == *" api "* ]]; then
  log 'Waiting for the API to report healthy'
  for attempt in $(seq 1 30); do
    if curl -fsS http://localhost:8000/api/v1/health >/dev/null 2>&1; then
      log 'API is healthy'
      break
    fi
    if [ "${attempt}" -eq 30 ]; then
      log 'API never became healthy — recent logs follow'
      "${COMPOSE[@]}" logs --tail 80 api
      exit 1
    fi
    sleep 5
  done
fi

if [[ " ${SERVICES[*]} " == *" web "* ]]; then
  log 'Verifying the frontend responds'
  if ! curl -fsS -o /dev/null --retry 10 --retry-delay 3 --retry-connrefused http://localhost:80; then
    "${COMPOSE[@]}" logs --tail 40 web
    exit 1
  fi
fi

log 'Pruning images from previous releases'
sudo docker image prune -af --filter 'until=168h'

log 'Deployed'
"${COMPOSE[@]}" ps
