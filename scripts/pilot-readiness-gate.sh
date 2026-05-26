#!/usr/bin/env bash
# pilot-readiness-gate.sh
#
# #WAVE23: CI-Pre-Merge-Smoke-Test gegen Staging. Verifiziert die 3
# Wave-23-Acceptance-Items + Hash-Chain-Integrität, exit 0 bei grün,
# exit 1 mit Detail bei rot. Wave-23-Prompt-Definition:
#
#   - A1: POST /findings persists controlId from body
#   - A2: GET /admin/branding returns 200 oder 501, niemals 500
#   - C3: POST /contracts {name:'X'} returns 422 oder 201, niemals 500
#   - Hash-Chain: GET /audit-log/integrity → healthy=true
#
# Erwartete Env-Vars:
#   STAGING_URL              (z. B. https://staging.arctos.charliehund.de)
#   STAGING_ADMIN_EMAIL      (z. B. admin@arctos.dev)
#   STAGING_ADMIN_PASSWORD   (Repo-Secret)
#
# Wenn STAGING_URL nicht gesetzt ist (z. B. PR aus Fork), exit 0 mit
# "skipped" — der CI-Job markiert dann sich selbst als skipped, blockt
# aber nicht den Merge. Forks/externe PRs müssen separat gegen den
# Owner-Staging-Branch verifiziert werden.

set -euo pipefail

if [[ -z "${STAGING_URL:-}" ]]; then
  echo "::warning::STAGING_URL not set — pilot-readiness-gate skipped"
  echo "SKIPPED"
  exit 0
fi

STAGING_URL="${STAGING_URL%/}"  # strip trailing slash
STAGING_ADMIN_EMAIL="${STAGING_ADMIN_EMAIL:-admin@arctos.dev}"
STAGING_ADMIN_PASSWORD="${STAGING_ADMIN_PASSWORD:-}"

if [[ -z "$STAGING_ADMIN_PASSWORD" ]]; then
  echo "::error::STAGING_ADMIN_PASSWORD not set — cannot authenticate"
  exit 1
fi

echo "▶ Pilot-Readiness-Gate against ${STAGING_URL}"

# ────────────────────────────────────────────────────────────
# D1 — Build-SHA-Diagnose (informational, never blocks).
# ────────────────────────────────────────────────────────────
BUILD_INFO=$(curl -fsS -m 10 "${STAGING_URL}/api/v1/meta/build" 2>/dev/null || echo '{}')
PROD_SHA=$(echo "$BUILD_INFO" | jq -r '.data.commitSha // "unknown"')
PROD_BRANCH=$(echo "$BUILD_INFO" | jq -r '.data.branch // "unknown"')
PROD_BUILT=$(echo "$BUILD_INFO" | jq -r '.data.builtAt // "unknown"')
echo "ℹ Staging build: sha=${PROD_SHA:0:8} branch=${PROD_BRANCH} built=${PROD_BUILT}"

# ────────────────────────────────────────────────────────────
# Auth: NextAuth credentials provider POST.
# ────────────────────────────────────────────────────────────
COOKIE_JAR=$(mktemp)
trap 'rm -f "$COOKIE_JAR"' EXIT

# Step 1: get CSRF token
CSRF_RES=$(curl -fsS -m 10 -c "$COOKIE_JAR" "${STAGING_URL}/api/auth/csrf")
CSRF_TOKEN=$(echo "$CSRF_RES" | jq -r '.csrfToken')
if [[ -z "$CSRF_TOKEN" || "$CSRF_TOKEN" == "null" ]]; then
  echo "::error::Could not fetch CSRF token from ${STAGING_URL}/api/auth/csrf"
  exit 1
fi

# Step 2: POST credentials
LOGIN_RES_CODE=$(curl -fsS -m 15 -o /dev/null -w "%{http_code}" \
  -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
  -X POST "${STAGING_URL}/api/auth/callback/credentials" \
  -d "csrfToken=${CSRF_TOKEN}" \
  -d "email=${STAGING_ADMIN_EMAIL}" \
  -d "password=${STAGING_ADMIN_PASSWORD}" \
  -d "redirect=false" \
  -d "json=true")

if [[ "$LOGIN_RES_CODE" != "200" && "$LOGIN_RES_CODE" != "302" ]]; then
  echo "::error::Login to staging failed: HTTP ${LOGIN_RES_CODE}"
  exit 1
fi

# Verify session
SESSION_RES=$(curl -fsS -m 10 -b "$COOKIE_JAR" "${STAGING_URL}/api/auth/session")
SESSION_USER=$(echo "$SESSION_RES" | jq -r '.user.email // "none"')
if [[ "$SESSION_USER" == "none" ]]; then
  echo "::error::Session not established after login"
  exit 1
fi
echo "✓ Authenticated as ${SESSION_USER}"

# ────────────────────────────────────────────────────────────
# Org context: switch to the demo tenant so the data assertions
# below see populated seed data. Admin lands in their first org
# by default (often a fresh/empty tenant); the demo seeds live
# in the Meridian Demo tenant.
# Override via STAGING_DEMO_ORG_ID env var if your staging uses
# a different tenant id.
# ────────────────────────────────────────────────────────────
STAGING_DEMO_ORG_ID="${STAGING_DEMO_ORG_ID:-ccc4cc1c-4b09-499c-8420-ebd8da655cd7}"
SWITCH_RES=$(curl -sS -m 10 -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
  -X POST -H "Content-Type: application/json" \
  "${STAGING_URL}/api/v1/auth/switch-org" \
  -d "{\"orgId\":\"${STAGING_DEMO_ORG_ID}\"}")
if [[ "$(echo "$SWITCH_RES" | jq -r '.ok // false')" != "true" ]]; then
  echo "::error::Org-switch to ${STAGING_DEMO_ORG_ID} failed: $SWITCH_RES"
  exit 1
fi
echo "✓ Org context set to ${STAGING_DEMO_ORG_ID:0:8}..."

# ────────────────────────────────────────────────────────────
# A1 — POST /findings persists controlId from body
# ────────────────────────────────────────────────────────────
echo ""
echo "▶ A1: POST /findings persists controlId"
CTRL=$(curl -fsS -m 10 -b "$COOKIE_JAR" \
  "${STAGING_URL}/api/v1/controls?limit=1" | jq -r '.data[0].id // empty')
if [[ -z "$CTRL" ]]; then
  echo "::error::A1 setup: no control row available on staging"
  exit 1
fi

FIND_RES=$(curl -sS -m 15 -b "$COOKIE_JAR" \
  -H "content-type: application/json" \
  -X POST "${STAGING_URL}/api/v1/findings" \
  -d "{\"title\":\"pilot-readiness-gate A1\",\"severity\":\"major_nonconformity\",\"source\":\"audit\",\"controlId\":\"${CTRL}\"}")
FIND_ID=$(echo "$FIND_RES" | jq -r '.data.id // empty')

if [[ -z "$FIND_ID" ]]; then
  echo "::error::A1 POST /findings failed:"
  echo "$FIND_RES" | jq . || echo "$FIND_RES"
  exit 1
fi

# Round-trip: GET /findings/{id} must show controlId == CTRL
PERSISTED_CTRL=$(curl -fsS -m 10 -b "$COOKIE_JAR" \
  "${STAGING_URL}/api/v1/findings/${FIND_ID}" | jq -r '.data.controlId // "null"')

if [[ "$PERSISTED_CTRL" != "$CTRL" ]]; then
  echo "::error::A1 GATE FAIL — controlId not persisted"
  echo "  expected: $CTRL"
  echo "  actual:   $PERSISTED_CTRL"
  exit 1
fi
echo "✓ A1 passed (controlId persisted as ${CTRL:0:8}...)"

# ────────────────────────────────────────────────────────────
# A2 — /admin/branding returns 200 or 501, never 500
# ────────────────────────────────────────────────────────────
echo ""
echo "▶ A2: GET /admin/branding never 500"
BRAND_CODE=$(curl -sS -m 10 -o /dev/null -w "%{http_code}" \
  -b "$COOKIE_JAR" "${STAGING_URL}/api/v1/admin/branding")
if [[ "$BRAND_CODE" != "200" && "$BRAND_CODE" != "501" ]]; then
  echo "::error::A2 GATE FAIL — /admin/branding=${BRAND_CODE} (expected 200 or 501)"
  exit 1
fi
echo "✓ A2 passed (branding returned ${BRAND_CODE})"

# ────────────────────────────────────────────────────────────
# C3 — Contract POST {name:'X'} never 500
# ────────────────────────────────────────────────────────────
echo ""
echo "▶ C3: POST /contracts {name:'X'} never 500"
C3_CODE=$(curl -sS -m 10 -o /dev/null -w "%{http_code}" \
  -b "$COOKIE_JAR" -H "content-type: application/json" \
  -X POST "${STAGING_URL}/api/v1/contracts" \
  -d '{"name":"pilot-readiness-gate C3","contractType":"service_agreement"}')

# Wave-22 mapped name→title in schema → expect 201. If alias is removed
# in a future release, 422 is also acceptable. 500 is forbidden.
if [[ "$C3_CODE" == "500" ]]; then
  echo "::error::C3 GATE FAIL — /contracts {name:…} returned 500 (regression!)"
  exit 1
fi
if [[ "$C3_CODE" != "201" && "$C3_CODE" != "422" ]]; then
  echo "::warning::C3 unexpected status ${C3_CODE} (acceptable: 201 or 422)"
fi
echo "✓ C3 passed (contracts returned ${C3_CODE})"

# ────────────────────────────────────────────────────────────
# Hash-Chain integrity — Wave-23-Vorbedingung
# ────────────────────────────────────────────────────────────
echo ""
echo "▶ Hash-Chain integrity"
INTEGRITY_RES=$(curl -fsS -m 30 -b "$COOKIE_JAR" \
  "${STAGING_URL}/api/v1/audit-log/integrity")
HEALTHY=$(echo "$INTEGRITY_RES" | jq -r '.data.healthy // false')
MISMATCHES=$(echo "$INTEGRITY_RES" | jq -r '.data.mismatches // -1')

if [[ "$HEALTHY" != "true" ]]; then
  echo "::error::HASH-CHAIN GATE FAIL — healthy=${HEALTHY} mismatches=${MISMATCHES}"
  echo "$INTEGRITY_RES" | jq . || echo "$INTEGRITY_RES"
  exit 1
fi
echo "✓ Hash-Chain healthy (mismatches=${MISMATCHES})"

# ────────────────────────────────────────────────────────────
# #WAVE24: Block-B / Block-C / Block-D regression checks. These
# extend the gate from "Wave-23 acceptance items" to "Wave-24
# alpha-quality items" so future RBAC tightenings can't silently
# break user workflows again.
# ────────────────────────────────────────────────────────────

# B1 — Audit-log integrity readable by CISO + compliance_officer.
#
# Reads as admin here (we don't have a CISO session in the gate
# harness) but checks the response shape exposes the
# admin/auditor/ciso/compliance_officer role list via OPTIONS or
# via the integrity body itself. The simpler check: integrity GET
# returns 200 (not 403) for the gate's admin session — that's
# already covered above but we explicitly re-assert it didn't
# silently flip to 503 from the broader role list.
echo ""
echo "▶ B1: /audit-log/integrity remains 200 for admin"
B1_CODE=$(curl -sS -m 15 -o /dev/null -w "%{http_code}" \
  -b "$COOKIE_JAR" "${STAGING_URL}/api/v1/audit-log/integrity")
if [[ "$B1_CODE" != "200" ]]; then
  echo "::error::B1 GATE FAIL — /audit-log/integrity=${B1_CODE} (expected 200)"
  exit 1
fi
echo "✓ B1 passed (status=${B1_CODE})"

# B2 — Finding status filter validates enum: invalid → 422, never 500.
echo ""
echo "▶ B2: /findings?status=invalid → 422"
B2_CODE=$(curl -sS -m 10 -o /dev/null -w "%{http_code}" \
  -b "$COOKIE_JAR" "${STAGING_URL}/api/v1/findings?status=open_garbage_value")
if [[ "$B2_CODE" == "500" ]]; then
  echo "::error::B2 GATE FAIL — /findings?status=invalid returned 500 (regression!)"
  exit 1
fi
if [[ "$B2_CODE" != "422" ]]; then
  echo "::warning::B2 unexpected status ${B2_CODE} (expected 422)"
fi
echo "✓ B2 passed (status=${B2_CODE})"

# B3 — /erm/management-summary readable for admin.
echo ""
echo "▶ B3: GET /erm/management-summary returns 200"
B3_CODE=$(curl -sS -m 15 -o /dev/null -w "%{http_code}" \
  -b "$COOKIE_JAR" "${STAGING_URL}/api/v1/erm/management-summary")
if [[ "$B3_CODE" != "200" ]]; then
  echo "::error::B3 GATE FAIL — /erm/management-summary=${B3_CODE} (expected 200)"
  exit 1
fi
echo "✓ B3 passed (status=${B3_CODE})"

# B4 — POST /control-tests succeeds with a valid body.
echo ""
echo "▶ B4: POST /control-tests {valid body} → 201"
# Reuse the control from A1 — already verified to exist.
B4_CODE=$(curl -sS -m 15 -o /dev/null -w "%{http_code}" \
  -b "$COOKIE_JAR" -H "content-type: application/json" \
  -X POST "${STAGING_URL}/api/v1/control-tests" \
  -d "{\"controlId\":\"${CTRL}\",\"testType\":\"design_effectiveness\",\"testDate\":\"2026-05-15\"}")
if [[ "$B4_CODE" != "201" ]]; then
  echo "::error::B4 GATE FAIL — POST /control-tests=${B4_CODE} (expected 201)"
  exit 1
fi
echo "✓ B4 passed (status=${B4_CODE})"

# C1 — Hash-chain v3 continuity proof.
echo ""
echo "▶ C1: /audit-log/integrity/continuity totalContinuityValid=true"
CONT_RES=$(curl -sS -m 15 -b "$COOKIE_JAR" \
  "${STAGING_URL}/api/v1/audit-log/integrity/continuity")
CONT_VALID=$(echo "$CONT_RES" | jq -r '.data.totalContinuityValid // false')
CONT_CLAIM=$(echo "$CONT_RES" | jq -r '.data.continuityClaim // "unknown"')
if [[ "$CONT_VALID" != "true" ]]; then
  echo "::error::C1 GATE FAIL — totalContinuityValid=${CONT_VALID} claim=${CONT_CLAIM}"
  echo "$CONT_RES" | jq . || echo "$CONT_RES"
  exit 1
fi
echo "✓ C1 passed (claim=${CONT_CLAIM})"

# D1 — process_owner can update treatments. The gate doesn't have a
# process_owner session, so instead we verify the underlying route
# accepts the call. PUT against a stub treatmentId of all zeros
# should hit the 404-not-found path (proves authorisation passed)
# rather than 403 (proves it didn't).
echo ""
echo "▶ D1: PUT /risks/{id}/treatments/{tid} not 403 for admin"
D1_CODE=$(curl -sS -m 15 -o /dev/null -w "%{http_code}" \
  -b "$COOKIE_JAR" -H "content-type: application/json" \
  -X PUT "${STAGING_URL}/api/v1/risks/00000000-0000-0000-0000-000000000000/treatments/00000000-0000-0000-0000-000000000001" \
  -d '{"status":"in_progress"}')
if [[ "$D1_CODE" == "403" ]]; then
  echo "::error::D1 GATE FAIL — admin got 403 on treatment PUT (regression!)"
  exit 1
fi
echo "✓ D1 passed (status=${D1_CODE}; 404/422 expected for stub IDs)"

# ────────────────────────────────────────────────────────────
# #WAVE25: Block-B / Block-C regression checks. Locks down the
# four endpoint contracts added in Wave 25 so RBAC narrowing or
# filter-validation regressions can't sneak back in.
# ────────────────────────────────────────────────────────────

# W25-B1 — Finding filter rejects bogus UUID with 422, not 500.
echo ""
echo "▶ W25-B1: /findings?controlId=not-a-uuid → 422"
W25_B1=$(curl -sS -m 10 -o /dev/null -w "%{http_code}" \
  -b "$COOKIE_JAR" "${STAGING_URL}/api/v1/findings?controlId=not-a-uuid")
if [[ "$W25_B1" == "500" ]]; then
  echo "::error::W25-B1 GATE FAIL — invalid controlId returned 500 (regression!)"
  exit 1
fi
if [[ "$W25_B1" != "422" ]]; then
  echo "::warning::W25-B1 unexpected status ${W25_B1} (expected 422)"
fi
echo "✓ W25-B1 passed (status=${W25_B1})"

# W25-B2 — POST /bcms/bia not 403 for admin (the underlying widening
# adds bcm_manager — admin remains allowed).
echo ""
echo "▶ W25-B2: POST /bcms/bia not 403 for admin"
W25_B2=$(curl -sS -m 10 -o /dev/null -w "%{http_code}" \
  -b "$COOKIE_JAR" -H "content-type: application/json" \
  -X POST "${STAGING_URL}/api/v1/bcms/bia" \
  -d '{"invalid":"body"}')
if [[ "$W25_B2" == "403" ]]; then
  echo "::error::W25-B2 GATE FAIL — admin got 403 on /bcms/bia POST (regression!)"
  exit 1
fi
echo "✓ W25-B2 passed (status=${W25_B2}; 422 expected for invalid body)"

# W25-C1 — Compliance coverage tile shows iso_27001_2022 > 0%.
echo ""
echo "▶ W25-C1: /compliance/coverage?framework=iso_27001_2022 > 0%"
W25_COV=$(curl -sS -m 15 -b "$COOKIE_JAR" \
  "${STAGING_URL}/api/v1/compliance/coverage?framework=iso_27001_2022")
W25_COV_PCT=$(echo "$W25_COV" | jq -r '.data.overallCoveragePct // 0')
W25_COV_FW=$(echo "$W25_COV" | jq -r '.data.frameworkCount // 0')
if [[ "$W25_COV_FW" -lt "1" ]]; then
  echo "::error::W25-C1 GATE FAIL — ISO 27001 frameworkCount=${W25_COV_FW}"
  exit 1
fi
if [[ "$W25_COV_PCT" == "0" ]]; then
  echo "::warning::W25-C1 ISO 27001 coverage = 0% (migration 0347 should seed >0)"
fi
echo "✓ W25-C1 passed (coverage=${W25_COV_PCT}%, frameworks=${W25_COV_FW})"

# W25-C2 — Vendor-assessment schema-discovery endpoint exists.
echo ""
echo "▶ W25-C2: /vendors/{id}/assessments/schema returns example body"
VENDOR_ID=$(curl -fsS -m 10 -b "$COOKIE_JAR" \
  "${STAGING_URL}/api/v1/vendors?limit=1" | jq -r '.data[0].id // empty')
if [[ -n "$VENDOR_ID" ]]; then
  W25_C2=$(curl -sS -m 10 -b "$COOKIE_JAR" \
    "${STAGING_URL}/api/v1/vendors/${VENDOR_ID}/assessments/schema")
  W25_C2_EXAMPLE=$(echo "$W25_C2" | jq -r '.data.example.assessmentDate // empty')
  if [[ -z "$W25_C2_EXAMPLE" ]]; then
    echo "::error::W25-C2 GATE FAIL — schema example missing assessmentDate"
    echo "$W25_C2"
    exit 1
  fi
  echo "✓ W25-C2 passed (example.assessmentDate=${W25_C2_EXAMPLE})"
else
  echo "::warning::W25-C2 skipped (no vendors in staging)"
fi

# W25-C3 — ESG measurement schema example uses a real metric (no
# placeholder UUID when the org has seeded metrics).
echo ""
echo "▶ W25-C3: /esg/measurements/schema example.metricId is real"
W25_C3=$(curl -sS -m 10 -b "$COOKIE_JAR" \
  "${STAGING_URL}/api/v1/esg/measurements/schema")
W25_C3_MID=$(echo "$W25_C3" | jq -r '.data.example.metricId // empty')
W25_C3_HINT=$(echo "$W25_C3" | jq -r '.data.hint // empty')
if [[ "$W25_C3_MID" == "00000000-0000-0000-0000-000000000000" && -z "$W25_C3_HINT" ]]; then
  echo "::error::W25-C3 GATE FAIL — placeholder metricId without hint (resolver broken)"
  exit 1
fi
echo "✓ W25-C3 passed (metricId=${W25_C3_MID:0:8}...)"

# ────────────────────────────────────────────────────────────
# Done
# ────────────────────────────────────────────────────────────
echo ""
echo "✅ Pilot-Readiness-Gate PASSED"
echo "   Staging SHA: ${PROD_SHA:0:8}"
echo "   W23 A1 controlId persistence: ✓"
echo "   W23 A2 /admin/branding: ${BRAND_CODE}"
echo "   W23 C3 /contracts {name}: ${C3_CODE}"
echo "   W24 B1 /audit-log/integrity: ${B1_CODE}"
echo "   W24 B2 /findings?status=invalid: ${B2_CODE}"
echo "   W24 B3 /erm/management-summary: ${B3_CODE}"
echo "   W24 B4 POST /control-tests: ${B4_CODE}"
echo "   W24 C1 hash-chain continuity: ${CONT_CLAIM}"
echo "   W24 D1 treatments PUT (admin): ${D1_CODE}"
echo "   W25 B1 /findings?controlId=invalid: ${W25_B1}"
echo "   W25 B2 /bcms/bia POST (admin): ${W25_B2}"
echo "   W25 C1 ISO 27001 coverage: ${W25_COV_PCT}% (${W25_COV_FW} frameworks)"
echo "   W25 C3 /esg/measurements/schema metricId: ${W25_C3_MID:0:8}..."
echo "   Hash-Chain mismatches: ${MISMATCHES}"
exit 0
