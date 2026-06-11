#!/usr/bin/env bash
###############################################################################
# deploy-all.sh – Deploy AEGIS services to Google Cloud Run
#
# Required environment variables (export before running):
#   GCP_PROJECT_ID   – GCP project (e.g. aegis-2026)
#   GCP_REGION       – GCP region  (e.g. us-central1)
#   DYNATRACE_URL    – Full Dynatrace tenant URL
#   DYNATRACE_TOKEN  – Dynatrace API token
#   DYNATRACE_ENV_ID – Dynatrace environment ID
#   MONGODB_URI      – MongoDB Atlas connection string
#   MONGODB_DB       – MongoDB database name (default: aegis)
#   GITLAB_URL       – GitLab instance URL
#   GITLAB_TOKEN     – GitLab personal access token
#   GITLAB_PROJECT_PATH – GitLab project path (org/repo)
#   GITLAB_PROJECT_ID   – GitLab numeric project ID
#   ARIZE_API_KEY    – Arize Phoenix API key
#   ARIZE_SPACE_ID   – Arize Phoenix space ID
#   FRONTEND_URL     – Frontend URL (e.g. https://aegis.vercel.app)
###############################################################################
set -euo pipefail

# ─── Colours ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Colour

# ─── Validate required variables ─────────────────────────────────────────────
REQUIRED_VARS=(
  GCP_PROJECT_ID GCP_REGION
  DYNATRACE_URL DYNATRACE_TOKEN DYNATRACE_ENV_ID
  MONGODB_URI GITLAB_URL GITLAB_TOKEN GITLAB_PROJECT_PATH GITLAB_PROJECT_ID
  ARIZE_API_KEY ARIZE_SPACE_ID FRONTEND_URL
)

missing=0
for var in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    echo -e "${RED}ERROR: Required variable ${var} is not set.${NC}" >&2
    missing=1
  fi
done
if [[ $missing -eq 1 ]]; then
  echo -e "${RED}Aborting – please export all required variables first.${NC}" >&2
  exit 1
fi

# Defaults
MONGODB_DB="${MONGODB_DB:-aegis}"
SHOPSTREAM_SERVICE="sentinel-shopstream"
BACKEND_SERVICE="aegis-backend"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  AEGIS  ·  Cloud Run Deployment${NC}"
echo -e "${CYAN}  Project : ${GCP_PROJECT_ID}${NC}"
echo -e "${CYAN}  Region  : ${GCP_REGION}${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"

# ─── Configure gcloud ────────────────────────────────────────────────────────
echo -e "\n${YELLOW}▸ Configuring gcloud project & region …${NC}"
gcloud config set project "${GCP_PROJECT_ID}"
gcloud config set run/region "${GCP_REGION}"

###############################################################################
# 1. Deploy ShopStream (apps/shopstream)
###############################################################################
echo -e "\n${YELLOW}▸ Building & deploying ShopStream …${NC}"

SHOPSTREAM_IMAGE="gcr.io/${GCP_PROJECT_ID}/${SHOPSTREAM_SERVICE}:latest"

gcloud builds submit \
  --tag "${SHOPSTREAM_IMAGE}" \
  --project "${GCP_PROJECT_ID}" \
  "${REPO_ROOT}/apps/shopstream"

gcloud run deploy "${SHOPSTREAM_SERVICE}" \
  --image "${SHOPSTREAM_IMAGE}" \
  --platform managed \
  --region "${GCP_REGION}" \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --set-env-vars "\
GCP_PROJECT_ID=${GCP_PROJECT_ID},\
GCP_REGION=${GCP_REGION},\
DYNATRACE_URL=${DYNATRACE_URL},\
DYNATRACE_TOKEN=${DYNATRACE_TOKEN},\
DYNATRACE_ENV_ID=${DYNATRACE_ENV_ID}"

SHOPSTREAM_URL=$(gcloud run services describe "${SHOPSTREAM_SERVICE}" \
  --region "${GCP_REGION}" --format 'value(status.url)')

echo -e "${GREEN}✔ ShopStream deployed → ${SHOPSTREAM_URL}${NC}"

###############################################################################
# 2. Deploy Backend (apps/backend)
###############################################################################
echo -e "\n${YELLOW}▸ Building & deploying Backend …${NC}"

BACKEND_IMAGE="gcr.io/${GCP_PROJECT_ID}/${BACKEND_SERVICE}:latest"

gcloud builds submit \
  --tag "${BACKEND_IMAGE}" \
  --project "${GCP_PROJECT_ID}" \
  "${REPO_ROOT}/apps/backend"

gcloud run deploy "${BACKEND_SERVICE}" \
  --image "${BACKEND_IMAGE}" \
  --platform managed \
  --region "${GCP_REGION}" \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --set-env-vars "\
GCP_PROJECT_ID=${GCP_PROJECT_ID},\
GCP_REGION=${GCP_REGION},\
DYNATRACE_URL=${DYNATRACE_URL},\
DYNATRACE_TOKEN=${DYNATRACE_TOKEN},\
DYNATRACE_ENV_ID=${DYNATRACE_ENV_ID},\
MONGODB_URI=${MONGODB_URI},\
MONGODB_DB=${MONGODB_DB},\
GITLAB_URL=${GITLAB_URL},\
GITLAB_TOKEN=${GITLAB_TOKEN},\
GITLAB_PROJECT_PATH=${GITLAB_PROJECT_PATH},\
GITLAB_PROJECT_ID=${GITLAB_PROJECT_ID},\
ARIZE_API_KEY=${ARIZE_API_KEY},\
ARIZE_SPACE_ID=${ARIZE_SPACE_ID},\
FRONTEND_URL=${FRONTEND_URL}"

BACKEND_URL=$(gcloud run services describe "${BACKEND_SERVICE}" \
  --region "${GCP_REGION}" --format 'value(status.url)')

echo -e "${GREEN}✔ Backend deployed → ${BACKEND_URL}${NC}"

###############################################################################
# Summary
###############################################################################
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Deployment Complete!${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "  ${GREEN}ShopStream${NC} : ${SHOPSTREAM_URL}"
echo -e "  ${GREEN}Backend${NC}    : ${BACKEND_URL}"
echo -e "  ${GREEN}Frontend${NC}   : ${FRONTEND_URL}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "  1. Run ${CYAN}deploy/setup-dynatrace-webhook.sh${NC} with BACKEND_URL=${BACKEND_URL}"
echo -e "  2. Run ${CYAN}deploy/test-e2e.sh${NC} with BACKEND_URL=${BACKEND_URL}"
