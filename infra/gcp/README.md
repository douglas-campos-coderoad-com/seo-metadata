# Deploying to a GCP VM

CI builds the Docker images and pushes them to **Artifact Registry**; the deploy
job SSHes into one Compute Engine VM over an IAP tunnel and rolls the Docker
Compose stack forward. No service-account key ever leaves GCP, and no SSH key is
stored in GitHub.

You can ship **the backend, the frontend, or both** — the side you don't deploy
keeps running the image it is already on.

```
push to main  (or: Actions → Deploy to GCP VM → choose backend / frontend / both)
   │
   ├─ plan .............. resolves the selection into a build matrix
   ├─ ci.yml ............ pytest and/or lint + type-check + vitest + next build
   ├─ build ............. buildx → REGION-docker.pkg.dev/PROJECT/REPO/{api,web}:SHA
   └─ deploy ............ scp compose + .env over IAP → migrate (backend only)
                          → compose up -d <selected services> → health checks
```

| File | Role |
| --- | --- |
| [`../../.github/workflows/ci.yml`](../../.github/workflows/ci.yml) | Test gate. Runs on PRs; the deploy workflow reuses it, scoped to what is shipping. |
| [`../../.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml) | Plan, build, push, roll out. |
| [`../../docker-compose.prod.yml`](../../docker-compose.prod.yml) | The production stack. Pulls images, never builds. |
| [`vm-startup.sh`](vm-startup.sh) | Installs Docker on the Ubuntu VM. Runs on every boot. |
| [`deploy-remote.sh`](deploy-remote.sh) | The rollout itself. Runs on the VM. |

---

## One-time GCP setup

Set your values once and paste the rest verbatim.

```bash
export PROJECT_ID=your-project-id
export REGION=europe-west1          # Artifact Registry + VM region
export ZONE=europe-west1-b
export INSTANCE=seo-metadata-vm
export AR_REPO=seo-metadata
export GITHUB_REPO=your-org/seo-metadata   # owner/repo, exactly as on GitHub

gcloud config set project "$PROJECT_ID"
export PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
```

### 1. Enable the APIs

```bash
gcloud services enable \
  artifactregistry.googleapis.com \
  compute.googleapis.com \
  iap.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com
```

### 2. Create the Artifact Registry repository

Both images live in this one repository, as `…/REPO/api` and `…/REPO/web`.

```bash
gcloud artifacts repositories create "$AR_REPO" \
  --repository-format=docker \
  --location="$REGION" \
  --description="SEO metadata app images"
```

### 3. Service accounts

Two of them: one GitHub Actions impersonates, one the VM runs as.

```bash
# (a) The deployer — impersonated by GitHub Actions via Workload Identity
gcloud iam service-accounts create github-deployer \
  --display-name="GitHub Actions deployer"
export DEPLOYER="github-deployer@${PROJECT_ID}.iam.gserviceaccount.com"

# Push images, reach the VM through IAP, and log in over SSH with sudo
for ROLE in \
  roles/artifactregistry.writer \
  roles/compute.osAdminLogin \
  roles/iap.tunnelResourceAccessor \
  roles/compute.viewer
do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${DEPLOYER}" --role="$ROLE" --condition=None
done

# (b) The VM's own identity — only needs to pull images
gcloud iam service-accounts create seo-vm \
  --display-name="SEO metadata VM"
export VM_SA="seo-vm@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${VM_SA}" \
  --role=roles/artifactregistry.reader --condition=None

# The deployer must be allowed to act as the VM's service account to SSH in
gcloud iam service-accounts add-iam-policy-binding "$VM_SA" \
  --member="serviceAccount:${DEPLOYER}" \
  --role=roles/iam.serviceAccountUser
```

### 4. Workload Identity Federation (keyless auth)

```bash
gcloud iam workload-identity-pools create github \
  --location=global --display-name="GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc github-provider \
  --location=global \
  --workload-identity-pool=github \
  --display-name="GitHub OIDC" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
  --attribute-condition="assertion.repository=='${GITHUB_REPO}'"
```

The `--attribute-condition` is the security boundary: without it **any** GitHub
repository could mint tokens for your project.

Let the pool impersonate the deployer, scoped to this one repository:

```bash
gcloud iam service-accounts add-iam-policy-binding "$DEPLOYER" \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/attribute.repository/${GITHUB_REPO}"

# This exact string goes into the WIF_PROVIDER secret
echo "projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/providers/github-provider"
```

### 5. Create the VM

```bash
gcloud compute instances create "$INSTANCE" \
  --zone="$ZONE" \
  --machine-type=e2-medium \
  --image-family=ubuntu-2404-lts-amd64 \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=30GB \
  --boot-disk-type=pd-balanced \
  --service-account="$VM_SA" \
  --scopes=https://www.googleapis.com/auth/cloud-platform \
  --metadata=enable-oslogin=TRUE \
  --metadata-from-file=startup-script=infra/gcp/vm-startup.sh \
  --tags=seo-metadata
```

`e2-medium` (2 vCPU / 4 GB) is the practical floor: Chromium renders PDFs on this
box and `API_MEMORY_LIMIT` defaults to 2 GB.

### 6. Firewall

```bash
# IAP's tunnel range — this is what lets the deploy job SSH in
gcloud compute firewall-rules create allow-iap-ssh \
  --allow=tcp:22 --source-ranges=35.235.240.0/20 --target-tags=seo-metadata

# Public app traffic: 80 = frontend, 8000 = API (the browser calls it directly)
gcloud compute firewall-rules create allow-seo-http \
  --allow=tcp:80,tcp:8000 --source-ranges=0.0.0.0/0 --target-tags=seo-metadata
```

Postgres is deliberately absent: it has no published port and is reachable only
from inside the compose network.

### 7. Note the VM's IP

```bash
gcloud compute instances describe "$INSTANCE" --zone="$ZONE" \
  --format='value(networkInterfaces[0].accessConfigs[0].natIP)'
```

---

## GitHub configuration

**Settings → Secrets and variables → Actions → Variables**

| Variable | Example | Notes |
| --- | --- | --- |
| `GCP_PROJECT_ID` | `my-project` | |
| `GCP_REGION` | `europe-west1` | Artifact Registry region; forms the `REGION-docker.pkg.dev` host |
| `GCP_ZONE` | `europe-west1-b` | |
| `GCE_INSTANCE` | `seo-metadata-vm` | |
| `AR_REPOSITORY` | `seo-metadata` | The repository from step 2 |
| `FRONTEND_URL` | `http://34.1.2.3` | Public frontend origin; the API allows it through CORS |
| `NEXT_PUBLIC_API_BASE_URL` | `http://34.1.2.3:8000/api/v1` | **Baked into the frontend image at build time** |
| `POSTGRES_USER` / `POSTGRES_DB` | `incollect` | Optional; both default to `incollect` |
| `LLM_PROVIDER` | `gemini` | Optional; `gemini` or `anthropic` |

**Settings → Secrets and variables → Actions → Secrets**

| Secret | Notes |
| --- | --- |
| `WIF_PROVIDER` | The `projects/…/providers/github-provider` string from step 4 |
| `GCP_SERVICE_ACCOUNT` | `github-deployer@PROJECT_ID.iam.gserviceaccount.com` |
| `POSTGRES_PASSWORD` | Generate one: `openssl rand -base64 32` |
| `JWT_SECRET` | Generate one: `openssl rand -hex 32` |
| `GEMINI_API_KEY` | |
| `ANTHROPIC_API_KEY` | Only needed when `LLM_PROVIDER=anthropic` |
| `SERPER_API_KEY` | Optional; the optimizer degrades gracefully without it |

Optionally create a **`production` environment** (Settings → Environments) to get
deployment history and a manual-approval gate — `deploy.yml` already targets it.

---

## Deploying

**Everything.** Push to `main`. Tests run, both images build, the VM rolls
forward.

**One side only.** Actions → **Deploy to GCP VM** → *Run workflow* → pick
`backend` or `frontend`.

| Selection | Tests run | Images built | On the VM |
| --- | --- | --- | --- |
| `both` | backend + frontend | `api`, `web` | migrate, restart both |
| `backend` | backend only | `api` | migrate, restart `api`; `web` untouched |
| `frontend` | frontend only | `web` | restart `web`; no migrations, `api` untouched |

The two components carry independent tags (`API_IMAGE_TAG`, `WEB_IMAGE_TAG` in
the VM's `.env`). The deploy job sends `__KEEP__` for whichever side it is not
shipping, and [`deploy-remote.sh`](deploy-remote.sh) substitutes the tag already
running on the VM — so a frontend deploy can never quietly drag the backend to a
new commit. On a first-ever deploy there is nothing to keep, so the absent side
falls back to `latest`.

Note that scoping also scopes the gate: a `frontend` deploy runs only the
frontend checks. That is deliberate — it lets you ship a UI fix while the backend
suite is red — but it means a `backend`-only deploy has not re-verified the
frontend, and vice versa.

**Rolling back.** Run the workflow manually with an earlier commit SHA as
`image_tag`. That path skips both the build and the test gate and just re-points
the selected component(s) at that tag.

---

## Operating the VM

```bash
gcloud compute ssh "$INSTANCE" --zone="$ZONE" --tunnel-through-iap

sudo docker compose -f /opt/seo-metadata/docker-compose.prod.yml \
  --env-file /opt/seo-metadata/.env ps
sudo docker compose -f /opt/seo-metadata/docker-compose.prod.yml \
  --env-file /opt/seo-metadata/.env logs -f api

# Which images are actually running?
sudo grep -E '^(API|WEB)_IMAGE_TAG=' /opt/seo-metadata/.env
```

Back up the database:

```bash
sudo docker exec seo_postgres pg_dump -U incollect incollect | gzip > backup-$(date +%F).sql.gz
```

Nothing backs this up for you — the data lives in the `postgres_data` Docker
volume on the VM's boot disk. Set up a scheduled snapshot of the disk, or move to
Cloud SQL, before this holds anything you would miss.

---

## Two things worth knowing

**The frontend image is environment-specific.** `NEXT_PUBLIC_API_BASE_URL` is
inlined into the client bundle at build time, so a `web` image built for one API
URL cannot be reused against another. Changing the URL requires a rebuild, not
just a redeploy.

**The rollout is not zero-downtime.** `docker compose up -d` recreates changed
containers, so there is a few-second gap on each deploy, and migrations apply
before the new API starts. For a single-VM setup that is the honest trade; a
zero-downtime story means a load balancer and two instances.
