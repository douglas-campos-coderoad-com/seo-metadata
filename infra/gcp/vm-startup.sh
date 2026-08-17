#!/usr/bin/env bash
# VM startup script for Ubuntu Server (24.04 LTS) — pass it to
# `gcloud compute instances create` with
#   --metadata-from-file startup-script=infra/gcp/vm-startup.sh
#
# Installs Docker Engine + the compose plugin and prepares the app directory.
# It re-runs on every boot, so every step is idempotent.
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y ca-certificates curl gnupg

  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg |
    gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    >/etc/apt/sources.list.d/docker.list

  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin
fi

systemctl enable --now docker

# Ubuntu images on GCE ship the gcloud CLI as a snap; the deploy script calls it
# through sudo to authenticate Docker against Artifact Registry.
if ! command -v gcloud >/dev/null 2>&1; then
  snap install google-cloud-cli --classic
fi

# Cap the journal and Docker logs. A small VM fills its disk with container logs
# surprisingly fast, and a full disk takes Postgres down with it.
mkdir -p /etc/docker
cat >/etc/docker/daemon.json <<'JSON'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
JSON
systemctl restart docker

mkdir -p /opt/seo-metadata
