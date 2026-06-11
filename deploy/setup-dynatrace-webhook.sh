#!/usr/bin/env bash
###############################################################################
# setup-dynatrace-webhook.sh – Register a Dynatrace problem-notification
#                                webhook that pushes alerts to AEGIS.
#
# Required environment variables:
#   DYNATRACE_URL   – Dynatrace tenant URL  (e.g. https://abc12345.live.dynatrace.com)
#   DYNATRACE_TOKEN – Dynatrace API token   (scope: settings.write)
#   BACKEND_URL     – AEGIS backend URL (e.g. https://aegis-backend-xyz.run.app)
###############################################################################
set -euo pipefail

# ─── Colours ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# ─── Validate ────────────────────────────────────────────────────────────────
for var in DYNATRACE_URL DYNATRACE_TOKEN BACKEND_URL; do
  if [[ -z "${!var:-}" ]]; then
    echo -e "${RED}ERROR: ${var} is not set. Aborting.${NC}" >&2
    exit 1
  fi
done

# Strip trailing slash from URLs
DYNATRACE_URL="${DYNATRACE_URL%/}"
BACKEND_URL="${BACKEND_URL%/}"

WEBHOOK_ENDPOINT="${BACKEND_URL}/webhook/dynatrace"
SETTINGS_API="${DYNATRACE_URL}/api/v2/settings/objects"

echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  AEGIS  ·  Dynatrace Webhook Setup${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "  Dynatrace : ${DYNATRACE_URL}"
echo -e "  Webhook   : ${WEBHOOK_ENDPOINT}"
echo ""

# ─── Build the settings payload ──────────────────────────────────────────────
# The payload template uses Dynatrace's built-in placeholders so every problem
# notification carries the fields AEGIS needs for triage.
PAYLOAD=$(cat <<'TEMPLATE'
{
  "ProblemID": "{ProblemID}",
  "ProblemTitle": "{ProblemTitle}",
  "State": "{State}",
  "ProblemSeverity": "{ProblemSeverity}",
  "ProblemURL": "{ProblemURL}",
  "ProblemImpact": "{ProblemImpact}",
  "ImpactedEntities": {ImpactedEntities},
  "ProblemDetailsText": "{ProblemDetailsText}",
  "Tags": "{Tags}",
  "PID": "{PID}"
}
TEMPLATE
)

# Escape the template for embedding inside the outer JSON body
ESCAPED_PAYLOAD=$(echo "${PAYLOAD}" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))')

REQUEST_BODY=$(cat <<EOF
[
  {
    "schemaId": "builtin:problem.notifications",
    "schemaVersion": "1.5",
    "scope": "environment",
    "value": {
      "enabled": true,
      "displayName": "AEGIS Incident Webhook",
      "type": "WEBHOOK",
      "webHookUrl": "${WEBHOOK_ENDPOINT}",
      "acceptAnyCertificate": false,
      "notifyClosedProblems": true,
      "headers": [
        {
          "name": "Content-Type",
          "value": "application/json"
        }
      ],
      "payload": ${ESCAPED_PAYLOAD},
      "alertingProfile": ""
    }
  }
]
EOF
)

# ─── POST to Dynatrace Settings API ─────────────────────────────────────────
echo -e "${YELLOW}▸ Creating webhook notification setting …${NC}"

HTTP_CODE=$(curl --silent --output /tmp/dt-webhook-response.json --write-out "%{http_code}" \
  -X POST "${SETTINGS_API}" \
  -H "Authorization: Api-Token ${DYNATRACE_TOKEN}" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d "${REQUEST_BODY}")

RESPONSE=$(cat /tmp/dt-webhook-response.json)

if [[ "${HTTP_CODE}" =~ ^2 ]]; then
  echo -e "${GREEN}✔ Webhook created successfully (HTTP ${HTTP_CODE}).${NC}"
  echo -e "${GREEN}  Notifications will be sent to: ${WEBHOOK_ENDPOINT}${NC}"
  echo ""
  echo -e "${CYAN}Response:${NC}"
  echo "${RESPONSE}" | python3 -m json.tool 2>/dev/null || echo "${RESPONSE}"
else
  echo -e "${RED}✘ Failed to create webhook (HTTP ${HTTP_CODE}).${NC}" >&2
  echo -e "${RED}Response:${NC}" >&2
  echo "${RESPONSE}" | python3 -m json.tool 2>/dev/null || echo "${RESPONSE}" >&2
  exit 1
fi

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Dynatrace webhook setup complete.${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
