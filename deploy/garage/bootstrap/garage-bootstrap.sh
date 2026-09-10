#!/bin/sh
# ARCTOS — Garage bootstrap (idempotent). Replaces the former minio-init.
#
# [ARCTOS-FULL-2026-08-31 / WP7 · S06-09, S06-10]
#
# S06-09: the MinIO sidecar with unpatchable CRITICAL CVEs was removed from
#         docker-compose.production.yml. Garage needs a layout assignment
#         before its S3 API answers, which `mc mb` never had to do — hence
#         this script rather than a one-line entrypoint.
#
# S06-10: the installation has ONE bucket and ONE key pair for every tenant;
#         the only boundary is the "{orgId}/" key prefix the application
#         builds. Garage can bind a key to a bucket, but it cannot scope a
#         key to a PREFIX — so a per-tenant boundary inside the object store
#         requires a bucket per organisation, which the application's single
#         S3_BUCKET configuration does not support today.
#
#         What this script therefore does:
#           * creates the shared bucket and its key, and grants that key
#             read/write on exactly that bucket (not on the whole cluster);
#           * denies the key any other bucket;
#           * prints the per-org bucket procedure for operators who need a
#             hard boundary now (see PER-ORG BUCKETS below).
#         The enforced boundary in this release is
#         `assertKeyBelongsToOrg` in packages/shared/src/lib/file-storage.ts,
#         which every DMS handler goes through. The remaining gap is
#         recorded in /work/audit/remediation/WP7.md, section "Restrisiko".
#
# Env: S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY,
#      GARAGE_ZONE (default dc1), GARAGE_CAPACITY (default 100G)

set -eu

BUCKET="${S3_BUCKET:-arctos-dms}"
ZONE="${GARAGE_ZONE:-dc1}"
CAPACITY="${GARAGE_CAPACITY:-100G}"
KEY_NAME="arctos-dms-app"

garage() { /garage "$@"; }

echo "garage-init: waiting for the node to answer"
i=0
while ! garage status >/dev/null 2>&1; do
  i=$((i + 1))
  [ "$i" -gt 60 ] && { echo "garage-init: node not reachable after 60s" >&2; exit 1; }
  sleep 1
done

# ── 1. Layout ────────────────────────────────────────────────────────
# A single-node cluster still needs its node assigned to the layout;
# without it every S3 request fails with "cluster not healthy".
NODE_ID="$(garage status | awk '/^==== HEALTHY NODES/{f=1;next} f && NF>1 && $1 !~ /^ID/ {print $1; exit}')"
if [ -z "${NODE_ID:-}" ]; then
  echo "garage-init: could not determine node id" >&2
  garage status >&2
  exit 1
fi

if garage layout show 2>/dev/null | grep -q "$NODE_ID"; then
  echo "garage-init: layout already assigned"
else
  echo "garage-init: assigning node $NODE_ID (zone=$ZONE capacity=$CAPACITY)"
  garage layout assign -z "$ZONE" -c "$CAPACITY" "$NODE_ID"
  VERSION="$(garage layout show | awk '/Current cluster layout version/{print $NF}')"
  garage layout apply --version "$((${VERSION:-0} + 1))"
fi

# ── 2. Bucket ────────────────────────────────────────────────────────
if garage bucket list | grep -qw "$BUCKET"; then
  echo "garage-init: bucket $BUCKET exists"
else
  echo "garage-init: creating bucket $BUCKET"
  garage bucket create "$BUCKET"
fi

# ── 3. Key, bound to exactly this bucket ─────────────────────────────
if [ -n "${S3_ACCESS_KEY_ID:-}" ] && [ -n "${S3_SECRET_ACCESS_KEY:-}" ]; then
  if garage key list | grep -qw "$S3_ACCESS_KEY_ID"; then
    echo "garage-init: key $S3_ACCESS_KEY_ID exists"
  else
    echo "garage-init: importing key $KEY_NAME"
    garage key import --yes \
      -n "$KEY_NAME" "$S3_ACCESS_KEY_ID" "$S3_SECRET_ACCESS_KEY"
  fi
  # Least privilege: read+write on this bucket only, never --owner.
  garage bucket allow --read --write "$BUCKET" --key "$S3_ACCESS_KEY_ID"
  echo "garage-init: key scoped to bucket $BUCKET (read+write, no owner)"
else
  echo "garage-init: S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY unset — skipping key setup" >&2
fi

# ── PER-ORG BUCKETS (S06-10, operator procedure) ─────────────────────
# Garage keys are scoped per BUCKET, not per prefix. A hard object-store
# boundary between tenants therefore looks like this, per organisation:
#
#   garage bucket create arctos-dms-<orgId>
#   garage key create -n arctos-dms-<orgId>
#   garage bucket allow --read --write arctos-dms-<orgId> --key <keyId>
#
# The application currently reads ONE S3_BUCKET / S3_ACCESS_KEY_ID pair
# from the environment, so using these buckets requires a per-org storage
# resolver in getFileStorage(). That is an architectural change beyond
# this remediation package and is filed as a follow-up in WP7.md.

echo "garage-init: done"
