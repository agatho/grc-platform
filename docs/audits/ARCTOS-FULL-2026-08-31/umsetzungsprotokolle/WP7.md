# WP7 — DMS, Signaturen, Objektspeicher

**Audit-ID:** ARCTOS-FULL-2026-08-31 · **Paket:** WP7 (Welle 3) · **Branch:** `audit/full-2026-08-31`
**Umfang:** 25 Findings `S06-01` … `S06-25` (2 High, 12 Medium, 8 Low, 3 Info)
**Grundlage:** `findings/S06-dms-signaturen-storage.md`, Evidenz unter `evidence/S06/`
**Migrationsbereich:** 0420–0424 (alle fünf belegt)

---

## 0. Leitgedanke des Pakets

Der Bericht fasst den Befund in einem Satz zusammen: **jede Integritätszusage des
Moduls ist stärker als die Prüfung dahinter.** Das ist kein Sammelurteil, sondern
ein Muster mit immer derselben Form — eine Aussage über die Datei, die aus einer
Datenbankspalte stammt; ein „revisionssicheres" Protokoll, das die genannten
Felder nicht abdeckt; ein Wasserzeichen, das bei nutzergewähltem Input ausfällt;
eine Verschlüsselungszusage ohne Verschlüsselung.

Dieses Paket löst jede dieser Stellen in genau eine der beiden zulässigen
Richtungen auf:

- **Prüfung auf das Niveau der Zusage heben** — überall dort, wo der Baustein
  vorhanden oder herstellbar war: Datei-Hash aus dem Objektspeicher statt aus der
  DB-Spalte (S06-04), RFC-3161-Zeitstempel über die vorhandene FreeTSA-Anbindung
  (S06-05), Beweisfelder in den Hash-Umfang (S06-03), Kettenlänge und Kettenkopf
  gegen einen festgehaltenen Sollzustand (S06-15), Wasserzeichen fail-closed
  (S06-06), Statusprüfung und Versionierung im Upload (S06-01).
- **Zusage zurücknehmen** — nur dort, wo die Prüfung nicht herstellbar ist, ohne
  das Produkt umzubauen. Das betrifft **zwei** Stellen: die „Digitale Signatur"
  im Policy-Modul (S06-02) und die AES-256-at-rest-Aussage im Trust-Portal
  (S06-11). Beide sind unten ausdrücklich begründet.

**Positivbefund, unverändert gelassen:** die Signaturklasse selbst. Code, Doku,
i18n und Zertifikat sagen übereinstimmend „einfache elektronische Signatur, kein
QES", und genau das ist implementiert. Hier wurde **nichts** an der Aussage
geändert — nur die falsche Fundstellenangabe korrigiert (S06-20).

**Eine Korrektur an der Fix-Richtung des Berichts.** S06-06 empfiehlt
`PDFDocument.load(bytes, { ignoreEncryption: true })`. Gegen die beiliegende
PoC-Datei nachgemessen: das hilft **nicht**.

```
$ node -e '… PDFDocument.load(poc, { ignoreEncryption: true }) …'
load plain THROWS: Input document to `PDFDocument.load` is encrypted.
ignoreEncryption path THROWS: Expected instance of PDFDict, but got instance of undefined
```

`ignoreEncryption` überspringt nur die Prüfung, entschlüsselt aber die
Objekt-Streams nicht; einen reinen JS-Entschlüsseler gibt es im Workspace nicht.
„Trotzdem stempeln" ist also gar nicht erreichbar. Der Fix ist deshalb
konsequent fail-closed statt fail-open — Details bei S06-06.

---

## 1. Findings — Änderung, Nachweis, Status

### S06-01 · High · Freigegebene Dokumentversion wird beim Upload in-place überschrieben

**Status: geschlossen**

**Änderung**

1. `apps/web/src/app/api/v1/documents/[id]/upload/route.ts`
   - **Statusgatter.** Uploads werden nur noch angenommen, solange das Dokument
     inhaltlich veränderbar ist (`draft`, `in_review` — `CONTENT_MUTABLE_STATUSES`
     in `lib/documents/download-policy.ts`). `approved`, `published`, `archived`,
     `expired` → **409** `document_released` mit dem Hinweis auf den
     Lebenszyklusweg. Der Freigabepfad (`[id]/status/route.ts`) wendet
     `checkFourEyes` auf dem Rückweg wieder an.
   - **Legal Hold** blockiert jetzt auch den Upload → 409 `legal_hold`
     (bisher nur die DSGVO-Löschung).
   - **Kein In-place-Überschreiben mehr.** Ein Versions-Snapshot, der bereits
     eine Datei trägt, wird nie umgeschrieben. Trägt die aktuelle Version noch
     keine (`file_path IS NULL`), wird sie befüllt — das vervollständigt einen
     Entwurf und überschreibt keine Historie. Trägt sie bereits eine, entsteht
     über `createDocumentVersion` eine **neue Minor-Version**, exakt die Regel,
     die `versions/[versionId]/restore` für sich schon formuliert („History is
     never overwritten"). Die Antwort trägt `newVersionLabel`, damit der Client
     den Versionssprung sieht.
   - **Ein Transaktions- und Audit-Kontext.** Die drei Schreibvorgänge liefen
     auf dem nackten `db`-Handle; `app.current_user_id` war damit nicht gesetzt
     und der DB-Trigger schrieb den Akteur als NULL (reproduziert in
     `evidence/S06/audit_actor_null_repro.txt`). Alle Schreibvorgänge laufen
     jetzt in **einem** `withAuditContext` mit
     `actionDetail: file_uploaded:<name>`.
2. `packages/db/drizzle/0422_document_version_file_immutable.sql` — zweite Linie
   auf DB-Ebene, wirksam für **jeden** Schreibpfad, auch künftige. Ein
   `document_version`-UPDATE, das `file_path` oder `file_sha256` von einem Wert
   auf einen **anderen** Wert setzt, wird abgewiesen. Erlaubt bleiben
   `NULL → Wert` (Befüllen) und `Wert → NULL` (Dateilöschung, S06-19).
   `ENABLE ALWAYS`, greift also auch unter `session_replication_role='replica'`.

**Nachweis**

- `apps/web/src/__tests__/api/documents-upload-immutability.test.ts` (11 Tests, grün):
  Upload gegen `approved`/`published`/`archived`/`expired` → 409, **kein**
  Storage-Write, **keine** DB-Änderung; Legal Hold → 409; leerer Snapshot wird
  befüllt; belegter Snapshot erzeugt eine neue Version und lässt die alte
  Zeile unangetastet; genau **ein** `withAuditContext`-Aufruf mit
  `actionDetail`, der `document_file`, `document` und `document_version` umfasst.
- DB-Guard live gegen `wp7_verify` (Protokoll unten, T1–T3):

  ```
  --- T1: replacing a version file in place MUST fail (S06-01) ---
  ERROR:  document_version 4444…: der Dateisnapshot einer bestehenden Version
          darf nicht ersetzt werden — neue Version anlegen (S06-01)
  --- T2: filling an EMPTY snapshot MUST succeed ---   UPDATE 1
  --- T3: clearing a snapshot (file deleted) MUST succeed (S06-19) --- UPDATE 1
  ```

  Der Lauf stand unter `SET session_replication_role = 'replica'` — der Guard
  greift also auch dort.

---

### S06-06 · High · Controlled-Copy-Wasserzeichen durch nicht ladbare PDF umgehbar

**Status: geschlossen**

**Vorbemerkung zur Fix-Richtung.** Siehe Abschnitt 0: `ignoreEncryption: true`
löst den PoC-Fall nachweislich nicht. Es bleiben zwei ehrliche Optionen —
verweigern oder markiert ausliefern. Das Paket wählt **verweigern**, weil eine
„markierte" Auslieferung ohne Marke im Dokument selbst genau die Zusage wäre,
die der Bericht als zu stark beanstandet: der Header `X-Controlled-Copy: error`
wurde von **keinem** Client ausgewertet (`grep` über `apps/web/src`: 0 Treffer),
war also für Nutzer und Betreiber unsichtbar.

**Änderung**

1. `apps/web/src/lib/documents/pdf-watermark.ts`
   - `WatermarkError` mit maschinenlesbarem `reason`:
     `encrypted` | `unloadable` | `too_large` | `stamp_failed`.
     `pdfDeclaresEncryption()` erkennt den `/Encrypt`-Fall auch dann, wenn
     pdf-lib nur eine generische Parser-Meldung liefert.
   - **`checkPdfStampable()`** — Vorabprüfung für den Upload.
2. `apps/web/src/app/api/v1/documents/[id]/upload/route.ts`: eine PDF, die nie
   als kontrollierte Kopie herausgegeben werden könnte, wird **beim Upload**
   abgelehnt (422 `pdf_not_stampable`) plus Audit-Eintrag
   `upload_rejected_unstampable_pdf`. Das ist der einzige Moment, in dem der
   Hochladende das unverschlüsselte Original noch hat.
3. Beide Download-Routen (`[id]/download`, `[id]/files/[fileId]/download`):
   der `catch`-Zweig liefert **nicht mehr** die Originalbytes aus, sondern
   antwortet **422** `watermark_required` mit `reason`, Header
   `X-Controlled-Copy: refused` — und schreibt **immer** einen Audit-Eintrag
   (`controlled_copy_watermark_failed`, `served: false`). Die Fehlermeldung
   nennt den legitimen Ausweg: unverschlüsselt neu hochladen oder `?raw=1`
   durch die Dokumentenlenkung (protokolliert, S06-08).
4. Die gemeinsame Entscheidungslogik beider Routen liegt jetzt in
   `apps/web/src/lib/documents/download-policy.ts`, damit S06-06/-07/-09 nicht
   erneut in zwei Kopien driften.

**Nachweis**

- `apps/web/src/__tests__/api/documents-controlled-copy.test.ts` — Test
  „REFUSES the download when a required watermark cannot be applied (S06-06,
  PoC file)" fährt **die PoC-Datei aus `evidence/S06/`** (als Fixture unter
  `src/__tests__/fixtures/owner-password-only.pdf` mitgeliefert) gegen die
  Route: 422, `code: watermark_required`, `reason: encrypted`, und genau ein
  Audit-Aufruf mit `outcome: watermark_failed`, `served: false`.
  Der frühere Test „serves original bytes with X-Controlled-Copy: error" ist
  ersetzt — er hielt den Defekt als Sollverhalten fest.
- `apps/web/src/__tests__/lib/pdf-watermark.test.ts` klassifiziert die PoC-Datei
  als `encrypted` (nicht `unloadable`) und belegt, dass `checkPdfStampable` sie
  beim Upload ablehnt.
- `documents-upload-immutability.test.ts`: Upload der PoC-Datei → 422
  `pdf_not_stampable`, **kein** Storage-Write, Audit-Eintrag geschrieben.

---

### S06-04 · Medium · Zertifikat behauptet geprüfte Datei-Integrität, vergleicht zwei DB-Spalten

**Status: geschlossen** — _Prüfung auf Zusagenniveau gehoben._

**Änderung** (`apps/web/src/lib/documents/signature-provider.ts`)

- Neu `recomputeVersionFileSha(versionId, orgId)`: liest das Objekt der
  **signierten Version** über `getFileStorage()` und hasht es neu. Der Pfad der
  Version ist maßgeblich; nur wenn die Version keinen eigenen führt, wird auf
  `document.file_path` zurückgefallen — und das wird im Bericht ausdrücklich
  vermerkt, weil der Kopf auf eine andere Datei zeigen kann.
- `verify()` liefert statt eines Booleans einen **Dreizustand**
  `FileIntegrityState`: `verified_unchanged` | `verified_changed` |
  `unverifiable`. „Nicht prüfbar" wird nie mehr als „unverändert" gemeldet.
  Der Report führt zusätzlich `recomputedFileSha256`, `fileIntegrityNote` und
  `fileCheckedAt`.
- `sign()` prüft **vor** dem Anhängen eines Kettenglieds beide Ebenen: die
  DB-Spalte **und** die Bytes. Sind die Bytes nicht lesbar, wird die Signatur
  mit 422 abgelehnt — wer die Datei nicht prüfen kann, darf nicht bezeugen, sie
  sei unverändert.
- `.../certificate/route.ts`: die KPI heißt jetzt
  „UNVERAENDERT (Bytes geprueft)" / „VERAENDERT (Bytes geprueft)" /
  „NICHT PRUEFBAR", und die Tabelle führt Soll-Hash, DB-Hash, **neu berechneten**
  Hash und den Prüfzeitpunkt getrennt auf. Eine Fußnote sagt ausdrücklich, dass
  die Aussage aus einem erneuten Hashen der Bytes stammt und nicht aus einem
  Spaltenvergleich.
- i18n `verify.valid` (de/en) entsprechend präzisiert, plus neuer Schlüssel
  `verify.fileUnverifiable`.

**Nachweis** `document-signature-requests.test.ts`: der Signaturpfad ist an die
Bytes gekoppelt — der Frozen-Hash der Fixture ist der tatsächliche SHA-256 der
vom Storage-Mock gelieferten Bytes; ein Test belegt die Ablehnung, wenn die
Bytes nicht lesbar sind („refuses to sign when the stored bytes cannot be read").

---

### S06-02 · Medium · Ungeschlüsselter SHA-512 als „Digitale Signatur … dient als Nachweis"

**Status: geschlossen** — _Zusage zurückgenommen **und** Bindung repariert._

**Warum hier die Zusage zurückgenommen wird (Begründung nach Regel):**
Aus einem Hash ohne Schlüsselmaterial lässt sich keine Signatur machen. Die
Alternative — das Acknowledgment auf denselben verketteten Mechanismus wie
`document_signature` heben — wäre kein Bugfix, sondern ein Umbau der Fachlogik
des Policy-Moduls (Kettenkopf pro Verteilung, Nebenläufigkeitsguard,
Zertifikatsausgabe) und liegt außerhalb dieses Pakets. Die **Bezeichnung** wird
deshalb korrigiert; die **Bindung** wird dort repariert, wo sie ohne Umbau
reparierbar ist. Der Wunsch-Zustand ist als Folgepunkt in Abschnitt 3 notiert.

**Änderung**

1. `apps/web/messages/{de,en}/common.json`
   - `signatureHash`: „Digitale Signatur" → **„Bestätigungs-Prüfsumme"**
     (en: „Digital Signature" → „Acknowledgment checksum").
   - `successDesc`: „Die digitale Signatur dient als Nachweis." →
     „Ihre Bestätigung wurde gespeichert und im Audit-Trail protokolliert. Die
     Prüfsumme sichert die Unverändertheit des Eintrags."
     Der Nachweis wird damit dorthin verwiesen, wo er tatsächlich liegt: in den
     verketteten und verankerten Audit-Trail.
2. `apps/web/src/app/api/v1/policies/my-pending/[distId]/acknowledge/route.ts`
   - **Der konstante Leer-Hash ist weg.** Der bisherige Ausdruck hashte
     `COALESCE(dv.content, d.content, '')` und fiel bei einer als PDF
     verteilten Richtlinie — dem Regelfall — auf `digest('')` zurück, den
     konstanten Wert `e3b0c442…b855`. Jetzt ist **der Datei-Hash** die primäre
     Quelle (`document_version.file_sha256`, sonst `document.file_sha256`),
     der Textinhalt der Fallback.
   - `document_hash_source` (`file` | `version_content` | `document_content` |
     `none`) hält fest, **woran** gebunden wurde. „Es wurde an nichts gebunden"
     bleibt damit von „es wurde an Inhalt gebunden" unterscheidbar, statt beide
     Fälle in denselben String zu falten.
   - Die Prüfsumme (Version 2) deckt jetzt auch die nachweistragenden Felder
     ab, die bisher außerhalb lagen: `status`, `quiz_score`, `quiz_passed`,
     `read_duration_seconds`, `ip_address`, `user_agent`.
     `finalStatusForChecksum()` ist die einzige Definition des Endstatus, damit
     Prüfsumme und gespeicherte Zeile nicht auseinanderlaufen können.
3. `packages/db/drizzle/0423_policy_acknowledgment_checksum.sql`:
   `signature_hash_version`, `document_sha256`, `document_hash_source` plus
   `COMMENT ON COLUMN policy_acknowledgment.signature_hash`, der in der
   Datenbank selbst festhält, dass es sich um eine Prüfsumme und nicht um eine
   digitale Signatur handelt. Bestandszeilen bleiben Version 1 und behalten
   `document_hash_source = NULL` — „unbekannt" ist nicht dasselbe wie „nichts
   gebunden".

**Nachweis** `tsc --noEmit` grün; Migration gegen `wp7_verify` angewandt, die
drei Spalten vorhanden. Der Text-Fix ist in beiden Sprachbundles verifiziert
(JSON valide, Schlüsselnamen unverändert — die anzeigende Komponente
`my-policies/[distId]/page.tsx` liegt in fremder Hoheit und musste nicht
angefasst werden).

---

### S06-03 · Medium · Beweisfelder außerhalb des Hash-Umfangs; IP client-steuerbar

**Status: geschlossen**

**Änderung**

1. **Hash-Umfang** (`apps/web/src/lib/documents/signature-chain.ts`).
   Neue Formel `hash_version 2`: zusätzlich zu den bisherigen sechs Feldern
   gehen `ipAddress`, `userAgent`, `declineReason` und `signOrder` in den
   `content_hash` ein. `computeContentHash(payload, version)` wählt die
   Feldmenge nach Version, `buildSignatureLink` schreibt die Version mit.
   **Bestandszeilen bleiben unter Version 1 verifizierbar** — das ist die
   Freeze-Regel des Moduls: eine neue Formel bekommt eine neue Nummer, eine
   alte wird nie umdefiniert.
2. **IP-Ermittlung** (`apps/web/src/lib/documents/client-ip.ts`, neu).
   `X-Forwarded-For` wird von links nach rechts angehängt; der **erste** Eintrag
   ist per Definition der vom Client gesetzte. `resolveClientIp()` nimmt den
   Eintrag, den der äußerste **eigene** Proxy angefügt hat
   (`TRUSTED_PROXY_HOPS`, im Produktions-Compose auf 1 vorbelegt). Ist die
   Topologie nicht deklariert, wird der rechteste Eintrag genommen und als
   **nicht vertrauenswürdig** markiert.
3. **Sichtbarkeit statt stiller Annahme.** `document_signature.ip_trusted`
   (Migration 0420) speichert das Ergebnis; `verify()` gibt es aus; das
   Zertifikat schreibt hinter eine nicht gedeckte Adresse „(Selbstauskunft)"
   und setzt eine Fußnote, dass sie kein Nachweis des Signaturorts ist.
4. **i18n** `signArea.legalNotice` (de/en): der Satz nennt jetzt die Felder, die
   wirklich in die Kette eingehen, benennt den Audit-Trail als Träger der
   Revisionssicherheit und sagt beim Zeitstempel dazu, wann er extern gedeckt
   ist und wann nicht. Das Wort „revisionssicher" steht damit nicht mehr über
   einer Menge, die zur Hälfte außerhalb der Kette lag.

**Nachweis** `document-signature-chain.test.ts`, Block „hash versions (S06-03)"
(6 Tests): unter v1 lässt sich die IP **spurlos** tauschen — genau der Befund —,
unter v2 bricht jede der vier Feldänderungen den `content_hash`; eine
v1-Zeile verifiziert weiterhin. `document-signature-requests.test.ts` belegt
`ipTrusted: false` und `hashVersion: 2` auf dem geschriebenen Slot.

---

### S06-05 · Medium · Kein vertrauenswürdiger Zeitstempel, obwohl RFC 3161 im Produkt vorhanden

**Status: geschlossen**

**Änderung**

1. `apps/web/src/lib/documents/signature-timestamp.ts` (neu) ruft
   `requestTimestamp()` aus `packages/shared/src/lib/freetsa.ts` — der von WP4
   vollständig validierte Client, **unverändert genutzt, nicht angefasst**.
   Der Zeitstempel deckt den `chain_hash` des Glieds ab und wird **vor** dem
   DB-Schreibvorgang geholt, damit Token und Zeile zusammen entstehen.
2. `sign()` und `decline()` speichern `tsa_status`, `tsa_gen_time`,
   `tsa_serial`, `tsa_policy_oid` und das DER-Token in `tsa_proof`
   (Migration 0420).
3. **Best-effort, aber nie stillschweigend.** Ein TSA-Ausfall darf das
   Signieren nicht unmöglich machen; er darf aber auch nicht wie ein Erfolg
   aussehen. Der Ausgang wird pro Zeile festgehalten
   (`granted` | `unavailable` | `disabled` | `error`), von `verify()` gemeldet
   und im Zertifikat je Signatur ausgewiesen; eine Fußnote zählt die nicht
   gedeckten Zeitpunkte und sagt, dass sie aus der Serveruhr stammen.
   `SIGNATURE_TSA_ENABLED=0` ergibt `disabled` — für Air-Gap-Installationen
   ausdrücklich und unterscheidbar von einem Fehler.
4. **Zweite Verankerung, unabhängig vom Netz.** Jedes Kettenglied schreibt
   zusätzlich einen `audit_log`-Eintrag `signature_chain_anchor` mit
   `chain_hash`, `previous_chain_hash`, `content_hash`, `hash_version` und dem
   neu berechneten Datei-Hash. Damit hängt die Signaturkette an der bereits
   FreeTSA-verankerten Audit-Kette (ADR-011 rev.4) — die zweite vom Bericht
   genannte Variante, hier zusätzlich statt alternativ umgesetzt, weil sie ohne
   externe Erreichbarkeit wirkt. Geschrieben über `tx.insert(auditLog)` im
   bestehenden `withAuditContext`, also über den von WP4 gebauten
   BEFORE-INSERT-Kettenpfad.

**Nachweis** `document-signature-requests.test.ts` belegt, dass der Ausgang
gespeichert wird (`tsaStatus: "unavailable"` bei nicht erreichbarer TSA) statt
ignoriert zu werden; Migration 0420 legt Spalten und Teilindex an (verifiziert
gegen `wp7_verify`).

---

### S06-07 · Medium · Wasserzeichen greift nur bei `status='published'`

**Status: geschlossen**

**Änderung**

- `WATERMARK_REQUIRED_STATUSES` (`lib/documents/download-policy.ts`) umfasst
  `approved`, `published`, `archived`, `expired`. Nur `draft` und `in_review` —
  Zustände, die nie freigegeben wurden — werden ungestempelt ausgeliefert;
  `?watermarked=1` erzwingt den Stempel weiterhin.
- Die Fußzeile benennt den Zustand: `ARCHIVIERTE FASSUNG - NICHT GUELTIG`,
  `ABGELAUFENE FASSUNG - NICHT GUELTIG`, `FREIGEGEBEN, NOCH NICHT
VEROEFFENTLICHT`, `ENTWURF`, `IN PRUEFUNG` — vor dem unveränderten
  „Unkontrollierte Kopie nach Ausdruck". Der Bericht nennt genau diesen Punkt:
  der Hinweis fehlte dort, wo er inhaltlich am nötigsten war.

**Nachweis** `documents-controlled-copy.test.ts` (`it.each` über `archived`,
`expired`, `approved`) und `pdf-watermark.test.ts` (Fußzeilentext je Status).

---

### S06-08 · Medium · Bezug des unmarkierten Originals (`?raw=1`) nicht protokolliert

**Status: geschlossen**

**Änderung** `apps/web/src/lib/documents/controlled-copy.ts` bekommt ein
`outcome`, das den Audit-Eintrag steuert:

| outcome            | actionDetail                       |
| ------------------ | ---------------------------------- |
| `watermarked`      | `controlled_copy_download`         |
| `uncontrolled_raw` | `uncontrolled_copy_download`       |
| `watermark_failed` | `controlled_copy_watermark_failed` |
| `unmarked`         | `document_download`                |

Beide Download-Routen rufen den Helfer in **jedem** Zweig auf — auch beim
verweigerten Download, dort mit `served: false`. Die Metadaten führen
zusätzlich `documentStatus` und `failureReason`. Damit ist die vom Bericht
beanstandete Invertierung aufgehoben: der unkontrollierte Bezug ist jetzt der
am ausführlichsten belegte.

**Nachweis** `documents-controlled-copy.test.ts`: „?raw=1 returns original bytes
for admins AND records the access (S06-08)" prüft `outcome:
uncontrolled_raw`, `served: true`; der frühere Test hielt
`expect(recordControlledCopyDownload).not.toHaveBeenCalled()` fest.
Zusätzlich belegt „serves draft PDFs unmodified", dass selbst der gewöhnliche
unmarkierte Download eine Spur hinterlässt (`outcome: unmarked`).

---

### S06-09 · Medium · MinIO mit CRITICAL-CVEs bleibt konfiguriert; Download prüft den Hash nie

**Status: geschlossen**

**Änderung**

1. `docker-compose.production.yml`: die Blöcke **`minio` und `minio-init` sind
   entfernt.** Der Kommentar „läuft zunächst PARALLEL zu minio" beschrieb eine
   Umstellung, die nie vollzogen wurde — damit blieb ein Dienst mit
   unauthentifiziertem Object-Write (CVE-2026-40344/-41145) und
   JWT-Algorithm-Confusion (CVE-2026-33322) Teil der ausgelieferten
   Produktionskonfiguration, obwohl der Community-Zweig dafür keinen Fix mehr
   liefert. Garage ist der einzige Objektspeicher.
   Das **Volume `miniodata` bleibt bestehen** — es zu entfernen wäre
   Datenverlust; der Weg dahin steht im Kommentar und in
   `deploy/MINIO-TO-GARAGE-MIGRATION.md`.
2. `deploy/garage/bootstrap/garage-bootstrap.sh` (neu) ersetzt `minio-init`:
   Layout-Zuweisung (ohne die antwortet Garages S3-API nicht), Bucket, und ein
   **auf genau diesen Bucket beschränkter** Key (`bucket allow --read --write`,
   nie `--owner`).
3. **Hash-Prüfung auf dem Lesepfad** (`verifyStoredBytes` in
   `download-policy.ts`): beide Download-Routen hashen die aus dem
   Objektspeicher gelesenen Bytes und vergleichen sie gegen die gespeicherte
   SHA-256, **bevor** irgendetwas ausgeliefert wird. Abweichung → **409**
   `storage_integrity_mismatch` plus Audit-Eintrag mit dem tatsächlichen Hash.
   Der Header `X-File-SHA256` war bisher eine Zusicherung, die nie geprüft
   wurde; jetzt ist sie durch einen Re-Hash der ausgelieferten Bytes gedeckt.
   Dokumente ohne gespeicherten Hash (Uploads vor D3) werden weiterhin
   ausgeliefert — es gibt nichts zu vergleichen.

**Nachweis** `documents-controlled-copy.test.ts`: „refuses to serve bytes that
do not match the recorded SHA-256 (S06-09)" → 409, `actualSha256` im Body,
Audit-Eintrag mit `failureReason: storage_hash_mismatch:…`, `served: false`;
„still serves documents that never had a recorded hash" sichert die
Nicht-Regression.
`grep -n "minio" docker-compose.production.yml` liefert nur noch Kommentare und
den Volume-Namen.

---

### S06-10 · Medium · Keine Mandantentrennung im Objektspeicher

**Status: geschlossen, mit benannter Restlücke**

**Änderung**

1. `packages/shared/src/lib/file-storage.ts`:
   - `assertKeyBelongsToOrg(key, orgId)` — normalisiert Backslashes und
     führende Slashes, weist `..` ab und verlangt das exakte Präfix
     `{orgId}/`. `CrossTenantStorageKeyError` ist ein eigener Fehlertyp.
   - `orgScopedStorage(inner, orgId)` — Dekorator, der jede Operation prüft,
     **bevor** sie das Backend erreicht.
2. Alle sechs DMS-Codepfade mit Storage-Zugriff nutzen ihn:
   `upload`, `download`, `files/[fileId]/download`, `erase`,
   `versions/[versionId]/restore` und `recomputeVersionFileSha()` im
   Signatur-Provider. Damit ist die Präfixgrenze keine Konvention der
   Upload-Route mehr, sondern eine Vorbedingung jedes Zugriffs — genau das vom
   Bericht vorgeschlagene `assertKeyBelongsToOrg` als Pflichtdurchgang.
3. `deploy/garage/bootstrap/garage-bootstrap.sh` bindet den App-Key an genau
   einen Bucket und dokumentiert die Bucket-pro-Org-Prozedur.

**Restlücke, ausdrücklich benannt:** Garage-Keys sind pro **Bucket** scopebar,
nicht pro Präfix. Eine harte Grenze _im Objektspeicher_ verlangt einen Bucket je
Organisation, was einen org-abhängigen Storage-Resolver in `getFileStorage()`
voraussetzt — die App liest heute ein einziges `S3_BUCKET`/`S3_ACCESS_KEY_ID`-Paar
aus der Umgebung. Das ist ein Architekturschritt jenseits dieses Pakets und
steht als Folgepunkt in Abschnitt 3. Die durchgesetzte Grenze dieser Version ist
die applikative; sie ist jetzt vollständig und getestet statt implizit.

**Nachweis** `packages/shared/tests/file-storage-org-scope.test.ts` (15 Tests,
grün): fremde Org, Traversal (`/` und `\`), Präfix-Verwechslung
(`<orgA>-evil/…`), absoluter Pfad und fehlender Org-Kontext werden abgewiesen;
für alle vier Operationen wird belegt, dass das Backend **gar nicht erst
aufgerufen** wird.

---

### S06-11 · Medium · Trust-Portal behauptet AES-256 at rest; implementiert ist keine

**Status: geschlossen** — _Zusage zurückgenommen, plus Schalter für die Prüfung._

**Warum hier die Zusage zurückgenommen wird (Begründung nach Regel):**
Es gibt drei denkbare Wege zu echter Verschlüsselung at rest, und keiner ist in
diesem Paket redlich umsetzbar:

- **SSE im Objektspeicher.** Garage bietet keine Server-Side-Encryption per
  Default; ein Header, der nichts bewirkt, wäre exakt der Placebo-Fix, den
  Grundsatz 2 verbietet.
- **Applikative Envelope-Verschlüsselung der DMS-Objekte.** Das verlangt
  Schlüsselverwaltung, Rotation und eine Migration **aller** Bestandsobjekte,
  und es bräche jeden Lesepfad, der heute Klartextbytes erwartet (Wasserzeichen,
  Volltextextraktion, Hash-Verifikation). Das ist ein Produktvorhaben, kein
  Remediation-Schritt.
- **Datenträgerverschlüsselung (LUKS).** Wirksam, aber eine **Betreiber**-
  maßnahme — und genau das war der Kern des Findings: sie wurde als
  *Produkt*zusage formuliert.

Die Aussage wird deshalb auf das zurückgeführt, was das Produkt selbst leistet.

**Änderung**

1. `apps/web/src/app/(portal)/trust/[orgCode]/page.tsx`: der Text nennt jetzt
   TLS 1.3 im Transit; die **tatsächlich vorhandene** applikative AES-256-GCM-
   Verschlüsselung für Hinweisgebermeldungen und Konnektor-Zugangsdaten
   (`wb-crypto.ts`, `secret-crypto.ts`); und benennt Datenträger- bzw.
   serverseitige Verschlüsselung des Dokumentenspeichers als das, was sie ist —
   eine Konfiguration des Betreibers.
2. `packages/shared/src/lib/file-storage.ts`: `S3_SSE` / `S3_SSE_KMS_KEY_ID`
   setzen `x-amz-server-side-encryption` **innerhalb der SigV4-Signatur** beim
   PUT (ein nicht signierter `x-amz-*`-Header wird von S3 abgelehnt). Damit ist
   die Zusage auf Backends, die SSE können (AWS S3, MinIO-Fork, Ceph),
   herstellbar — der Betreiber schaltet sie ein, das Produkt behauptet sie nicht
   von sich aus.
3. `deploy/garage/garage.toml` hält im Kommentar fest, dass Garage kein SSE
   bietet und der Dokumentenspeicher dort im Klartext auf dem Volume liegt.

**Nachweis** `file-storage-org-scope.test.ts`, Block „S3 server-side encryption
header (S06-11)": ohne `S3_SSE` **kein** Header; mit `S3_SSE` ist er gesetzt
**und** in `SignedHeaders` der `Authorization` enthalten; auf GET wird er nicht
gesendet.

---

### S06-12 · Medium · Rolle `quality_manager` existiert im Code, nicht im DB-Enum

**Status: geschlossen durch WP3 — von WP7 geprüft und bestätigt, kein eigener Fix**

**Prüfung.** WP3 hat das Rollenmodell auf eine Quelle vereinheitlicht
(S02-14): `packages/shared/src/types/platform.ts` → `USER_ROLES` (20 Werte),
gespiegelt von Migration `0410_user_role_enum_single_source.sql`
(`ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'quality_manager'`, Zeile 41,
mit ausdrücklichem `-- S06-12`-Vermerk). Gegen eine von Null migrierte
Datenbank verifiziert:

```
$ psql -d wp7_verify -Atc "SELECT enumlabel FROM pg_enum … 'user_role' …"
admin risk_manager control_owner auditor dpo process_owner viewer
whistleblowing_officer compliance_officer ciso bcm_manager contract_manager
quality_manager security_analyst department_head external_auditor esg_manager
esg_contributor ombudsperson vendor_manager        (20 Werte)
```

Der `?raw=1`-Zweig in beiden Download-Routen ist damit **kein toter Code mehr**.
Es wurde deshalb **nichts** daran geändert.

**Nachweis (Regressionssicherung).**
`apps/web/src/__tests__/lib/document-control-roles.test.ts` (4 Tests, grün) pinnt
das Ergebnis: `quality_manager` ist in `USER_ROLES`, im Drizzle-Enum, und beide
Mengen sind **identisch** — die dreifache Divergenz, die S06-12 verursacht hat,
fällt künftig hier auf statt die Kontrolle still abzuschalten.

---

### S06-13 · Medium · Keine Aufgabentrennung in der Signaturzeremonie

**Status: geschlossen**

**Änderung** (`signature-provider.ts`, `createRequest`)

- Eine Zeremonie, in der der **Ersteller der einzige Signer** ist, wird
  abgewiesen (422, „Segregation of duties: the requester … must not be its only
  signer"). Das ist die Selbstbestätigung, die der Bericht beschreibt.
- Ist der Ersteller **einer von mehreren** Signern, bleibt das erlaubt — ein
  mitzeichnender Dokumenteneigner ist ein legitimer Fall —, wird aber in
  `document_signature_request.creator_is_signer` (Migration 0420) festgehalten.
- Das Zertifikat hat einen neuen Abschnitt **„Zeremonie"** mit „Angefordert
  von" und „Anforderer ist zugleich Signer", plus eine Fußnote. Der Bericht
  bemängelt genau, dass der Anforderer im PDF gar nicht vorkam und ein externer
  Prüfer die Selbstbestätigung deshalb nicht erkennen konnte.
- `verify()` gibt `requestedByUserId`, `requestedByName` und `creatorIsSigner`
  aus; i18n-Schlüssel `verify.creatorIsSigner` ergänzt (de/en).

---

### S06-14 · Medium · Inhalt eines freigegebenen Dokuments ohne Statuswechsel änderbar

**Status: geschlossen**

**Änderung** (`apps/web/src/app/api/v1/documents/[id]/route.ts`, `PUT`)
Eine **Inhaltsänderung** wird abgewiesen (409 `document_released`), wenn das
Dokument nicht in `draft`/`in_review` steht, und ebenso unter Legal Hold.
Metadaten (Titel, Owner, Tags, Retention, Review-Termine, Legal Hold selbst)
bleiben in jedem Zustand editierbar.

`VALID_DOCUMENT_TRANSITIONS` enthält den vorgesehenen Revisionsweg
(`published → archived → draft → in_review → approved → published`), auf dem
`checkFourEyes` bei `approve` und `publish` greift. Der Kommentar im Code
(„minor bump (**draft edit**)") beschrieb eine Annahme — sie wird jetzt
durchgesetzt statt dokumentiert.

**Abgrenzung zu S06-01:** dieselbe Prüfung, zwei Routen — beide nutzen
`contentMutableForStatus()` aus `download-policy.ts`, damit sie nicht
auseinanderlaufen.

---

### S06-15 · Low · Trunkierung der Kette am Ende nicht erkennbar

**Status: geschlossen**

**Änderung**

1. Migration 0420 ergänzt auf `document_signature_request`:
   `signature_count` (Slots bei Anlage), `chain_length` (entschiedene Glieder)
   und `final_chain_hash` (erwarteter Kettenkopf). Bestandszeilen werden aus
   den vorhandenen Signaturen nachgezogen, damit die Prüfung nicht rückwirkend
   Fehlalarme erzeugt.
2. `sign()`/`decline()` schreiben `chain_length = chain_length + 1` und
   `final_chain_hash` in derselben Transaktion wie das Glied.
3. `verifySignatureChain(rows, expectation)` prüft zusätzlich zur
   Vorwärtsverkettung: Länge, Kettenkopf und Slot-Anzahl. Neue Defekte:
   `truncated_tail`, `extra_links`, `final_hash_mismatch`,
   `slot_count_mismatch`; `chainDefects` steht im Report und im Zertifikat.
   Fehlt der Sollzustand (Zeilen vor 0420), degradiert die Prüfung auf das
   alte Verhalten, statt zu scheitern.
4. Migration 0421 (S06-16) verhindert das Löschen eines entschiedenen Glieds
   überhaupt — Erkennung und Verhinderung greifen zusammen.

**Nachweis** `document-signature-chain.test.ts`, Block „completeness (S06-15)"
(6 Tests). Der entscheidende Test ist paarweise gebaut:

- „WITHOUT the recorded shape, a truncated tail looks perfectly valid" —
  `ok: true`, `brokenAt: null`. Das ist der Befund.
- „detects a deleted LAST link against the recorded shape" — `ok: false`,
  `defects` enthält `truncated_tail`, `final_hash_mismatch` und
  `slot_count_mismatch`.

Die vom Bericht benannte Testlücke (nur das mittlere Glied wurde geprüft) ist
damit geschlossen.

---

### S06-16 · Low · `document_signature` ist nicht append-only, obwohl die Migration das behauptet

**Status: geschlossen**

**Änderung** `packages/db/drizzle/0421_document_signature_append_only.sql`:
`BEFORE UPDATE OR DELETE`-Trigger, `ENABLE ALWAYS`, `SECURITY DEFINER` mit
gesetztem `search_path`.

- `content_hash IS NULL` (pending) → UPDATE frei. Das ist der einzige
  Schreibvorgang, den die Applikation braucht.
- Danach sind `signer_user_id`, `sign_order`, `status`, `signed_at`,
  `decline_reason`, `ip_address`, `user_agent`, `content_hash`,
  `previous_chain_hash`, `chain_hash`, `hash_version`, `request_id` und
  `org_id` eingefroren.
- DELETE eines entschiedenen Glieds ist verboten — **solange die zugehörige
  Anforderung noch existiert**. Wird die ganze Zeremonie entfernt (DSGVO-
  Löschung, Retention-Purge), löscht PostgreSQL die Elternzeile zuerst; der
  Trigger erkennt den Kaskadenpfad daran, dass
  `document_signature_request` in dieser Transaktion nicht mehr sichtbar ist.
  **Das ist bewusst so gebaut, damit kein fremdes Paket etwas ändern muss** —
  insbesondere nicht `apps/worker/src/crons/document-retention-purge.ts` (WP8/WP9).
  Zusätzlich gibt es `app.dms_signature_purge` als ausdrückliche Freigabe; die
  Erase-Route setzt sie, weil sie einen gezielten Einzellöschpfad hat.

Die Kette bleibt ungeschlüsselt — die eigentliche Tamper-Evidence ist weiterhin
der verankerte `audit_log`. Der Guard schließt die Lücke zwischen dem, was 0375
im Spaltenkommentar **behauptet**, und dem, was durchgesetzt wird.

**Nachweis** live gegen `wp7_verify`, unter `session_replication_role='replica'`:

```
--- T4: pending -> decided MUST succeed ---            UPDATE 1 (signed)
--- T5: rewriting a DECIDED link MUST fail ---         ERROR 42501 (S06-16)
--- T6: re-chaining a DECIDED link MUST fail ---       ERROR 42501 (S06-16)
--- T7: DELETING a decided link MUST fail ---          ERROR 42501 (S06-16)
--- T8: the marked purge path MUST succeed ---         DELETE 1, rows left 0
```

und im normalen Replikationsmodus (Kaskaden aktiv):

```
--- C1: deleting a single decided link MUST still fail ---   ERROR 42501
--- C2: cascade from document MUST succeed ---               signatures left 0
--- C3: cascade from the request alone MUST succeed ---      signatures left 0
```

---

### S06-17 · Low · Wasserzeichen-Test prüft nie, ob der Fußzeilentext im PDF landet

**Status: geschlossen**

**Änderung** `apps/web/src/__tests__/lib/pdf-watermark.test.ts` neu geschrieben
(14 Tests). Der Text wird nach dem Stempeln mit `pdfjs-dist` — derselben Engine,
die das DMS für die Volltextindizierung nutzt — **wieder ausgelesen** und je
Seite geprüft: Marker, Titelfragment, Version und Abrufer. Zusätzlich:

- Der Marker überlebt einen sehr langen Titel. Die alte Kürzungsschleife schnitt
  von rechts und konnte ihn vollständig auffressen, ohne dass Byte-Länge oder
  Seitenzahl reagiert hätten. Die Schleife kürzt jetzt nur den **Kopf** des
  Textes; `CONTROLLED_COPY_MARKER` ist eine exportierte Konstante, an der Code
  und Test gemeinsam hängen.
- Die Grundlinie liegt bei `y: 14` statt `y: 10` — `10` lag innerhalb des
  üblichen nicht bedruckbaren Randes von 0,5 cm, ein Ausdruck konnte die
  Markierung also verlieren. Ein Test misst die tatsächliche Y-Position der
  gezeichneten Items.
- Der vom Bericht benannte ungetestete Fall — eine **valide verschlüsselte**
  PDF statt `Buffer.from("not a pdf")` — ist jetzt abgedeckt (S06-06).

---

### S06-18 · Low · Vollständiger Dateiinhalt im Heap auf allen Upload-/Download-Pfaden

**Status: teilweise geschlossen (Deckelung statt Streaming) — Rest benannt**

**Änderung** (`pdf-watermark.ts`)

- `MAX_WATERMARK_BYTES` (Standard 20 MB, `WATERMARK_MAX_BYTES`): eine größere
  PDF wird **vor** dem Parsen abgewiesen (`reason: too_large`) statt Original,
  Objektgraph und serialisierte Kopie gleichzeitig zu halten.
- `MAX_CONCURRENT_STAMPS` (Standard 4, `WATERMARK_MAX_CONCURRENT`): eine kleine
  Warteschlange begrenzt die Zahl gleichzeitiger Stempelvorgänge. Die
  Speicherobergrenze ist damit planbar statt proportional zur
  Request-Nebenläufigkeit — der Bericht rechnet vor, dass ein Dutzend paralleler
  50-MB-Downloads für ein OOM des Web-Containers (`mem_limit: 1600m`) reicht.

**Bewusst nicht gemacht:** echtes Streaming auf Upload- und Download-Pfad. Das
hieße pdf-lib ersetzen (es kennt nur Buffer) und `document.file_text`,
Hash-Berechnung und Virenscan umbauen — alle drei brauchen den vollständigen
Puffer. Das Restrisiko ist in Abschnitt 4 benannt.

---

### S06-19 · Low · `restore` teilt den Storage-Key mit der Quellversion

**Status: geschlossen**

**Änderung**

1. `versions/[versionId]/restore/route.ts`: das Objekt wird auf einen **neuen**
   Key `{orgId}/{docId}/{uuid}-{name}` kopiert, **vor** der Transaktion, damit
   eine Versionszeile nie auf einen nie geschriebenen Key zeigt. Fehlt das
   Quellobjekt, wird der Metadaten-Snapshot wiederhergestellt und geloggt, aber
   kein leerer Key erfunden.
2. `files/[fileId]/route.ts` (zweite Hälfte des Findings): das Löschen einer
   Datei zog bisher nur `document.file_sha256` nach und ließ
   `document_version` unberührt — eine **signierte** Version konnte danach auf
   eine soft-gelöschte Datei zeigen, während die Signaturverifikation weiter
   „unverändert" meldete. Jetzt:
   - Versionen, die den Key referenzieren, werden ermittelt;
   - hat eine Signaturanforderung eine davon eingefroren → **409** `file_signed`
     statt stiller Zerstörung des Nachweises;
   - sonst werden die betroffenen Snapshots ausdrücklich geleert (das ist der
     `Wert → NULL`-Übergang, den der Guard aus 0422 zulässt), damit die
     baumelnde Referenz sichtbar aufgelöst wird statt stehen zu bleiben.

---

### S06-20 · Low · Durchgängig falsche eIDAS-Fundstelle

**Status: geschlossen im WP7-Hoheitsbereich — vier Fundstellen übergeben**

VO (EU) 910/2014 definiert die elektronische Signatur in **Art. 3 Nr. 10**;
Art. 25 regelt ausschließlich die Rechtswirkung. Korrigiert auf
„einfache elektronische Signatur i.S.d. Art. 3 Nr. 10 eIDAS; Rechtswirkung nach
Art. 25 Abs. 1 eIDAS":

- `apps/web/messages/de/document-signature.json` (`signArea.legalNotice`)
- `apps/web/messages/en/document-signature.json` (dito)
- `.../signature-requests/[requestId]/certificate/route.ts` (Fußnote)
- `.../signature-requests/[requestId]/sign/route.ts` (Kopfkommentar)
- `apps/web/src/lib/documents/signature-provider.ts` (Kopfkommentar)

**Nicht geändert, weil fremde Hoheit** (Abschnitt 3):
`components/documents/document-signatures-tab.tsx:8`, `docs/STATUS.md:84`,
`docs/ALPHA_INVITE.md:184`, `docs/qa-reports/wave19-n7-dms-scope-decision.md:103`.

---

### S06-21 · Low · Upload-Typprüfung vertraut dem clientgesetzten Content-Type

**Status: geschlossen** (der an WP7 übergebene Teil von S04-06)

**Änderung** `documents/[id]/upload/route.ts` nutzt
`verifyUploadSignature()` aus `packages/shared/src/lib/file-signature.ts`
(WP5, unverändert übernommen):

- Die Magic Bytes entscheiden; die sniffed Type wird persistiert und später als
  `Content-Type` ausgeliefert.
- OLE2-Container (.doc/.xls/.ppt) werden auf den deklarierten Legacy-Typ
  zurückgebildet, ZIP-Container auf den deklarierten OOXML-Typ (Logik im
  Helfer). SVG/CSV/Markdown/Text/XML haben keine Magic Bytes und werden über
  `allowUnknownForText` akzeptiert.
- **Deklaration und Inhalt müssen übereinstimmen** — bei Abweichung 415
  `content_type_mismatch`. Das stille Umtypisieren wäre die halbe Lösung
  gewesen: `isPdf` auf dem Download-Pfad leitet sich aus dem gespeicherten
  MIME-Typ ab, eine als `text/plain` hochgeladene PDF würde also **nie**
  gestempelt. Genau das nennt der Bericht als verbleibendes Restrisiko und als
  „eine weitere Variante des Bypasses aus S06-06, ohne jede Verschlüsselung".
- **ClamAV fail-closed in Produktion**: `scan.status === "skipped"` wird bei
  `isClamAvRequired()` mit 503 abgewiesen — ein nie konfigurierter Scanner war
  bisher dasselbe Loch wie ein fail-open-Fehler (WP5-Notiz).

**Nachweis** `documents-upload-immutability.test.ts`: echte PNG-Signatur als
`application/pdf` deklariert → 415 mit `detectedMime: image/png`, **kein**
Storage-Write; echte PDF als `text/plain` deklariert → 415 mit
`detectedMime: application/pdf`.

---

### S06-22 · Low · Sicherheitsrelevante DDL in 0375 in `EXCEPTION WHEN OTHERS` gekapselt

**Status: geschlossen**

**Änderung** `packages/db/drizzle/0424_dms_rls_assert.sql`. 0375 ist
ausgeliefert und wird nach Grundsatz 4 nicht angefasst. Die neue Migration
stellt den Zustand her (`ENABLE`/`FORCE ROW LEVEL SECURITY`, **ohne**
EXCEPTION-Mantel — ein Fehler hier muss die Migration abbrechen) und prüft ihn
danach hart nach: fehlt auf `document_signature` oder
`document_signature_request` RLS, FORCE oder eine Policy, wird eine
`EXCEPTION` mit der Liste der Mängel geworfen.

**Nachweis** Migration im Lauf gegen `wp7_verify` erfolgreich (also Zustand
korrekt); Gegenprobe:
`document_signature_request rls=true force=true | document_signature rls=true force=true`.

---

### S06-23 · Info · Signaturanforderung bleibt nach Dateiänderung unbegrenzt „pending"

**Status: geschlossen**

**Änderung**

- Neuer Enum-Wert `invalidated` (Migration 0420) plus `invalidated_at` und
  `invalidated_reason`.
- `InHouseSignatureProvider.invalidate()`: erkennt `sign()` eine Abweichung —
  in der DB-Spalte **oder** in den Bytes —, wird die Anforderung auf
  `invalidated` gesetzt und **Ersteller sowie alle offenen Signer** werden
  benachrichtigt. Bisher blieb sie `pending`: `GET /documents/my-pending-signatures`
  listete sie weiter, der Reminder-Cron mahnte sie an, und erst der Klick auf
  „Signieren" brachte den 422 — der Ersteller erfuhr nie, dass seine Zeremonie
  tot war.
- i18n `requestStatus.invalidated` (de/en) und `STATUS_DE` im Zertifikat.

**Nachweis** `document-signature-requests.test.ts`, Test „returns 422 when the
file hash no longer matches": prüft zusätzlich, dass der Anforderungsstatus auf
`invalidated` gesetzt wurde.

---

### S06-24 · Info · Das Signatur-Zertifikat ist selbst weder signiert noch verankert

**Status: geschlossen (Aussage präzisiert)**

Der Befund ist für eine einfache elektronische Signatur konsistent — das
Zertifikat _muss_ nicht signiert sein; es darf nur nicht den Eindruck eines
geprüften Dokuments erwecken. Der Satz „Verifiziert am … durch die
ARCTOS-Plattform" tat genau das.

**Änderung** `.../certificate/route.ts`: der Schlusstext lautet jetzt sinngemäß
„Dieses Zertifikat ist ein generierter Bericht: es trägt selbst keine
PDF-Signatur, keinen Zeitstempel und keinen Hash seiner selbst. Es ist
nachbaubar. Belastbar ist ausschließlich die Online-Prüfung unter
`<verifyUrl>` (Request-ID `<id>`)", gefolgt von „Erstellt am …" statt
„Verifiziert am …". Die Verifikations-URL wird aus `NEXT_PUBLIC_APP_URL` bzw.
dem Request-Origin gebildet.

**Kein QR-Code**: dafür gibt es keine Bibliothek im Workspace, und eine neue
Abhängigkeit für ein Info-Finding einzuziehen wäre unverhältnismäßig. Die URL
steht im Klartext auf dem Dokument.

---

### S06-25 · Info · `garage.toml` setzt `rpc_public_addr` auf die Loopback-Adresse

**Status: geschlossen (dokumentiert, Falle entschärft)**

Für den beabsichtigten Single-Node-Betrieb (`replication_factor = 1`) ist der
Wert funktionsfähig — es gibt keinen Fehler zu beheben. Die Falle beim
Skalieren wird entschärft: `deploy/garage/garage.toml` erklärt an der Zeile,
dass ein zweiter Knoten eine Adresse angekündigt bekäme, unter der ihn niemand
erreicht, nennt die korrekten Alternativen (Cluster-IP oder Compose-DNS-Name)
und weist auf `GARAGE_RPC_PUBLIC_ADDR` hin, mit dem sich der Wert setzen lässt,
ohne die Datei zu ändern. Der Hinweis auf `replication_factor = 3` steht daneben.

---

## 2. Verifikationslauf

| Prüfung                                                                                                        | Ergebnis                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `migrate-all.ts` gegen leere DB (`wp7_verify`, pgcrypto/uuid-ossp/timescaledb vorab)                           | **400/400 Migrationen, 603 Tabellen, Exit 0**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Migration 0420 — Spalten `document_signature_request`                                                          | `chain_length creator_is_signer final_chain_hash invalidated_at invalidated_reason signature_count` ✓                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Migration 0420 — Spalten `document_signature`                                                                  | `hash_version ip_trusted tsa_gen_time tsa_policy_oid tsa_proof tsa_serial tsa_status` ✓                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Migration 0420 — Enum                                                                                          | `pending completed declined cancelled invalidated` ✓                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Migration 0421/0422 — Trigger                                                                                  | beide vorhanden, `tgenabled = 'A'` (ENABLE ALWAYS) ✓                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Migration 0421/0422 — Verhalten                                                                                | 8 Guard-Szenarien (T1–T8) + 3 Kaskaden-Szenarien (C1–C3), alle wie erwartet                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Migration 0423 — Spalten                                                                                       | `document_hash_source document_sha256 signature_hash_version` ✓                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Migration 0424 — RLS                                                                                           | `document_signature` und `_request`: `rls=true force=true` ✓                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `apps/web` — `tsc --noEmit` (inkl. `packages/shared`, `packages/db`, `packages/ai` über die Pfad-Mappings)     | **Exit 0, keine Fehler**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `pdf-watermark.test.ts`                                                                                        | 14/14 ✓                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `document-signature-chain.test.ts`                                                                             | 20/20 ✓                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `documents-controlled-copy.test.ts`                                                                            | 13/13 ✓                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `documents-upload-immutability.test.ts` (neu)                                                                  | 11/11 ✓                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `document-signature-requests.test.ts`                                                                          | 18/18 ✓                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `document-control-roles.test.ts` (neu)                                                                         | 4/4 ✓                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `packages/shared` — `file-storage-org-scope.test.ts` (neu)                                                     | 15/15 ✓                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `apps/web` — DMS-nahe Suite (9 Dateien: die 6 oben, `dms-documents-alias`, `document-control`, `extract-text`) | **125/125 ✓**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `apps/web` — Gesamtsuite                                                                                       | 4 739 grün, 524 übersprungen, 22 rot. Die 22 verteilen sich auf **zwei** Dateien (`all-routes-smoke`, `all-mutating-routes-auth-smoke`) und betreffen ausschließlich Routen fremder Pakete, die parallel im selben Arbeitsbaum umgebaut werden: `ai/policy`, `dpms/annual-report`, `dpms/dpia/export-pdf`, `dpms/dsr/collect`, `dpms/ropa/export`, `export/[entityType]`, `export/bulk`, `portal/mailbox`, `portal/report`, `processes/generate-bpmn` (WP6/WP8/WP9). **Keine WP7-Route und keine WP7-Datei ist darunter**; vor Beginn dieses Pakets waren dieselben Tests bereits rot. |

**Abnahmekriterien des Auftrags:**

| Kriterium                                                                                                      | Erfüllt durch                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Test: freigegebene Version per Upload überschreiben → abgelehnt, Audit-Eintrag trägt den Akteur                | `documents-upload-immutability.test.ts` (409 für 4 Status; genau ein `withAuditContext` über alle Schreibvorgänge) + DB-Guard T1 |
| Test mit der PoC-PDF: Wasserzeichen fällt nicht still aus, Download verweigert/markiert, Zugriff protokolliert | `documents-controlled-copy.test.ts` „REFUSES … (S06-06, PoC file)" → 422 + Audit `watermark_failed`                              |
| Test: `?raw=1` wird protokolliert                                                                              | `documents-controlled-copy.test.ts` „?raw=1 … AND records the access (S06-08)"                                                   |
| Test: Signaturkette erkennt Trunkierung am Ende                                                                | `document-signature-chain.test.ts` „detects a deleted LAST link against the recorded shape" (mit Gegenprobe ohne Sollzustand)    |
| Wasserzeichen-Test prüft Fußzeilentext, nicht nur Byte-Länge                                                   | `pdf-watermark.test.ts` „writes the footer TEXT onto every page" (pdfjs-Extraktion je Seite)                                     |
| Migrationen grün, `tsc --noEmit` fehlerfrei, bestehende Tests grün                                             | siehe Tabelle oben                                                                                                               |

---

## 3. Bedarf an andere Pakete

### An WP10 (Betrieb, `deploy/**`, `docs/**`) — Verhaltensänderungen im Deployment

1. **`deploy/MINIO-TO-GARAGE-MIGRATION.md` ist jetzt verbindlich, nicht
   optional.** `minio` und `minio-init` sind aus
   `docker-compose.production.yml` entfernt (S06-09). Vor dem nächsten `up`
   muss die Datenübernahme nach Garage abgeschlossen sein; das Volume
   `miniodata` bleibt absichtlich stehen, bis das bestätigt ist, und wird
   danach per `docker volume rm <projekt>_miniodata` entfernt.
2. **`garage-init` ersetzt `minio-init`.** Das Bootstrap-Skript liegt unter
   `deploy/garage/bootstrap/garage-bootstrap.sh` (WP7-Hoheit) und wird per
   Bind-Mount eingebunden. Es weist das Cluster-Layout zu — ohne das
   antwortet Garages S3-API nicht, anders als bei MinIO.
3. **Neue Umgebungsvariablen** (im Compose bereits mit Defaults verdrahtet,
   bitte in `.env.production.example` und das Runbook übernehmen):
   `TRUSTED_PROXY_HOPS` (Default 1; **muss** der tatsächlichen Zahl eigener
   Reverse-Proxys entsprechen, sonst wird jede Signatur-IP als Selbstauskunft
   ausgewiesen — S06-03), `SIGNATURE_TSA_ENABLED`, `FREETSA_CA_PEM`,
   `S3_SSE`, `S3_SSE_KMS_KEY_ID`, `WATERMARK_MAX_BYTES`,
   `WATERMARK_MAX_CONCURRENT`.
4. **`docs/STATUS.md:84`, `docs/ALPHA_INVITE.md:184`,
   `docs/qa-reports/wave19-n7-dms-scope-decision.md:103`** tragen dieselbe
   falsche eIDAS-Fundstelle wie die korrigierten Codestellen (S06-20).
   Ersetzen durch: „einfache elektronische Signatur i.S.d. Art. 3 Nr. 10 eIDAS;
   Rechtswirkung nach Art. 25 Abs. 1 eIDAS; kein QES". Inhaltlich ändert sich
   nichts, nur die Zitierung.
5. **Empfehlung Monitoring** (passend zu WP4/S13-11): Alarm auf
   `audit_log.action_detail IN ('controlled_copy_watermark_failed',
'uncontrolled_copy_download')` und auf jeden 409
   `storage_integrity_mismatch` — Letzterer bedeutet, dass jemand am
   Objektspeicher vorbei geschrieben hat.

### An WP11 (Testfundament / UI-Paket) — Frontend zieht nach

1. `apps/web/src/components/documents/document-signatures-tab.tsx:8` trägt die
   falsche eIDAS-Fundstelle (S06-20) — gleicher Ersatztext wie oben.
2. Die Download-Routen antworten jetzt mit neuen Fehlercodes, die die UI
   verständlich darstellen sollte:
   `422 watermark_required` (PDF nicht stempelbar — Handlungsanweisung: ohne
   Passwortschutz neu hochladen), `409 storage_integrity_mismatch`,
   `409 document_released`, `409 legal_hold`, `409 file_signed`,
   `415 content_type_mismatch`, `422 pdf_not_stampable`.
   Der Header `X-Controlled-Copy` kennt zusätzlich den Wert `refused`.
3. Neue i18n-Schlüssel stehen bereit und werden noch nicht gerendert:
   `verify.fileUnverifiable`, `verify.chainIncomplete`,
   `verify.timestampMissing`, `verify.ipSelfReported`,
   `verify.creatorIsSigner`, `requestStatus.invalidated`.
4. `POST /documents/:id/upload` liefert bei einem Versionssprung
   `data.newVersionLabel` — die UI sollte den Sprung anzeigen, statt den
   Upload als reine Dateiersetzung darzustellen.

### An WP8 (Datenschutz) — keine Änderung nötig, nur Kenntnisnahme

`document_signature` ist ab 0421 append-only. Der Retention-Purge in
`apps/worker/src/crons/document-retention-purge.ts` und jede
Kaskadenlöschung über `document` funktionieren **unverändert weiter**: der
Trigger erkennt den Kaskadenpfad selbst (die Elternzeile ist dann bereits
gelöscht) und braucht keine Mitwirkung des Aufrufers. Das war eine bewusste
Konstruktionsentscheidung, damit dieses Paket keine fremde Datei ändern muss.
Wer künftig ein **einzelnes** Kettenglied löschen will, setzt
`SELECT set_config('app.dms_signature_purge', '<requestId>'|'all', true)` in
derselben Transaktion — so macht es `documents/[id]/erase/route.ts`.

### An WP9 (Worker) — zwei Punkte

1. **`apps/worker/src/crons/signature-due-reminder.ts`** sollte Anforderungen im
   neuen Status `invalidated` überspringen (S06-23). Bisher mahnte der Cron
   Zeremonien an, die technisch nicht mehr abschließbar waren; der Status macht
   sie jetzt erkennbar. Filter: `status = 'pending'` statt „nicht completed".
2. **`apps/web/src/lib/rate-limit.ts` → `getClientIp()`** hat exakt dieselbe
   `X-Forwarded-For`-Schwäche wie die Signaturroute (erster Eintrag =
   client-gesetzt; S02-09/S10-05). WP7 hat den Guard für seinen eigenen Pfad in
   `apps/web/src/lib/documents/client-ip.ts` gebaut (`TRUSTED_PROXY_HOPS`,
   rechtsseitige Auswertung, Vertrauens-Flag). Er ist bewusst klein und
   abhängigkeitsfrei gehalten, damit WP9 ihn übernehmen oder nach
   `lib/rate-limit.ts` hochziehen kann. Zwei Implementierungen derselben Regel
   sollten am Ende nicht bestehen bleiben.

### An Produkt / Architektur — zwei Folgepunkte aus bewusst gezogenen Grenzen

1. **Bucket pro Mandant im Objektspeicher (S06-10).** Garage kann Keys pro
   Bucket scopen, nicht pro Präfix. Eine harte Grenze _unterhalb_ der
   Applikation verlangt einen org-abhängigen Storage-Resolver in
   `getFileStorage()`; die App liest heute ein einziges Bucket/Key-Paar aus der
   Umgebung. Die Prozedur steht kommentiert im Bootstrap-Skript.
2. **Verkettetes Policy-Acknowledgment (S06-02).** Die Prüfsumme ist jetzt
   korrekt benannt und bindet an die richtigen Werte, bleibt aber ein
   ungeschlüsselter Hash ohne Verkettung. Der belastbare Nachweis ist der
   Audit-Trigger auf `policy_acknowledgment`. Wer eine echte
   Nachweisfunktion will, hebt das Modul auf denselben Mechanismus wie
   `document_signature` (Kettenkopf je Verteilung, Nebenläufigkeitsguard,
   Zertifikat) — das ist ein Feature, kein Fix.

---

## 4. Restrisiko

**Die Integritätszusagen des Moduls sind jetzt durch das gedeckt, was sie
behaupten — mit vier benannten Grenzen.**

_Erstens: Verschlüsselung at rest bleibt eine Betreibermaßnahme._ Der
Dokumentenspeicher liegt auf Garage und im `local`-Backend im Klartext auf dem
Volume. Das Produkt setzt den SSE-Header nur, wenn `S3_SSE` konfiguriert ist,
und Garage kann ihn nicht erfüllen. Die Trust-Seite behauptet deshalb keine
Produktzusage mehr, sondern beschreibt die Lage. Wer AES-256 at rest für DMS-
Dokumente **braucht**, betreibt LUKS auf dem Datenträger oder wechselt auf ein
SSE-fähiges Backend — beides ist eine Entscheidung des Betreibers, und sie ist
jetzt sichtbar statt implizit.

_Zweitens: die Signaturkette bleibt ungeschlüsselt._ Migration 0421 verhindert,
dass ein Akteur mit `UPDATE`/`DELETE`-Recht ein entschiedenes Glied umschreibt —
aber ein PostgreSQL-Superuser kann den Trigger entfernen. Die belastbare
Tamper-Evidence ist und bleibt der von WP4 gehärtete, HMAC-gesiegelte und
FreeTSA-verankerte `audit_log`, in den jetzt jedes Kettenglied als
`signature_chain_anchor` mitgeschrieben wird. Der RFC-3161-Zeitstempel auf dem
Glied selbst ist best-effort: fällt die TSA aus, entsteht die Signatur trotzdem
— sie weist dann aber im Zertifikat ausdrücklich aus, dass ihr Zeitpunkt aus der
Serveruhr stammt. Das ist die ehrliche Aussage, nicht die stärkste.

_Drittens: die Mandantentrennung im Objektspeicher ist applikativ, nicht
strukturell._ `orgScopedStorage` ist eine vollständige und getestete Schranke
für alle sechs DMS-Codepfade, aber sie lebt im selben Prozess wie der Code, den
sie schützt. Ein Angreifer mit Codeausführung im Web-Container umgeht sie; ein
Bucket pro Mandant nicht. Der Weg dorthin ist in Abschnitt 3 beschrieben.

_Viertens: Speicher._ Deckelung und Warteschlange machen den Verbrauch beim
Stempeln planbar, ersetzen aber kein Streaming — Upload, Download und
Hash-Berechnung halten die Datei weiterhin vollständig im Heap. Eine Folge des
Deckels ist eine bewusste Regression: released PDFs über 20 MB werden nicht mehr
ausgeliefert, sondern mit `reason: too_large` abgewiesen. Das ist im Sinne des
Leitmotivs richtig — lieber verweigern als unmarkiert ausliefern —, aber es ist
eine Verhaltensänderung, die Betreiber über `WATERMARK_MAX_BYTES` steuern.

**Zwei weitere bewusste Verhaltensänderungen**, die im Betrieb auffallen werden
und keine Defekte sind: eine passwortgeschützte PDF wird beim Upload
zurückgewiesen (S06-06), und der Inhalt eines freigegebenen Dokuments lässt sich
nicht mehr direkt ändern — er muss über `archived → draft` zurück in den
Freigabezyklus (S06-01, S06-14). Beides ist genau die Kontrolle, deren Fehlen
der Bericht beanstandet; beides wird Nutzer überraschen, die den bisherigen Weg
gewohnt sind.
