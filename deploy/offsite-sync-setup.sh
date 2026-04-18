#!/bin/bash
# ============================================================================
# Interactive setup helper for rclone -> Backblaze B2 off-site backup.
# See ADR-015 for rationale.
#
# Run once on the Hetzner host as root:
#   sudo bash deploy/offsite-sync-setup.sh
# ============================================================================

set -euo pipefail

echo "============================================="
echo "  ARCTOS — Off-Site Backup Setup (rclone/B2)"
echo "  ADR-015 Reference"
echo "============================================="
echo ""

if ! command -v rclone >/dev/null 2>&1; then
  echo "rclone not installed. Run:  apt install -y rclone"
  exit 1
fi

read -p "Backblaze B2 Application-Key-ID: " B2_ID
read -sp "Backblaze B2 Application-Key (secret): " B2_KEY
echo ""
read -p "Bucket-Name (should already exist in B2 eu-central-003): " B2_BUCKET
echo ""

RCLONE_CONF="$HOME/.config/rclone/rclone.conf"
mkdir -p "$(dirname "$RCLONE_CONF")"
touch "$RCLONE_CONF"
chmod 600 "$RCLONE_CONF"

cat >> "$RCLONE_CONF" <<EOF

[b2-arctos]
type = b2
account = $B2_ID
key = $B2_KEY
hard_delete = false
endpoint = https://s3.eu-central-003.backblazeb2.com
EOF

echo ""
echo "rclone remote 'b2-arctos' added to $RCLONE_CONF"
echo ""

# Test connectivity
echo "Testing connection..."
if rclone lsd "b2-arctos:$B2_BUCKET" --max-depth 1 >/dev/null 2>&1; then
  echo "  ✓ Connection OK"
else
  echo "  ✗ Connection failed. Check key capabilities (need listBuckets + writeFiles)."
  exit 1
fi

echo ""
echo "Set B2_REMOTE env for offsite-sync.sh:"
echo "  export B2_REMOTE=\"b2-arctos:$B2_BUCKET\""
echo ""
echo "Add to /etc/crontab (as root):"
echo "  0 2  * * * root /opt/arctos/deploy/db-backup.sh >> /var/log/arctos-backup.log 2>&1"
echo "  30 2 * * * root B2_REMOTE=b2-arctos:$B2_BUCKET /opt/arctos/deploy/offsite-sync.sh"
echo ""
echo "Done."
