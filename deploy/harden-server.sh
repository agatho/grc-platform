#!/bin/bash
# ============================================================================
# ARCTOS Server Hardening — Hetzner CX42
# Ausfuehren als root BEVOR das App-Deployment laeuft
#
# Was dieses Script macht:
# 1. Systembenutzer 'arctos' erstellen (kein root fuer die App)
# 2. SSH haerten (kein root-Login, kein Passwort-Login, nur Keys)
# 3. Firewall (UFW) — nur 22, 80, 443
# 4. fail2ban gegen Brute-Force
# 5. Automatische Sicherheitsupdates
# 6. Kernel-Hardening (sysctl)
# 7. Docker rootless-Modus vorbereiten
# ============================================================================

set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "FEHLER: Dieses Script muss als root ausgefuehrt werden"
  exit 1
fi

echo "============================================="
echo "  ARCTOS Server Hardening"
echo "  $(date -u +"%Y-%m-%d %H:%M UTC")"
echo "============================================="
echo ""

# ── 1. System-Updates ──────────────────────────────────────
echo "[1/9] System-Updates..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
apt-get dist-upgrade -y -qq

# ── 2. Systembenutzer 'arctos' ─────────────────────────────
echo "[2/9] Benutzer 'arctos' erstellen..."
if ! id arctos &>/dev/null; then
  adduser --disabled-password --gecos "ARCTOS Service Account" arctos
  usermod -aG sudo arctos
  usermod -aG docker arctos 2>/dev/null || true

  # SSH Key vom root uebernehmen
  mkdir -p /home/arctos/.ssh
  if [ -f /root/.ssh/authorized_keys ]; then
    cp /root/.ssh/authorized_keys /home/arctos/.ssh/authorized_keys
  fi
  chown -R arctos:arctos /home/arctos/.ssh
  chmod 700 /home/arctos/.ssh
  chmod 600 /home/arctos/.ssh/authorized_keys 2>/dev/null || true

  echo "  Benutzer 'arctos' erstellt"
  echo ""
  echo "  WICHTIG: Bevor SSH gehaertet wird, stelle sicher dass"
  echo "  du einen SSH-Key hinterlegt hast!"
  echo ""
  echo "  Von deinem lokalen Rechner:"
  echo "    ssh-copy-id arctos@$(hostname -I | awk '{print $1}')"
  echo ""
else
  echo "  Benutzer 'arctos' existiert bereits"
fi

# ── 3. SSH haerten ─────────────────────────────────────────
echo "[3/9] SSH haerten..."
SSHD_CONFIG="/etc/ssh/sshd_config"

# Backup
cp "$SSHD_CONFIG" "${SSHD_CONFIG}.backup.$(date +%s)"

# SSH-Port aendern (optional, reduziert Noise in Logs)
# sed -i 's/^#\?Port .*/Port 2222/' "$SSHD_CONFIG"

# Root-Login deaktivieren (erst nachdem arctos-User SSH-Key hat!)
# ACHTUNG: Wird erst beim zweiten Lauf aktiviert (nach Key-Setup)
if [ -f /home/arctos/.ssh/authorized_keys ] && [ -s /home/arctos/.ssh/authorized_keys ]; then
  sed -i 's/^#\?PermitRootLogin .*/PermitRootLogin no/' "$SSHD_CONFIG"
  echo "  Root-Login deaktiviert (SSH-Key fuer arctos vorhanden)"
else
  sed -i 's/^#\?PermitRootLogin .*/PermitRootLogin prohibit-password/' "$SSHD_CONFIG"
  echo "  Root-Login nur per SSH-Key (Passwort deaktiviert)"
  echo "  WARNUNG: Hinterlege SSH-Key fuer 'arctos' und fuehre Script erneut aus!"
fi

# Passwort-Login deaktivieren
sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/' "$SSHD_CONFIG"
sed -i 's/^#\?ChallengeResponseAuthentication .*/ChallengeResponseAuthentication no/' "$SSHD_CONFIG"
sed -i 's/^#\?UsePAM .*/UsePAM no/' "$SSHD_CONFIG"

# Weitere Haertung
cat >> "$SSHD_CONFIG" << 'SSHEOF'

# ARCTOS Hardening
MaxAuthTries 3
LoginGraceTime 30
ClientAliveInterval 300
ClientAliveCountMax 2
AllowUsers arctos
X11Forwarding no
AllowTcpForwarding no
SSHEOF

# Duplikate entfernen
awk '!seen[$0]++' "$SSHD_CONFIG" > "${SSHD_CONFIG}.tmp" && mv "${SSHD_CONFIG}.tmp" "$SSHD_CONFIG"

systemctl restart ssh 2>/dev/null || systemctl restart sshd
echo "  SSH gehaertet"

# ── 4. Firewall (UFW) ─────────────────────────────────────
echo "[4/9] Firewall konfigurieren..."
apt-get install -y -qq ufw

ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP (Caddy redirect)'
ufw allow 443/tcp comment 'HTTPS (Caddy)'

# Rate-Limiting auf SSH
ufw limit 22/tcp

echo "y" | ufw enable
echo "  UFW aktiv: nur 22 (SSH), 80 (HTTP), 443 (HTTPS)"

# ── 5. fail2ban ────────────────────────────────────────────
echo "[5/9] fail2ban installieren..."
apt-get install -y -qq fail2ban

cat > /etc/fail2ban/jail.local << 'F2BEOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3
backend = systemd

[sshd]
enabled = true
port = 22
maxretry = 3
bantime = 7200

[caddy-auth]
enabled = true
port = 80,443
filter = caddy-auth
logpath = /var/log/caddy/arctos.log
maxretry = 10
findtime = 300
bantime = 3600

[caddy-login]
enabled = true
port = 80,443
filter = caddy-login
logpath = /var/log/caddy/arctos.log
maxretry = 5
findtime = 120
bantime = 1800
F2BEOF

# Caddy Auth-Failure Filter (API 401/403)
mkdir -p /etc/fail2ban/filter.d
cat > /etc/fail2ban/filter.d/caddy-auth.conf << 'FILTEREOF'
[Definition]
failregex = ^.*"remote_ip":"<HOST>".*"status":(401|403).*$
ignoreregex =
FILTEREOF

# Caddy Login Brute-Force Filter (POST to auth callback)
cat > /etc/fail2ban/filter.d/caddy-login.conf << 'FILTEREOF'
[Definition]
failregex = ^.*"remote_ip":"<HOST>".*"uri":"/api/auth/callback/credentials".*"method":"POST".*$
ignoreregex =
FILTEREOF

systemctl enable fail2ban
systemctl restart fail2ban
echo "  fail2ban aktiv: SSH (3 Versuche/7200s Ban) + Caddy Auth"

# ── 6. Automatische Sicherheitsupdates ─────────────────────
echo "[6/9] Automatische Sicherheitsupdates..."
apt-get install -y -qq unattended-upgrades

cat > /etc/apt/apt.conf.d/20auto-upgrades << 'AUTOEOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
AUTOEOF

cat > /etc/apt/apt.conf.d/50unattended-upgrades << 'UUEOF'
Unattended-Upgrade::Allowed-Origins {
  "${distro_id}:${distro_codename}-security";
  "${distro_id}ESMApps:${distro_codename}-apps-security";
};
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
UUEOF

echo "  Automatische Sicherheitsupdates aktiviert"

# ── 7. Kernel-Hardening (sysctl) ──────────────────────────
echo "[7/9] Kernel haerten..."
cat > /etc/sysctl.d/99-arctos-hardening.conf << 'SYSEOF'
# IP Spoofing Protection
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1

# Ignore ICMP Redirects
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0

# Ignore Send Redirects
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0

# SYN Flood Protection
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_max_syn_backlog = 2048

# Log Martians
net.ipv4.conf.all.log_martians = 1

# Disable Source Routing
net.ipv4.conf.all.accept_source_route = 0
net.ipv6.conf.all.accept_source_route = 0

# Disable ICMP Broadcast
net.ipv4.icmp_echo_ignore_broadcasts = 1

# Memory Protection
kernel.randomize_va_space = 2

# Restrict dmesg
kernel.dmesg_restrict = 1

# Restrict kernel pointer exposure
kernel.kptr_restrict = 2
SYSEOF

sysctl --system > /dev/null 2>&1
echo "  Kernel-Parameter gehaertet"

# ── 8. Docker installieren + haerten ─────────────────────
echo "[8/9] Docker installieren und haerten..."
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
fi

# Docker-Gruppe fuer arctos
usermod -aG docker arctos

# Gehaertete Daemon-Config
mkdir -p /etc/docker
cat > /etc/docker/daemon.json << 'DOCKEREOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "no-new-privileges": true,
  "icc": false,
  "live-restore": true,
  "userland-proxy": false
}
DOCKEREOF

systemctl restart docker
echo "  Docker installiert + gehaertet: no-new-privileges, ICC disabled, Log-Rotation"

# ── 9. App-Verzeichnis vorbereiten ────────────────────────
echo "[9/9] App-Verzeichnis vorbereiten..."
mkdir -p /opt/arctos
chown arctos:arctos /opt/arctos
echo "  /opt/arctos gehoert jetzt dem arctos-Benutzer"

echo ""
echo "============================================="
echo "  Server-Hardening abgeschlossen"
echo "============================================="
echo ""
echo "  Zusammenfassung:"
echo "  - Benutzer 'arctos' erstellt (sudo + docker)"
echo "  - SSH: nur Key-Auth, kein Passwort, MaxAuthTries 3"
echo "  - Firewall: nur 22/80/443, Rate-Limiting auf SSH"
echo "  - fail2ban: SSH + Caddy Auth-Failures"
echo "  - Auto-Updates: Sicherheitspatches automatisch"
echo "  - Kernel: SYN-Flood-Schutz, Anti-Spoofing, ASLR"
echo "  - Docker: no-new-privileges, ICC disabled"
echo ""
echo "  NAECHSTE SCHRITTE:"
echo "  1. SSH-Key hinterlegen (von deinem Rechner):"
echo "     ssh-copy-id arctos@178.104.186.121"
echo ""
echo "  2. Testen ob arctos-Login funktioniert:"
echo "     ssh arctos@178.104.186.121"
echo ""
echo "  3. App deployen (als arctos, NICHT als root):"
echo "     ssh arctos@178.104.186.121"
echo "     cd /opt/arctos"
echo "     git clone https://github.com/agatho/grc-platform.git ."
echo "     sudo bash deploy/setup-hetzner.sh"
echo ""
