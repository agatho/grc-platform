# MinIO → Garage Migration (Runbook)

**Warum:** MinIO Community Edition wurde im Februar 2026 archiviert — keine
Security-Patches mehr. Der Trivy-Scan fand in der `minio`-Binary 4 CRITICAL +
42 HIGH (u. a. unauthentifizierter Object-Write, OIDC-JWT-Confusion). Garage
(Rust, aktiv gepflegt, S3-kompatibel) ersetzt es.

**Risiko-Design:** Garage läuft zunächst **parallel** zu MinIO. Erst nach
verifizierter Umstellung (Upload/Download über Garage funktioniert) wird MinIO
abgebaut. Kein Datenverlust-Fenster.

**Kompatibilität:** Die App spricht reines S3 (SigV4, path-style, nur
PUT/GET/DELETE/HEAD — kein Multipart, keine Presigned-URLs). Garage deckt das
vollständig ab. Einzige Bedingung: Garages `s3_region` == `S3_REGION` der App
(beide `us-east-1`, in `deploy/garage/garage.toml` gesetzt).

Alle Befehle laufen auf dem Server in `/opt/arctos`.

---

## 0. Voraussetzung: Code ausrollen

```bash
cd /opt/arctos
git pull        # bringt deploy/garage/garage.toml + garage-Service ins Compose
```

## 1. Secrets erzeugen und in .env eintragen

```bash
echo "GARAGE_RPC_SECRET=$(openssl rand -hex 32)"   >> .env
echo "GARAGE_ADMIN_TOKEN=$(openssl rand -hex 32)"  >> .env
```

(Falls `update-all.sh` künftig die Garage-Secrets auto-generieren soll: dort
analog zu `MINIO_ROOT_PASSWORD` ergänzen. Für jetzt reicht der obige Einmal-Schritt.)

## 2. Garage starten (parallel zu MinIO)

```bash
docker pull dxflrs/garage:v2.3.0
docker compose -f docker-compose.production.yml up -d garage
docker compose -f docker-compose.production.yml exec -T garage /garage status
```

`status` muss den Node zeigen (zunächst ohne Rolle — das ist vor dem Layout normal).

## 3. Einmaliges Bootstrap (Layout → Bucket → Key)

> Layout-Zuweisung ist eine **einmalige** Cluster-Operation, kein Deploy-Schritt.

```bash
CF=docker-compose.production.yml
G="docker compose -f $CF exec -T garage /garage"

# Node-ID holen und dem Single-Node eine Zone + Kapazität zuweisen
NODE=$($G node id -q | cut -d@ -f1)
$G layout assign -z dc1 -c 10G "$NODE"
$G layout apply --version 1

# Bucket + App-Key anlegen und Rechte vergeben
$G bucket create arctos-dms
$G key create arctos-app
$G bucket allow --read --write arctos-dms --key arctos-app

# Key-ID + Secret AUSLESEN (einmalig sichtbar) — gleich in .env eintragen
$G key info arctos-app --show-secret
```

Die Ausgabe des letzten Befehls liefert `Key ID` und `Secret key`.

## 4. Daten von MinIO nach Garage spiegeln

Netzwerknamen ermitteln (Compose-Projekt-Präfix):

```bash
NET=$(docker network ls --format '{{.Name}}' | grep -m1 arctos)
```

Spiegeln (Quelle = MinIO, Ziel = Garage). `GKEY`/`GSECRET` = die eben
ausgelesenen Garage-Werte, `S3_BUCKET` i. d. R. `arctos-dms`:

```bash
source .env   # zieht MINIO_ROOT_USER / MINIO_ROOT_PASSWORD / S3_BUCKET
docker run --rm --network "$NET" minio/mc:RELEASE.2025-08-13T08-35-41Z sh -c "
  mc alias set src http://minio:9000 '$MINIO_ROOT_USER' '$MINIO_ROOT_PASSWORD' &&
  mc alias set dst http://garage:3900 'GKEY' 'GSECRET' --api S3v4 &&
  mc mirror --overwrite src/${S3_BUCKET:-arctos-dms} dst/${S3_BUCKET:-arctos-dms}
"
```

Kontrolle:

```bash
docker compose -f $CF exec -T garage /garage bucket info arctos-dms   # Objekte/Größe > 0?
```

## 5. App auf Garage umstellen

In `/opt/arctos/.env` diese Werte setzen/ändern (Rest bleibt):

```
STORAGE_BACKEND=s3
S3_ENDPOINT=http://garage:3900        # war http://minio:9000
S3_REGION=us-east-1
S3_BUCKET=arctos-dms
S3_ACCESS_KEY_ID=<Garage Key ID aus Schritt 3>
S3_SECRET_ACCESS_KEY=<Garage Secret aus Schritt 3>
S3_FORCE_PATH_STYLE=1
```

Neu starten, damit web+worker die neue Env ziehen:

```bash
docker compose -f docker-compose.production.yml up -d web worker
```

## 6. Verifizieren (VOR dem MinIO-Abbau!)

- In der App ein Dokument **hochladen** und wieder **herunterladen** (inkl.
  kontrollierte Kopie / Wasserzeichen — das ist der Download-durch-die-App-Pfad).
- Ein bestehendes, migriertes Dokument öffnen → muss laden.
- Gegencheck direkt an Garage:

```bash
docker compose -f docker-compose.production.yml exec -T garage /garage bucket info arctos-dms
```

Objektzahl sollte nach einem neuen Upload steigen.

## 7. MinIO abbauen (erst nach erfolgreicher Verifikation)

1. Im `docker-compose.production.yml` die Services `minio` und `minio-init`
   sowie das Volume `miniodata` entfernen (commit + push).
2. ```bash
   cd /opt/arctos && git pull
   docker compose -f docker-compose.production.yml up -d --remove-orphans
   docker volume rm arctos_miniodata      # ERST wenn Daten sicher in Garage sind
   ```
3. Alte MinIO-Images entfernen: `docker image prune -a` (optional).

## Rollback

Solange Schritt 7 nicht ausgeführt ist, ist MinIO unverändert vorhanden:
In `.env` `S3_ENDPOINT` zurück auf `http://minio:9000` + die alten
`S3_ACCESS_KEY_ID/SECRET` (= MINIO_ROOT_USER/PASSWORD), dann
`docker compose up -d web worker`. Fertig.

---

## Trivy-Nachkontrolle (optional)

Nach der Umstellung den Scan gegen das Garage-Image laufen lassen — sollte
deutlich sauberer sein als MinIO:

```bash
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy:latest image --scanners vuln --severity HIGH,CRITICAL \
  --no-progress --quiet dxflrs/garage:v2.3.0
```
