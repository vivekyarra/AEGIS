#!/usr/bin/env bash
###############################################################################
# test-e2e.sh – End-to-end smoke tests for the AEGIS backend
#
# Optional environment variables:
#   BACKEND_URL – defaults to http://localhost:8080
###############################################################################
set -euo pipefail

BACKEND_URL="${BACKEND_URL:-http://localhost:8080}"
BACKEND_URL="${BACKEND_URL%/}"   # strip trailing slash

# ─── Colours ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

PASS=0
FAIL=0

# ─── Helpers ─────────────────────────────────────────────────────────────────
pass() {
  PASS=$((PASS + 1))
  echo -e "  ${GREEN}✔ PASS${NC} – $1"
}

fail() {
  FAIL=$((FAIL + 1))
  echo -e "  ${RED}✘ FAIL${NC} – $1"
}

section() {
  echo -e "\n${CYAN}──── $1 ────${NC}"
}

###############################################################################
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  AEGIS  ·  End-to-End Tests${NC}"
echo -e "${CYAN}  Target : ${BACKEND_URL}${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"

###############################################################################
# 1. Health check
###############################################################################
section "Step 1 · GET /health"

HEALTH_CODE=$(curl --silent --output /tmp/e2e-health.json --write-out "%{http_code}" \
  "${BACKEND_URL}/health")

HEALTH_BODY=$(cat /tmp/e2e-health.json)

if [[ "${HEALTH_CODE}" == "200" ]]; then
  pass "Health endpoint returned HTTP 200"
  echo -e "       Response: ${HEALTH_BODY}"
else
  fail "Health endpoint returned HTTP ${HEALTH_CODE} (expected 200)"
  echo -e "       Response: ${HEALTH_BODY}"
fi

###############################################################################
# 2. Fetch existing (seeded) incidents
###############################################################################
section "Step 2 · GET /incidents (seeded data)"

INCIDENTS_CODE=$(curl --silent --output /tmp/e2e-incidents-before.json --write-out "%{http_code}" \
  "${BACKEND_URL}/incidents")

INCIDENTS_BODY=$(cat /tmp/e2e-incidents-before.json)

if [[ "${INCIDENTS_CODE}" == "200" ]]; then
  pass "Incidents endpoint returned HTTP 200"

  # Try to count items (requires jq or python)
  if command -v jq &>/dev/null; then
    COUNT_BEFORE=$(echo "${INCIDENTS_BODY}" | jq 'if type == "array" then length elif .incidents then (.incidents | length) else 0 end' 2>/dev/null || echo "?")
  elif command -v python3 &>/dev/null; then
    COUNT_BEFORE=$(echo "${INCIDENTS_BODY}" | python3 -c "
import sys, json
data = json.load(sys.stdin)
if isinstance(data, list):
    print(len(data))
elif isinstance(data, dict) and 'incidents' in data:
    print(len(data['incidents']))
else:
    print('?')
" 2>/dev/null || echo "?")
  else
    COUNT_BEFORE="?"
  fi

  echo -e "       Incidents count (before): ${COUNT_BEFORE}"
else
  fail "Incidents endpoint returned HTTP ${INCIDENTS_CODE} (expected 200)"
  echo -e "       Response: ${INCIDENTS_BODY}"
  COUNT_BEFORE="?"
fi

###############################################################################
# 3. Trigger a test webhook
###############################################################################
section "Step 3 · POST /webhook/test"

WEBHOOK_PAYLOAD='{"service_name":"checkout-service","severity":"P1"}'

WEBHOOK_CODE=$(curl --silent --output /tmp/e2e-webhook.json --write-out "%{http_code}" \
  -X POST "${BACKEND_URL}/webhook/test" \
  -H "Content-Type: application/json" \
  -d "${WEBHOOK_PAYLOAD}")

WEBHOOK_BODY=$(cat /tmp/e2e-webhook.json)

if [[ "${WEBHOOK_CODE}" =~ ^2 ]]; then
  pass "Webhook test returned HTTP ${WEBHOOK_CODE}"
  echo -e "       Response: ${WEBHOOK_BODY}"
else
  fail "Webhook test returned HTTP ${WEBHOOK_CODE} (expected 2xx)"
  echo -e "       Response: ${WEBHOOK_BODY}"
fi

###############################################################################
# 4. Wait for agent processing
###############################################################################
section "Step 4 · Waiting 10 seconds for agent to process …"

for i in $(seq 10 -1 1); do
  printf "\r       ${YELLOW}⏳ %2d seconds remaining …${NC}" "$i"
  sleep 1
done
printf "\r       ${GREEN}✔ Wait complete.              ${NC}\n"

###############################################################################
# 5. Verify new incident appeared
###############################################################################
section "Step 5 · GET /incidents (verify new incident)"

INCIDENTS2_CODE=$(curl --silent --output /tmp/e2e-incidents-after.json --write-out "%{http_code}" \
  "${BACKEND_URL}/incidents")

INCIDENTS2_BODY=$(cat /tmp/e2e-incidents-after.json)

if [[ "${INCIDENTS2_CODE}" == "200" ]]; then
  pass "Incidents endpoint returned HTTP 200"

  if command -v jq &>/dev/null; then
    COUNT_AFTER=$(echo "${INCIDENTS2_BODY}" | jq 'if type == "array" then length elif .incidents then (.incidents | length) else 0 end' 2>/dev/null || echo "?")
  elif command -v python3 &>/dev/null; then
    COUNT_AFTER=$(echo "${INCIDENTS2_BODY}" | python3 -c "
import sys, json
data = json.load(sys.stdin)
if isinstance(data, list):
    print(len(data))
elif isinstance(data, dict) and 'incidents' in data:
    print(len(data['incidents']))
else:
    print('?')
" 2>/dev/null || echo "?")
  else
    COUNT_AFTER="?"
  fi

  echo -e "       Incidents count (after): ${COUNT_AFTER}"

  # Compare counts
  if [[ "${COUNT_BEFORE}" != "?" && "${COUNT_AFTER}" != "?" ]]; then
    if [[ "${COUNT_AFTER}" -gt "${COUNT_BEFORE}" ]]; then
      pass "New incident detected (${COUNT_BEFORE} → ${COUNT_AFTER})"
    else
      fail "No new incident detected (count still ${COUNT_AFTER})"
    fi
  else
    echo -e "       ${YELLOW}⚠  Could not compare counts automatically – verify manually.${NC}"
  fi

  # Check for checkout-service in response
  if echo "${INCIDENTS2_BODY}" | grep -qi "checkout-service"; then
    pass "checkout-service incident found in response"
  else
    fail "checkout-service incident NOT found in response"
  fi
else
  fail "Incidents endpoint returned HTTP ${INCIDENTS2_CODE} (expected 200)"
  echo -e "       Response: ${INCIDENTS2_BODY}"
fi

###############################################################################
# Summary
###############################################################################
TOTAL=$((PASS + FAIL))

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Test Summary${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "  ${GREEN}Passed${NC} : ${PASS} / ${TOTAL}"
echo -e "  ${RED}Failed${NC} : ${FAIL} / ${TOTAL}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"

if [[ ${FAIL} -gt 0 ]]; then
  echo -e "\n${RED}${BOLD}Some tests failed. Please review the output above.${NC}"
  exit 1
else
  echo -e "\n${GREEN}${BOLD}All tests passed! 🎉${NC}"
  exit 0
fi
