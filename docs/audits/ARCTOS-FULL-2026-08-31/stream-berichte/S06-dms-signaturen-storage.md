# S06 — DMS, elektronische Signaturen, Storage

**Audit-ID:** ARCTOS-FULL-2026-08-31 · Stream S06
**Prüfgegenstand:** `/work/repo` @ `a8d1414f`
**Stand:** abgeschlossen · 25 Findings (2 High, 12 Medium, 8 Low, 3 Info) · Evidenz in `/work/audit/evidence/S06/`

---

## 1. Zusammenfassung

_(ausführliche Fassung in Abschnitt 6)_

Kernaussage vorab: Die **eIDAS-Kommunikation ist ehrlich** — Code, Doku, i18n und
Zertifikats-PDF benennen durchgängig "einfache elektronische Signatur i.S.d.
Art. 25 eIDAS, kein QES". Die erwartete Diskrepanz _behauptete Signaturklasse ≫
implementierte Signaturklasse_ besteht auf der Ebene der Klassenbezeichnung
**nicht**. Sie besteht jedoch auf zwei **darunterliegenden Ebenen**:

1. Der Begriff **"Digitale Signatur"** wird im Policy-Acknowledgment-Modul für
   einen ungeschlüsselten SHA-512-Hash über öffentlich bekannte Werte verwendet
   und dem Nutzer als "Nachweis" präsentiert (S06-02).
2. Die **Integritäts- und Revisionssicherheits-Zusagen rund um die Signatur**
   (i18n-Legal-Notice, Verify-Text, Zertifikats-PDF) sind stärker als das, was
   die Implementierung prüft bzw. schützt (S06-03, S06-04, S06-05).

Der zweite Schwerpunkt (Umgehbarkeit) ergibt drei bestätigte Wege:
Überschreiben einer freigegebenen Dokumentversion (S06-01), Wasserzeichen-Bypass
über nicht-ladbare PDFs und über die Status-Bedingung (S06-06, S06-07), sowie
inhaltliche Änderung nach Teilsignatur (S06-01 i.V.m. S06-04).

---

## 2. Methodik-Protokoll (6 Punkte laut AUDIT_PLAN §S06)

### M1 — Was genau wird signiert?

Signiert wird **kein Byte des Dokuments**, sondern ein JSON-Objekt aus sechs
Metadatenfeldern.

`apps/web/src/lib/documents/signature-chain.ts:41-55`:

```ts
export function computeContentHash(payload: SignaturePayload): string {
  const ordered: Record<string, unknown> = {};
  for (const k of Object.keys(payload).sort()) {
    ordered[k] = payload[k as keyof SignaturePayload];
  }
  return sha256(JSON.stringify(ordered));
}
export function computeChainHash(previous, contentHash) {
  return sha256((previous ?? "") + contentHash);
}
```

Payload (`signature-chain.ts:30-39`): `documentId`, `versionId`, `fileSha256`,
`signerUserId`, `signedAt`, `decision`.

`fileSha256` stammt aus `document_signature_request.file_sha256`, das beim
Anlegen der Anforderung aus **`document_version.file_sha256` (einer DB-Spalte)**
eingefroren wird (`signature-provider.ts:289-308`), nicht aus einem Re-Hash der
gespeicherten Bytes. Der signierte Umfang ist damit _nachvollziehbar
dokumentiert_, aber er ist eine **Aussage über eine Datenbankspalte**, nicht
über die Datei. → S06-04.

Nicht im Signaturumfang: `ipAddress`, `userAgent`, `declineReason`, `signOrder`,
`sequential`, Dokumenttitel, Signer-Name. → S06-03.

### M2 — Signaturklasse: behauptet vs. implementiert

Siehe eigenen Abschnitt 3.

### M3 — Multi-Signer

- **Reihenfolge erzwungen:** ja, bei `sequential=true`
  (`signature-provider.ts:405-415`): `signatures.some(s => s.signOrder <
mine.signOrder && s.status === "pending")` → 409. Parallel-Modus ist explizit
  wählbar und dokumentiert.
- **Concurrency:** partieller UNIQUE-Index `(request_id, previous_chain_hash)
NULLS NOT DISTINCT` (Migration 0375) + Mapping von PG-Fehler `23505` auf 409
  (`signature-provider.ts:529-536`). Verhindert zwei Glieder am selben
  Kettenkopf. Sauber gelöst.
- **Manipulation nach Teilsignatur:** die _Datei_ kann geändert werden
  (S06-01); der nächste Signer bekommt dann 422 (`signature-provider.ts:417-425`),
  die bereits abgegebenen Signaturen bleiben aber ohne Kennzeichnung bestehen
  und die Anforderung bleibt unbegrenzt `pending`. → S06-04, S06-09.
- **Kein Rücktritt/Widerruf** einzelner Signaturen, keine Frist-Erzwingung
  (Due-Date ist rein informativ + Reminder-Cron).

### M4 — Storage-Abstraktion

- Backends: `local` (Default) und `s3` (SigV4 über `fetch`, kein SDK) —
  `packages/shared/src/lib/file-storage.ts:277-320`. Garage/MinIO sind lediglich
  S3-Endpunkte derselben Implementierung; `deploy/garage/garage.toml`.
- **Keine Presigned URLs, keine Multipart** (`deploy/garage/garage.toml:6-9`).
  Der Client bekommt nie eine Storage-URL; jeder Byte-Zugriff läuft über eine
  authentifizierte Next.js-Route. → **Der im Auftrag vermutete Weg "Storage-
  Endpunkt direkt ansprechen" existiert aus dem Browser heraus nicht.**
  Er existiert aus dem Docker-Netz heraus (S06-08).
- **Pfadkonstruktion:** rein serverseitig `{orgId}/{docId}/{uuid}-{safeName}`
  (`upload/route.ts:99-103`), `safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g,"_")`.
  `filePath` ist in **keinem** Zod-Schema der Dokument-Routen enthalten
  (geprüft: `packages/shared/src/schemas/` — einzige `filePath`-Definition ist
  `control.ts:302`, nicht DMS). Traversal-Guard zusätzlich in
  `LocalFsStorage.resolveKey` (`file-storage.ts:72-80`). → **kein Finding.**
- **Bucket-Isolation pro Org:** existiert nicht — ein Bucket, ein Key-Paar für
  alle Mandanten, Trennung ausschließlich über das Key-Präfix in der App
  (`docker-compose.production.yml:242-244`). → S06-10.
- **Verschlüsselung at rest:** keine (weder SSE-Header beim PUT noch
  applikative Verschlüsselung; vgl. `S3Storage.put`,
  `file-storage.ts:217-227`). Der Trust-Portal-Text behauptet AES-256 at rest
  (`apps/web/src/app/(portal)/trust/[orgCode]/page.tsx:232`). → S06-11.

### M5 — Controlled-Copy-Watermarking

Zwei Download-Routen, identischer Vertrag
(`documents/[id]/download/route.ts`, `documents/[id]/files/[fileId]/download/route.ts`).
Bedingung: `isPdf && (doc.status === "published" || forceWatermark)`.
Umgehungen: S06-06 (nicht ladbare/verschlüsselte PDFs), S06-07 (Status
`archived`/`expired`), S06-12 (`?raw=1` nicht protokolliert).

### M6 — Aufbewahrung und Versionierung

- `PUT /documents/:id` versioniert Inhaltsänderungen korrekt (neue Minor-Version,
  `[id]/route.ts:193-215`) — überschreibt Historie **nicht**.
- `POST /documents/:id/upload` überschreibt die Datei-Felder der **aktuellen,
  ggf. freigegebenen** Version **in-place** (`upload/route.ts:217-228`). → S06-01.
- `versions/[versionId]/restore` legt korrekt eine neue Version an
  ("History is never overwritten", `restore/route.ts:9-10`) — teilt sich aber den
  Storage-Key mit der Quellversion. → S06-13.
- Legal Hold blockiert die DSGVO-Löschung (`erase/route.ts:46-55`) — greift
  aber nicht gegen `upload` und nicht gegen `PUT`. → S06-01.

---

## 3. Signatur-Analyse: behauptet vs. implementiert

### 3.1 Was ist implementiert

| Merkmal                                               | Ist                                                      | Beleg                                                   |
| ----------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------- |
| Signaturschlüssel des Unterzeichners                  | **keiner** — es gibt kein Schlüsselmaterial              | `signature-chain.ts:22-26` (nur `createHash("sha256")`) |
| Zertifikat / Identitätsnachweis                       | **keins** — Identität = Auth.js-Session                  | `sign/route.ts:25` `withAuth()`                         |
| Signaturerstellungsdaten unter alleiniger Kontrolle   | **nein** — der Server berechnet und schreibt alles       | `signature-provider.ts:427-466`                         |
| Nachträgliche Änderungserkennung am Dokument          | **teilweise** — Vergleich zweier DB-Spalten              | `signature-provider.ts:203-214, 417-425`                |
| Nachträgliche Änderungserkennung an der Signaturzeile | **teilweise** — 6 von ~20 Spalten sind gehasht           | `signature-chain.ts:30-39`                              |
| Vertrauenswürdiger Zeitstempel (RFC 3161)             | **nein** — `new Date().toISOString()` auf dem App-Server | `signature-provider.ts:427`                             |
| Willenserklärung / Zustimmungserfassung               | ja — Bestätigungsdialog + Legal Notice                   | `messages/de/document-signature.json:40`                |

**Einordnung:** Das ist eine **einfache elektronische Signatur** nach
Art. 3 Nr. 10 eIDAS. Für eine _fortgeschrittene_ Signatur (Art. 26) fehlen
mindestens zwei der vier Anforderungen (eindeutige Zuordnung über
Signaturerstellungsdaten unter alleiniger Kontrolle des Unterzeichners;
Verbindung mit den signierten Daten so, dass jede nachträgliche Änderung
erkennbar ist — Letzteres wird hier nur für 6 Metadatenfelder und nur gegen
einen nicht-autoritativen DB-Wert erreicht). Für eine _qualifizierte_ Signatur
fehlt zusätzlich alles (QSCD, QTSP-Zertifikat).

### 3.2 Was behauptet wird

| Ort                                                                       | Wortlaut                                                                                                               | Bewertung                        |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `apps/web/src/lib/documents/signature-provider.ts:7-8`                    | „in-house first (simple electronic signature per Art. 25 eIDAS, SHA-256 hash chain — no QES)"                          | korrekt                          |
| `apps/web/src/app/api/v1/signature-requests/[requestId]/sign/route.ts:10` | „The signature is a simple electronic signature (Art. 25 eIDAS)"                                                       | korrekt                          |
| `.../certificate/route.ts:93`                                             | „Elektronische Signatur i.S.d. Art. 25 eIDAS (einfache elektronische Signatur). Kein qualifiziertes Zertifikat (QES)." | korrekt                          |
| `docs/ALPHA_INVITE.md:183-185`                                            | „simple electronic signature (eIDAS Art. 25) … No qualified signatures (QES), no HSM, no …"                            | korrekt                          |
| `docs/qa-reports/wave19-n7-dms-scope-decision.md:102-103`                 | „What it is **not**: a qualified electronic signature (no HSM/CA)"                                                     | korrekt                          |
| `docs/STATUS.md:84, 92`                                                   | „einfache elektronische Signatur i.S.d. Art. 25 eIDAS, kein QES" / „Offen: kein QES/HSM (bewusst)"                     | korrekt                          |
| `messages/{de,en}/document-signature.json:40`                             | „… werden **revisionssicher** protokolliert" / „recorded in a **tamper-evident log**"                                  | **überzogen** → S06-03           |
| `messages/{de,en}/document-signature.json` `verify.valid`                 | „Signatur gültig — Hash-Kette und **Datei-Integrität verifiziert**"                                                    | **überzogen** → S06-04           |
| `.../certificate/route.ts:79`                                             | KPI „Datei-Integrität: **UNVERÄNDERT**"                                                                                | **überzogen** → S06-04           |
| `messages/de/common.json:4841,4845`                                       | „**Digitale Signatur**" / „Die digitale Signatur dient als Nachweis."                                                  | **falsch** → S06-02              |
| `(portal)/trust/[orgCode]/page.tsx:232`                                   | „Daten werden … at Rest (AES-256) verschlüsselt."                                                                      | **nicht implementiert** → S06-11 |

**Ergebnis der Sonderfrage:** Die Signaturklasse wird **nicht** überhöht
dargestellt. Die _Eigenschaften_ der Signatur (Revisionssicherheit,
Datei-Integrität, „digitale Signatur") werden überhöht dargestellt.
Zusätzlich ist die Fundstellenangabe durchgängig falsch: die einfache
elektronische Signatur ist in **Art. 3 Nr. 10** eIDAS definiert; **Art. 25**
regelt nur die Rechtswirkung/Nichtdiskriminierung. → S06-14.

---

## 4. Findings

### S06-01 — Freigegebene Dokumentversion wird beim Datei-Upload in-place überschrieben (High)

**Severity:** High — Umgehung von Segregation of Duties + Integritätsverlust der
Versionshistorie in einem Produkt, dessen DMS-Kernzusage die kontrollierte
Freigabe ist.

**Fundstelle:** `apps/web/src/app/api/v1/documents/[id]/upload/route.ts:215-228`

```ts
// Keep the current version's file snapshot in sync so restores of
// this version bring back the file that belonged to it.
if (currentVersion) {
  await db
    .update(documentVersion)
    .set({
      fileName: file.name,
      filePath: relativePath,
      fileSize: file.size,
      mimeType: file.type,
      fileSha256: sha256,
    })
    .where(eq(documentVersion.id, currentVersion.id));
}
```

**Angriffspfad (Eingabe → Wirkung):**

1. Dokument „IS-Richtlinie" durchläuft `draft → in_review → approved → published`.
   Beim Publish legt `status/route.ts:126-146` eine neue **Major-Version** v2.0 an;
   die Vier-Augen-Prüfung (`status/route.ts:92-114`, `checkFourEyes`) hat
   sichergestellt, dass Autor ≠ Freigebender.
2. Der **Autor selbst** (Rolle `process_owner` genügt, `upload/route.ts:49-55`)
   ruft `POST /api/v1/documents/{id}/upload` mit einer inhaltlich veränderten
   PDF auf.
3. Die Route prüft **weder `doc.status` noch `doc.legalHold` noch ein
   Vier-Augen-Prinzip**. Sie schreibt die neue Datei, und Zeile 217-228
   überschreibt `document_version.file_name / file_path / file_sha256` der
   **aktuellen, freigegebenen Version v2.0**.
4. Ergebnis: v2.0 trägt weiterhin `valid_from`, den Publish-Zeitpunkt und die
   Freigabe-Historie von v2.0 — hinter der Version steht aber eine andere Datei.
   Es entsteht **keine** neue Version, kein `in_review`, kein Approval.
   Alle Acknowledgments zu v2.0 (`acknowledgment.version_acknowledged >=
current_version`) bleiben gültig, obwohl die Nutzer etwas anderes bestätigt
   haben.

**Kontrast im selben Modul (belegt, dass es sich um einen Defekt und nicht um
eine Designentscheidung handelt):**

- `versions/[versionId]/restore/route.ts:9-10`: „Restore an old version by
  creating a NEW version … **History is never overwritten**."
- `[id]/route.ts:193-215`: eine Inhaltsänderung über `PUT` erzeugt korrekt eine
  neue Minor-Version.
  Nur der Datei-Pfad überschreibt.

**Zweiter Effekt — Akteur im Audit-Log NULL.** Die drei Schreibvorgänge in
Zeile 180-228 laufen über `db`, nicht über `withAuditContext`. Damit sind
`app.current_user_id / _email / _name` in der Transaktion nicht gesetzt
(`apps/web/src/lib/api.ts:292-316`, `set_config(..., true)` = transaktionslokal),
und der DB-Audit-Trigger schreibt sie als NULL (`audit_trigger()`:
`v_user_id := NULLIF(current_setting('app.current_user_id', true), '')::uuid`).

Reproduktion gegen die laufende DB
(`/work/audit/evidence/S06/audit_actor_null_repro.txt`):

```
 action | user_id | user_email |                     sha_change
--------+---------+------------+---------------------------------------------------
 create |         |            |
 update |         |            | {"new": "bbbb…", "old": "aaaa…"}
```

Der Hash-Tausch ist protokolliert, **wer ihn ausgelöst hat, nicht.**

**Kompensierende Kontrollen geprüft:**

- Vier-Augen bei `approve`/`publish` (`status/route.ts:92-114`) — greift hier
  nicht, weil kein Statuswechsel stattfindet. ✗
- Legal Hold (`erase/route.ts:46-55`) — nur gegen Löschung, nicht gegen Upload. ✗
- Signatur-Integritätsprüfung (`signature-provider.ts:417-425`) — erkennt die
  Änderung _nur_, wenn eine offene Signaturanforderung existiert, und nur beim
  nächsten Signaturversuch. ✗ als generelle Kontrolle.
- Audit-Trigger — protokolliert den Diff (✓), aber ohne Akteur (✗).

**Fix-Richtung:** Upload auf `status IN ('draft','in_review')` beschränken bzw.
bei freigegebenen Dokumenten eine neue Version erzwingen; `documentVersion`
nur beim Anlegen der Version befüllen; alle drei Schreibvorgänge in
`withAuditContext` und eine gemeinsame Transaktion nehmen.

---

### S06-02 — Ungeschlüsselter SHA-512-Hash wird dem Nutzer als „Digitale Signatur … dient als Nachweis" präsentiert (Medium)

**Severity:** Medium — Datenqualitäts-/Integritätsrisiko plus falsche
Rechtsbehauptung gegenüber dem Endnutzer in einem Compliance-Produkt.

**Fundstellen:**
`apps/web/src/app/api/v1/policies/my-pending/[distId]/acknowledge/route.ts:173-176`

```ts
// Generate signature hash: SHA-512(userId + distributionId + timestamp + documentHash)
const signatureHash = createHash("sha512")
  .update(`${ctx.userId}:${distId}:${now.toISOString()}:${documentHash}`)
  .digest("hex");
```

`apps/web/messages/de/common.json:4841,4845`

```json
"successDesc": "Ihre Bestätigung wurde gespeichert. Die digitale Signatur dient als Nachweis.",
"signatureHash": "Digitale Signatur"
```

(EN identisch, `apps/web/messages/en/common.json:4841`.)
Angezeigt in `apps/web/src/app/(dashboard)/my-policies/[distId]/page.tsx:238-243`,
exportiert in `api/v1/policies/distributions/[id]/export-pdf/route.ts:41`.

**Warum das keine digitale Signatur ist:** kein Schlüsselmaterial, kein
Zertifikat, kein HMAC, keine Kette. Alle vier Eingaben (`userId`, `distId`,
`timestamp`, `documentHash`) stehen in derselben Tabellenzeile bzw. sind
plattformweit bekannt. Jeder mit Schreibrecht auf `policy_acknowledgment` kann
eine Bestätigung erfinden oder rückdatieren und den passenden „Signatur"-Hash in
einer Zeile Code nachrechnen. Anders als `document_signature` gibt es hier
**keine Verkettung** — jede Zeile steht für sich.

**Zweiter Defekt — die „Signatur" bindet oft an nichts.**
`acknowledge/route.ts:151-162`:

```sql
SELECT COALESCE(
  encode(digest(COALESCE(dv.content, d.content, ''), 'sha256'), 'hex'),
  'no-content') as hash
```

Gehasht wird die **Textspalte** `document_version.content` / `document.content`,
nicht die angehängte Datei. Für eine als PDF verteilte Richtlinie (der Regelfall
im DMS: Inhalt liegt in `file_path`, `content` ist NULL) fällt der Ausdruck auf
`digest('')` zurück — einen **konstanten** Wert
(`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`).
Die „digitale Signatur" attestiert dann nachweislich nichts über das Dokument.

**Nicht im Hash enthalten und damit frei änderbar:** `ip_address`, `user_agent`,
`quiz_score`, `quiz_passed`, `read_duration_seconds`, `status` — also genau die
Felder, die den Nachweis inhaltlich tragen (`acknowledge/route.ts:184-194`).

**Kompensierende Kontrollen geprüft:** Audit-Trigger auf `policy_acknowledgment`
(live verifiziert, siehe `evidence/S06/claims_vs_implementation.txt`) — protokolliert
Änderungen, macht aber die Bezeichnung „digitale Signatur" nicht richtig.
RLS ENABLE+FORCE+5 Policies vorhanden.

**Fix-Richtung:** entweder umbenennen („Bestätigungs-Prüfsumme"/„Acknowledgment
Checksum") und den Nachweis-Satz streichen, oder auf denselben verketteten
Mechanismus wie `document_signature` heben und den Datei-Hash statt der
Content-Spalte einbeziehen.

---

### S06-03 — Signaturbeweisfelder (IP, User-Agent, Ablehnungsgrund) liegen außerhalb des Hash-Umfangs; die IP ist zusätzlich client-steuerbar (Medium)

**Severity:** Medium — die UI sagt dem Unterzeichner ausdrücklich zu, genau
diese Felder würden „revisionssicher protokolliert".

**Fundstelle 1 — Hash-Umfang.** `apps/web/src/lib/documents/signature-chain.ts:30-39`:

```ts
export interface SignaturePayload {
  documentId: string;
  versionId: string;
  fileSha256: string;
  signerUserId: string;
  signedAt: string;
  decision: SignatureDecision;
}
```

Die Tabelle `document_signature` (Migration `0375:88-109`) trägt darüber hinaus
`ip_address`, `user_agent`, `decline_reason`, `sign_order`, `status`,
`created_by`, `updated_by` — **keines davon geht in `content_hash` ein.**

**Fundstelle 2 — Zusage.** `apps/web/messages/de/document-signature.json:40`:

> „Mit dem Klick auf „Signieren" geben Sie eine elektronische Signatur i.S.d.
> Art. 25 eIDAS (einfache elektronische Signatur) ab. **Zeitpunkt, IP-Adresse
> und ein kryptografischer Hash des Dokuments werden revisionssicher
> protokolliert.**"

EN: „Timestamp, IP address and a cryptographic hash of the document are recorded
in a **tamper-evident log**." Von den drei genannten Feldern ist nur der
Zeitpunkt (`signedAt`) tatsächlich gehasht.

**Fundstelle 3 — IP client-steuerbar.**
`apps/web/src/app/api/v1/signature-requests/[requestId]/sign/route.ts:33-37`
(identisch in `decline/route.ts:39-43`):

```ts
const ipHeader =
  req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");
const ipAddress = ipHeader ? ipHeader.split(",")[0].trim().slice(0, 64) : null;
```

Es wird der **erste** Eintrag von `X-Forwarded-For` genommen — das ist per
Definition der vom Client selbst gesetzte Teil. Es gibt keine Trusted-Proxy-
Liste und kein Hop-Count.

**Angriffspfad:** Der Signer sendet
`POST /api/v1/signature-requests/{id}/sign` mit
`X-Forwarded-For: 203.0.113.9`. Die Signatur wird mit dieser IP gespeichert und
im Zertifikats-PDF unter „IP-Adresse" ausgegeben
(`certificate/route.ts:59-66`), direkt neben der KPI „Hash-Kette: **GÜLTIG**"
(`certificate/route.ts:73-76`) — weil die IP nicht Teil der Kette ist, bleibt die
Kette gültig. Ein Unterzeichner kann so die Behauptung „ich habe aus dem
Firmennetz signiert" beliebig konstruieren, und ein Dritter mit DB-Schreibrecht
kann IP und Ablehnungsgrund nachträglich austauschen, ohne die Kette zu brechen.

**Kompensierende Kontrollen geprüft:** Der Audit-Trigger auf `document_signature`
(live verifiziert) würde eine nachträgliche DB-Änderung der IP protokollieren —
die _Signatur selbst_ bleibt aber verifikationsseitig unauffällig, und gegen die
XFF-Spoofing-Variante beim Signieren greift gar nichts.

---

### S06-04 — Zertifikat und Verify behaupten geprüfte Datei-Integrität, vergleichen aber nur zwei Datenbankspalten (Medium)

**Severity:** Medium (Grenzfall zu High) — der Nachweis, den das Produkt als
Ergebnis der Signaturzeremonie ausgibt, trifft eine Aussage, die er nicht
erhoben hat.

**Fundstelle — was geprüft wird.**
`apps/web/src/lib/documents/signature-provider.ts:203-214`:

```ts
/** Live file hash of the frozen version (fallback: document inline hash). */
async function loadLiveFileSha(versionId: string): Promise<string | null> {
  const [row] = await db
    .select({ versionSha: documentVersion.fileSha256, docSha: document.fileSha256 })
    …
  return row ? (row.versionSha ?? row.docSha ?? null) : null;
}
```

und `signature-provider.ts:718-719`:

```ts
const currentFileSha256 = row.versionSha ?? row.docSha ?? null;
const fileIntegrityValid = currentFileSha256 === req.fileSha256;
```

`req.fileSha256` wurde bei Anforderung ebenfalls aus `documentVersion.fileSha256`
kopiert (`signature-provider.ts:289-308`). Es werden also **zwei
Datenbankspalten miteinander verglichen**; die im Objektspeicher liegenden Bytes
werden auf diesem Pfad **nie gelesen und nie neu gehasht**.

**Fundstelle — was behauptet wird.**
`.../certificate/route.ts:77-81`:

```ts
        {
          label: "Datei-Integrität",
          value: report.fileIntegrityValid ? "UNVERÄNDERT" : "VERÄNDERT",
          trend: report.fileIntegrityValid ? "ok" : "crit",
        },
```

`apps/web/messages/de/document-signature.json` → `verify.valid`:
„Signatur gültig — Hash-Kette und **Datei-Integrität verifiziert**"
(EN: „hash chain and file integrity verified").

**Angriffspfad:** Wer die Bytes im Objektspeicher unter dem Key
`{orgId}/{docId}/{uuid}-{name}` austauscht, ohne die DB anzufassen — etwa über
den in S06-09 beschriebenen MinIO-Pfad, über kompromittierte S3-Zugangsdaten,
über einen Backup-Restore einzelner Objekte oder über Host-Zugriff bei
`STORAGE_BACKEND=local` — erhält:
`GET /signature-requests/{id}/verify` → `valid: true`,
Zertifikats-PDF → „Datei-Integrität: UNVERÄNDERT", „Gesamtergebnis: GÜLTIG",
und `GET /documents/{id}/download` liefert die getauschten Bytes aus
(`download/route.ts:57-69` — kein Hash-Vergleich auf dem Lesepfad).

**Kompensierende Kontrolle geprüft:**
`apps/web/src/app/api/v1/documents/[id]/verify-integrity/route.ts:55-64` **hasht
die gespeicherten Bytes tatsächlich neu**:

```ts
const buffer = await getFileStorage().get(doc.filePath);
actual = createHash("sha256").update(buffer).digest("hex");
```

Damit existiert die richtige Prüfung — sie ist aber (a) ein **separater,
manuell aufzurufender Endpunkt**, (b) sie prüft `document.filePath` (den Kopf),
**nicht** `document_version.file_path` der signierten Version, und (c) sie ist
**nicht** in `verify()` bzw. in das Zertifikat verdrahtet. Die Kontrolle
existiert, greift aber genau dort nicht, wo die Aussage getroffen wird →
Finding bleibt bestehen, wird wegen der vorhandenen Bausteine aber auf Medium
gehalten.

**Fix-Richtung:** `verify()` re-hasht die Bytes der signierten Version über
`getFileStorage()` und meldet einen dritten Zustand („Datei nicht prüfbar",
wenn das Objekt fehlt); Zertifikat gibt Soll-, Ist- und Prüfzeitpunkt aus.

---

### S06-05 — Kein vertrauenswürdiger Zeitstempel für Signaturen, obwohl RFC-3161-Anbindung im Produkt vorhanden ist (Medium)

**Severity:** Medium — die Zeitangabe ist bei einer einfachen elektronischen
Signatur der wesentliche Beweiswert, und die Zusage „revisionssicher" bezieht
sich ausdrücklich auf sie.

**Fundstelle:** `apps/web/src/lib/documents/signature-provider.ts:427`

```ts
const signedAtIso = new Date().toISOString();
```

Dieser Wert geht in den `content_hash` ein und wird als `signed_at` gespeichert.
Er stammt aus der Systemuhr des App-Containers und ist durch nichts gedeckt:
kein RFC-3161-Token, kein Anker, keine externe Quelle.

**Warum das auffällt:** Die Plattform _hat_ eine RFC-3161-Anbindung —
`packages/shared/src/lib/freetsa.ts`, `apps/worker/src/crons/daily-audit-anchor.ts`,
`apps/web/src/app/api/v1/audit-log/anchor/route.ts`, dokumentiert in
`docs/ADR-011-rev3.md:21`. Sie verankert den **`audit_log`**, nicht die
Signaturkette. Der Signaturzeitpunkt selbst bleibt unverankert, obwohl der
Baustein vorhanden ist. Die Signaturkette hat auch keinen Bezug in den
verankerten Audit-Trail hinein (kein `chain_hash` im `audit_log`-Eintrag —
lediglich der generische Zeilendiff des Triggers).

**Wirkung:** Wer die Systemuhr des App-Containers oder `signed_at` per DB-Write
verschiebt und `content_hash`/`chain_hash` neu rechnet (beides ohne Schlüssel,
`signature-chain.ts:24-26`), erzeugt eine Signaturzeremonie mit beliebigem
Datum, die die eigene Verifikation als „GÜLTIG" ausweist.

**Kompensierende Kontrolle geprüft:** Der Audit-Trigger auf `document_signature`
schreibt bei einer nachträglichen `UPDATE` einen Diff in den (verankerten)
`audit_log` — das ist die real greifende Absicherung. Sie deckt aber nicht die
Fälschung _beim_ Signieren (falsche Serverzeit) ab und macht den Zeitstempel
nicht zu einem qualifizierten oder auch nur unabhängigen.

**Fix-Richtung:** `sign()` holt bei Abschluss ein FreeTSA-Token über den
bestehenden Helper und speichert es neben dem `chain_hash`; Zertifikat weist es
aus. Alternativ: den `chain_hash` jedes Glieds explizit in einen
`audit_log`-Eintrag mit `action_detail='signature_chain_anchor'` schreiben,
damit die Signatur an der bereits verankerten Kette hängt.

---

### S06-06 — Controlled-Copy-Wasserzeichen ist durch eine nicht ladbare PDF vollständig und unprotokolliert umgehbar (High)

**Severity:** High — unvalidierter Input auf einem sicherheitsrelevanten Pfad
schaltet eine verkaufte Kontrolle ab und entfernt gleichzeitig den zugehörigen
Audit-Eintrag. Auslösbar von jedem Nutzer mit Upload-Recht, nutzbar von jedem
Nutzer mit DMS-Zugriff, ohne Sonderrolle und ohne `?raw=1`.

**Fundstelle:** `apps/web/src/app/api/v1/documents/[id]/download/route.ts:106-132`
(identisch `documents/[id]/files/[fileId]/download/route.ts:117-142`):

```ts
    try {
      buffer = await stampControlledCopy(buffer, { … });
      controlledCopy = "watermarked";
    } catch {
      // Corrupt/encrypted PDF — serve the original and flag it instead
      // of blocking the download.
      controlledCopy = "error";
    }
  }

  if (controlledCopy === "watermarked") {
    // Audit trail: controlled-copy issuance is compliance-relevant.
    await recordControlledCopyDownload(ctx, { … });
  }
```

`apps/web/src/lib/documents/pdf-watermark.ts:67`:
`const doc = await PDFDocument.load(new Uint8Array(pdfBytes));`
— ohne `{ ignoreEncryption: true }`, also wirft pdf-lib bei **jeder**
verschlüsselten PDF.

**Angriffspfad (reproduziert):**

1. Eine PDF wird mit **reinem Owner-Passwort** (Berechtigungsschutz, kein
   Öffnen-Passwort) versehen — der in Unternehmen häufigste PDF-Schutz, erzeugt
   von Word/Acrobat/qpdf mit einem Klick. Die Datei **öffnet in jedem
   Reader ohne Passworteingabe**.
2. Upload über `POST /documents/{id}/upload` — MIME `application/pdf` ist
   erlaubt (`upload/route.ts:16-33`), ClamAV schlägt nicht an.
3. Dokument wird auf `published` gesetzt.
4. **Jeder** Nutzer mit `dms`-Modulzugriff ruft
   `GET /api/v1/documents/{id}/download` auf und erhält die **Originalbytes ohne
   Wasserzeichen**, Header `X-Controlled-Copy: error`.
5. `recordControlledCopyDownload` wird **nicht** aufgerufen → der Bezug der
   unkontrollierten Kopie steht in **keinem** Log.

Reproduktion (`/work/audit/evidence/S06/watermark_bypass_encrypted_pdf.txt`,
PoC-Datei `evidence/S06/poc_owner_pw_only.pdf`, pdf-lib 1.17.1):

```
unverschluesselt -> STAMPED (1016 bytes)
owner-pw-only (oeffnet ohne Passwort in jedem Reader)
  -> stampControlledCopy WIRFT Error: Input document to `PDFDocument.load` is encrypted.
```

**Das Verhalten ist als Soll getestet** —
`apps/web/src/__tests__/api/documents-controlled-copy.test.ts:214-226`:

```ts
  it("serves original bytes with X-Controlled-Copy: error when stamping fails", async () => {
    …
    expect(res.headers.get("X-Controlled-Copy")).toBe("error");
    expect(body.equals(corrupt)).toBe(true);
    expect(recordControlledCopyDownload).not.toHaveBeenCalled();
  });
```

Die Verfügbarkeitsentscheidung (lieber ausliefern als blockieren) ist
nachvollziehbar; dass der auslösende Input vom Nutzer stammt und der
Audit-Eintrag mit entfällt, offenbar nicht.

**Kompensierende Kontrollen geprüft:**

- `X-Controlled-Copy: error` wird gesetzt — aber **kein einziger Client wertet
  den Header aus** (`grep -rn "X-Controlled-Copy\|controlledCopy" --include=*.tsx
apps/web/src` → 0 Treffer). Der Zustand ist für Nutzer und Betreiber unsichtbar. ✗
- Kein Alarm, kein Log, kein Health-Check auf den Fehlerzweig. ✗

**Fix-Richtung:** `PDFDocument.load(bytes, { ignoreEncryption: true })` deckt den
Owner-Passwort-Fall ab; für den Rest: Fehlerzweig protokollieren
(`recordControlledCopyDownload` mit `watermarked: false`) und entweder auf
`admin`/Dokumentenlenkung beschränken oder mit 422 abweisen. Zusätzlich beim
Upload prüfen, ob die PDF stempelbar ist, und sonst schon dort ablehnen.

---

### S06-07 — Wasserzeichen greift nur bei `status='published'`; archivierte und abgelaufene Fassungen werden unmarkiert ausgeliefert (Medium)

**Severity:** Medium — betrifft genau die Dokumentstände, deren
unmarkiertes Zirkulieren im Dokumentenlenkungs-Sinn am schädlichsten ist.

**Fundstelle:** `apps/web/src/app/api/v1/documents/[id]/download/route.ts:79-80`

```ts
// Default: published PDFs leave the DMS only as marked copies.
let watermark = isPdf && (doc.status === "published" || forceWatermark);
```

Statuswerte laut `packages/db/src/schema/document.ts:54-61`:
`draft`, `in_review`, `approved`, `published`, `archived`, `expired`.

**Angriffspfad / Fehlerszenario:** Eine Richtlinie v2.0 wird durch v3.0 abgelöst
und auf `archived` gesetzt (bzw. läuft über `expires_at` auf `expired`).
`GET /documents/{id}/download` liefert die PDF ab diesem Moment **ohne**
Wasserzeichen und **ohne** Audit-Eintrag an jeden Nutzer mit DMS-Zugriff. Die
ausgedruckte Kopie trägt keinerlei Hinweis darauf, dass sie eine **ungültige**
Fassung ist — der Fußzeilentext „Unkontrollierte Kopie nach Ausdruck"
(`pdf-watermark.ts:53`) fehlt gerade dort, wo er inhaltlich am nötigsten wäre.
Für `approved` (freigegeben, aber noch nicht veröffentlicht) gilt dasselbe.

**Kompensierende Kontrolle geprüft:** `?watermarked=1` erzwingt den Stempel —
ist aber ein optionaler Query-Parameter, den der Client setzen müsste; die UI
ruft ihn im Standard-Download nicht. ✗

---

### S06-08 — Der Bezug des unmarkierten Originals (`?raw=1`) wird nicht protokolliert, der markierte Download schon (Medium)

**Severity:** Medium — die Beweislogik ist invertiert: gerade der
unkontrollierte Bezug hinterlässt keine Spur.

**Fundstelle:** `apps/web/src/app/api/v1/documents/[id]/download/route.ts:81-88`
gegen `:123-132`:

```ts
  if (wantsRaw) {
    const roleCheck = requireRole("admin", "quality_manager")(ctx.session, ctx.orgId);
    if (roleCheck) return roleCheck;
    watermark = false;
  }
  …
  if (controlledCopy === "watermarked") {
    // Audit trail: controlled-copy issuance is compliance-relevant.
    await recordControlledCopyDownload(ctx, { … });
  }
```

`recordControlledCopyDownload` läuft ausschließlich im Zweig `watermarked`.
Der Routen-Kommentar (`:21-22`) sagt: „Watermarked downloads are recorded in the
audit log (who, when, which version) so controlled distribution is
demonstrable." — der **un**kontrollierte Bezug ist nicht demonstrierbar.

Im Testfall festgehalten
(`__tests__/api/documents-controlled-copy.test.ts:187-198`):
`expect(recordControlledCopyDownload).not.toHaveBeenCalled();` für `?raw=1`.

**Fehlerszenario:** Ein Org-Admin zieht die pristine Fassung sämtlicher
freigegebener Richtlinien über `?raw=1`. Weder ein Audit-Eintrag noch ein
Zähler noch ein Alarm entsteht. Bei einer späteren Untersuchung eines
Dokumentenabflusses ist der wahrscheinlichste Weg der einzige, der nicht
belegt ist.

**Fix-Richtung:** `recordControlledCopyDownload` auch im `raw`- und im
`error`-Zweig aufrufen, mit `actionDetail: 'uncontrolled_copy_download'`.

---

### S06-09 — MinIO-Sidecar mit unpatchbaren CRITICAL-CVEs bleibt neben Garage definiert; der Download-Pfad verifiziert nie den Datei-Hash (Medium)

**Severity:** Medium — Angriffsvoraussetzung ist Zugriff auf das Docker-Netz
(SSRF, Container-Foothold); die Wirkung ist stilles Ausliefern getauschter
Dokumentbytes. Cross-Ref S08 (Lieferkette) und S04 (SSRF).

**Fundstelle:** `docker-compose.production.yml:95-107`

```yaml
minio:
  # #SEC-IMG (Pentest v2 / Trivy): der vorherige Tag … 4 CRITICAL + 42 HIGH — u.a. unauthentifizierter
  # Object-Write (CVE-2026-40344/-41145), OIDC-JWT-Algorithm-Confusion
  # (CVE-2026-33322) und Session-Policy-Privilege-Escalation (CVE-2025-62506).
  # …
  # Die reinen 2026-CVEs (unauth write CVE-2026-40344/-41145, JWT CVE-2026-33322)
  # haben im Community-Zweig ggf. KEINEN Fix mehr …
  image: minio/minio:RELEASE.2025-10-15T17-29-55Z
```

Der Garage-Block (`:62-89`, Commit `a8d1414f`) läuft laut Kommentar
„zunächst **PARALLEL** zu minio; nach verifizierter Umstellung wird der
minio-Block entfernt" — die Umstellung ist im Repo nicht vollzogen. Der
verwundbare Dienst bleibt Teil der ausgelieferten Produktionskonfiguration,
inkl. `minio-init` (`:128-147`).

**Angriffspfad:** Unauthentifizierter Object-Write im MinIO-Netz →
`PUT arctos-dms/{orgId}/{docId}/{uuid}-policy.pdf` mit fremdem Inhalt. Der
Lesepfad prüft nichts:
`download/route.ts:57-69` holt `storage.get(doc.filePath)` und liefert die Bytes
aus — **ohne** Abgleich gegen `doc.fileSha256`, obwohl derselbe Handler den
Hash zwei Zeilen später als `X-File-SHA256`-Header **behauptet**
(`download/route.ts:158-163`). Der Header ist damit eine Zusicherung, die nie
verifiziert wurde. Gleichzeitig meldet die Signaturverifikation weiterhin
„UNVERÄNDERT" (S06-04).

**Kompensierende Kontrollen geprüft:** Keine Port-Exposition nach außen
(`:126-127`, `:89`), das ist real und begrenzt die Severity. `verify-integrity`
existiert als manueller Nachweis (S06-04). Ein automatischer Integritätslauf
(Cron) existiert nicht — geprüft in `apps/worker/src/crons/` (nur
`document-retention-purge.ts` berührt Storage).

**Fix-Richtung:** MinIO-Block entfernen, sobald Garage produktiv ist; Hash-Abgleich
im Download-Pfad (mindestens Warnung + Audit-Eintrag bei Abweichung);
periodischer Integritäts-Cron über alle Dokumente mit `file_sha256`.

---

### S06-10 — Keine Mandantentrennung im Objektspeicher: ein Bucket, ein Schlüsselpaar, Trennung nur über das App-seitige Key-Präfix (Medium)

**Severity:** Medium — keine zweite Verteidigungslinie unter der
Applikationslogik; ein Fehler in der Pfadkonstruktion oder ein geleaktes
Schlüsselpaar exponiert **alle** Mandanten.

**Fundstelle:** `docker-compose.production.yml:239-245` (Web) und `:326-332`
(Worker) — je genau ein `S3_BUCKET`, ein `S3_ACCESS_KEY_ID`, ein
`S3_SECRET_ACCESS_KEY` für die gesamte Installation.
`packages/shared/src/lib/file-storage.ts:277-320` kennt keinen Org-Parameter;
`S3Storage` signiert alles mit demselben Schlüssel.
`minio-init` legt genau einen Bucket an (`:137-139`).

Die einzige Mandantengrenze ist das Key-Präfix, das die Upload-Route baut
(`upload/route.ts:99-103`, `{orgId}/{docId}/{uuid}-{name}`), plus die
Zeilenprüfung `eq(document.orgId, ctx.orgId)` in den Download-Routen.

**Fehlerszenario:** Jeder Codepfad, der künftig einen `file_path` aus einer
anderen Quelle als der eigenen Org-Zeile bezieht (Import, Kopieren von
Dokumenten zwischen Orgs, Report-Generator, AI-Retrieval), liest ohne weitere
Prüfung Objekte fremder Mandanten. Der Objektspeicher selbst kann das nicht
verhindern — es gibt weder Bucket-per-Org noch Prefix-gebundene Zugangsdaten
noch eine Bucket-Policy.

**Kompensierende Kontrollen geprüft (und wirksam, daher Medium statt High):**

- `filePath` ist in **keinem** Zod-Schema der DMS-Routen enthalten — geprüft
  über `packages/shared/src/schemas/`; die einzige `filePath`-Definition liegt in
  `control.ts:302` (anderer Pfad). Nutzer können den Key nicht setzen. ✓
- `LocalFsStorage.resolveKey` (`file-storage.ts:72-80`) verweigert Traversal. ✓
- Alle DMS-Tabellen: RLS ENABLE + FORCE + Policies, live verifiziert. ✓
- Keine Presigned URLs, kein Client-seitiger Storage-Zugriff
  (`deploy/garage/garage.toml:6-9`: „no multipart, no presigned URLs"). ✓

**Fix-Richtung:** Bucket oder mindestens prefix-gebundene Credentials pro
Mandant (Garage kann Bucket-Aliase + Key-Scoping); alternativ ein
`assertKeyBelongsToOrg(key, ctx.orgId)` als Pflichtdurchgang in `getFileStorage()`.

---

### S06-11 — Trust-Portal behauptet Verschlüsselung at rest (AES-256); implementiert ist keine (Medium)

**Severity:** Medium — die Aussage steht auf einer öffentlich erreichbaren
Vertrauensseite, die Kunden im Beschaffungsprozess vorgelegt wird.

**Fundstelle — Behauptung:**
`apps/web/src/app/(portal)/trust/[orgCode]/page.tsx:229-233`

```tsx
              {
                title: "Verschlüsselung",
                desc: "Daten werden im Transit (TLS 1.3) und at Rest (AES-256) verschlüsselt.",
              },
```

**Fundstelle — Implementierung:** `packages/shared/src/lib/file-storage.ts:217-227`

```ts
  async put(key: string, data: Buffer, meta?: FileStorageMeta): Promise<void> {
    const res = await this.request(
      "PUT", key, data, meta?.contentType ?? "application/octet-stream",
    );
```

Es wird **kein** `x-amz-server-side-encryption`-Header gesetzt
(`grep -rn "server-side-encryption\|x-amz-server-side" packages/ apps/` → 0
Treffer), und die Nutzdaten werden vor dem `put` nicht verschlüsselt. Der
`local`-Backend schreibt Klartext-Dateien (`file-storage.ts:82-86`). Garage
bietet keine Server-Side-Encryption per Default (`deploy/garage/garage.toml` —
keine Verschlüsselungssektion). Damit liegen sämtliche DMS-Dokumente,
inklusive Hinweisgeber-Anhängen und personenbezogenen Unterlagen, unverschlüsselt
auf dem Volume.

Zusatz zum „im Transit": `.env.example:149` und
`docker-compose.production.yml` verwenden `http://minio:9000` bzw. Garage über
`http` — SigV4 signiert die Anfrage, verschlüsselt sie aber nicht. Innerhalb des
Docker-Netzes vertretbar, deckt die Aussage „TLS 1.3" aber nicht ab.

**Anmerkung zur Abgrenzung:** Auf Volume-/Disk-Ebene _kann_ der Betreiber LUKS
o. Ä. einsetzen — das ist eine Betreibermaßnahme, keine Produkteigenschaft, und
wird auf der Trust-Seite als Produktzusage formuliert. Andere Datenpfade
(Whistleblowing, Connector-Credentials) sind sehr wohl applikativ mit AES-256-GCM
verschlüsselt (`packages/shared/src/wb-crypto.ts`, `secret-crypto.ts`) — die
Inkonsistenz ausgerechnet beim DMS ist auffällig.

---

### S06-12 — Die Dokumentenlenkungs-Rolle `quality_manager` existiert im Code, aber nicht im DB-Enum (Medium)

**Severity:** Medium — die Rollenprüfung, um die herum die Controlled-Copy-
Funktion entworfen ist, ist im ausgelieferten Schema unerfüllbar.

**Fundstelle — Prüfung:**
`apps/web/src/app/api/v1/documents/[id]/download/route.ts:18-19, 82-84`

```
//   - ?raw=1 returns the original bytes — restricted to
//     admin / quality_manager (the document-control owners)
…
    const roleCheck = requireRole("admin", "quality_manager")(ctx.session, ctx.orgId);
```

**Fundstelle — Code-Enum:** `packages/db/src/schema/platform.ts:54`
enthält `"quality_manager"` (dort insgesamt 20+ Werte).

**Fundstelle — Live-DB:**

```
$ psql -Atc "SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
             WHERE t.typname='user_role' ORDER BY e.enumsortorder"
admin risk_manager control_owner auditor dpo process_owner viewer
whistleblowing_officer vendor_manager
```

`quality_manager` fehlt — ebenso `ciso`, `compliance_officer`, `bcm_manager`,
`contract_manager`, `security_analyst`, `department_head`, `external_auditor`,
`esg_manager`, `esg_contributor`, `ombudsperson`. Die Migration, die den Wert
ergänzt (`packages/db/drizzle/0096_additional_system_roles.sql:12`,
`ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'quality_manager'`), ist im
Migrationslauf nicht wirksam geworden (Ursache: BASE-002, 43 dauerhaft
fehlschlagende Migrationen — Root-Cause gehört zu S09).

**Wirkung im S06-Scope:**

- Der `quality_manager`-Zweig von `?raw=1` ist **toter Code**: faktisch
  „admin only". Die im Routen-Kommentar benannten „document-control owners"
  können ihre Funktion nicht ausüben.
- Dasselbe trifft `POST /api/v1/processes/[id]/sign-off`
  (`processes/[id]/sign-off/route.ts:22`) und die Rollenauswahl in
  `components/process/process-sign-off-tab.tsx:136`, die
  `quality_manager` als Signer-Rolle anbietet — ein Nutzer kann diese Rolle
  nie besitzen.

---

### S06-13 — Keine Aufgabentrennung in der Signaturzeremonie: Ersteller und alleiniger Signer dürfen dieselbe Person sein (Medium)

**Severity:** Medium — erzeugt ein Zertifikats-PDF, das wie eine unabhängige
Bestätigung aussieht, obwohl es eine Selbstbestätigung ist.

**Fundstelle:**
`apps/web/src/app/api/v1/documents/[id]/signature-requests/route.ts:42-48`
erlaubt `admin, risk_manager, control_owner, dpo, process_owner` das Anlegen.
`signature-provider.ts:256-330` (`createRequest`) prüft: keine doppelten Signer,
alle Signer Org-Mitglieder, Dokument hat eine Datei — **keine** Prüfung gegen
`ctx.userId`, gegen `document.createdBy` oder gegen den Autor der Version.

Der Fall ist im Code sogar ausdrücklich vorgesehen
(`signature-provider.ts:366-368`):

```ts
        const toNotify = input.sequential ? signatures.slice(0, 1) : signatures;
        for (const sig of toNotify) {
          if (sig.signerUserId === ctx.userId) continue;
```

— der Ersteller wird als Signer erwartet und lediglich von der eigenen
Benachrichtigung ausgenommen.

**Fehlerszenario:** Ein `process_owner` erstellt das Dokument, lädt die Datei
hoch, legt eine Signaturanforderung mit **sich selbst als einzigem Signer** an
und signiert. Ergebnis: Header-Badge „Signiert"
(`document-signatures-tab.tsx`), `GET …/verify` → `valid: true`,
Zertifikats-PDF mit „Gesamtergebnis: GÜLTIG". Für einen externen Prüfer ist
dem Zertifikat nicht anzusehen, dass Anforderer und Unterzeichner identisch sind
— es führt Signer-Name, Zeitpunkt, IP und Chain-Hash auf, aber nicht den
Anforderer (`certificate/route.ts:30-98`).

**Kompensierende Kontrolle geprüft:** Der Freigabe-Pfad (`status/route.ts:92-114`)
erzwingt Vier-Augen für `approve` und `publish` — die Signaturzeremonie ist davon
unabhängig und kennt keine entsprechende Prüfung. Weil die Freigabe geschützt
bleibt, Medium statt High.

**Fix-Richtung:** Analog `checkFourEyes` mindestens warnen bzw. konfigurierbar
verbieten, dass `createdBy` ∈ Signer-Menge ist; Anforderer im Zertifikat ausweisen.

---

### S06-14 — Inhalt eines freigegebenen Dokuments ist ohne Statuswechsel und ohne Vier-Augen-Prüfung änderbar (Medium)

**Severity:** Medium — der Freigabe-Workflow ist umgehbar, ohne ihn zu berühren.

**Fundstelle:** `apps/web/src/app/api/v1/documents/[id]/route.ts:74-82` (Auth)
und `:193-215`:

```ts
    // D1: auto-version on content change — minor bump (draft edit).
    if (contentChanged) {
      const created = await createDocumentVersion(tx, {
        …
        bump: "minor",
        content: body.data.content ?? null,
```

Die Route prüft `existing.status` an keiner Stelle. Ein `process_owner` ändert
den Inhalt eines `published`-Dokuments; es entsteht v2.1 mit `is_current=true`,
der Dokumentstatus bleibt `published`, die neue Fassung ist **sofort** die
ausgelieferte. `checkFourEyes` (`status/route.ts:92-114`) läuft nur bei
Statusübergängen und wird nie erreicht.

Der Kommentar im Code („minor bump (**draft edit**)") beschreibt eine Annahme,
die die Implementierung nicht durchsetzt.

**Abgrenzung zu S06-01:** Hier bleibt die Historie intakt (neue Version), nur die
Freigabe-Governance wird übersprungen. Bei S06-01 wird zusätzlich die Historie
überschrieben. Beide Routen brauchen dieselbe Statusprüfung.

---

### S06-15 — Trunkierung der Signaturkette am Ende ist nicht erkennbar; die Testsuite prüft nur das mittlere Glied (Low)

**Severity:** Low — erfordert DB-Schreibrecht, wird vom Audit-Trigger erfasst;
relevant, weil es die Aussagekraft der Verifikation begrenzt und die Tests einen
falschen Eindruck von Vollständigkeit erzeugen.

**Fundstelle:** `apps/web/src/lib/documents/signature-chain.ts:100-122`

```ts
export function verifySignatureChain(rowsChrono: SignatureChainRow[]) {
  …
  let prev: string | null = null;
  for (let i = 0; i < rowsChrono.length; i++) {
```

Die Verifikation läuft vom Anfang vorwärts und kennt keine erwartete Länge, kein
Endglied und keinen Abschluss-Marker. **Jedes Präfix einer gültigen Kette ist
selbst eine gültige Kette.**

**Fehlerszenario:** Von drei Gliedern wird das **letzte** gelöscht — etwa das
`declined`-Glied, das die Zeremonie zum Scheitern gebracht hat. `verify()` baut
seine `chainRows` ausschließlich aus den vorhandenen Zeilen
(`signature-provider.ts:683-707`) und meldet `chainValid: true`, `brokenAt: null`.
Das Zertifikat zeigt „Hash-Kette: GÜLTIG" für eine unvollständige Zeremonie; der
abgelehnte Signer erscheint gar nicht mehr in der Signer-Liste (die Slot-Zeile
verschwindet mit).

**Testlücke:** `apps/web/src/__tests__/lib/document-signature-chain.test.ts:120-126`
prüft ausschließlich die Löschung des **mittleren** Glieds
(`const truncated = [rows[0], rows[2]]`). Ein Test für
`[rows[0], rows[1]]` fehlt — er würde `ok: true` liefern und die Lücke sichtbar
machen.

**Fix-Richtung:** `document_signature_request` um `signature_count` bzw. einen
`final_chain_hash` beim Abschluss ergänzen und in `verify()` gegen die Anzahl der
Slots prüfen.

---

### S06-16 — `document_signature` ist nicht append-only, obwohl die Migration sie so bezeichnet (Low)

**Severity:** Low — die faktisch wirksame Absicherung (Audit-Trigger auf
verankerter Kette) ist vorhanden; die Bezeichnung und die daraus abgeleitete
Erwartung sind es, die nicht stimmen.

**Fundstelle:** `packages/db/drizzle/0375_document_signature.sql:113-114`

```sql
COMMENT ON COLUMN document_signature.chain_hash IS
  'SHA-256(previous_chain_hash || content_hash) — Glied der Append-Only-Kette pro Request';
```

Es existiert **kein** UPDATE/DELETE-blockierender Trigger, keine Rule und kein
`REVOKE UPDATE, DELETE ON document_signature FROM grc_app` — geprüft in 0375
und live (`SELECT tgname … WHERE relname='document_signature'` liefert nur
`document_signature_audit_trigger`). Die Applikation selbst benötigt UPDATE
(`sign()` aktualisiert den pending-Slot, `signature-provider.ts:441-460`), das
Recht ist also zwingend vorhanden.

Da die Kette **ungeschlüsselt** ist (`signature-chain.ts:24-26`, reines
`createHash("sha256")`), kann jeder Akteur mit diesem UPDATE-Recht eine
Zeremonie beliebig umschreiben und die Kette vollständig neu berechnen. Die
Kette schützt gegen _versehentliche_ Inkonsistenz und gegen einen Angreifer, der
nur einzelne Zeilen ändert — nicht gegen einen, der das Schema kennt.

**Kompensierende Kontrolle (wirksam):** Der Audit-Trigger auf `document_signature`
schreibt jeden UPDATE-Diff in den `audit_log`, der seinerseits gehashkettet und
per FreeTSA verankert ist (`ADR-011-rev3`, `apps/worker/src/crons/daily-audit-anchor.ts`).
Das ist die eigentliche Tamper-Evidence. Sie wird in der Signatur-UI aber nicht
referenziert — die Zusage „revisionssicher" (S06-03) stützt sich auf die
Signaturkette, nicht auf den Anker.

---

### S06-17 — Der Wasserzeichen-Test prüft nie, ob der Fußzeilentext tatsächlich im PDF landet (Low)

**Severity:** Low — Wartbarkeit / Belastbarkeit des Sicherheitsnetzes, das die
Remediation absichern soll.

**Fundstelle:** `apps/web/src/__tests__/lib/pdf-watermark.test.ts:48-57`

```ts
it("stamps every page and grows the PDF", async () => {
  const original = await makeTestPdf(3);
  const stamped = await stampControlledCopy(original, info);
  expect(stamped.length).toBeGreaterThan(original.length);
  const reloaded = await PDFDocument.load(new Uint8Array(stamped));
  expect(reloaded.getPageCount()).toBe(3);
});
```

Geprüft werden Byte-Länge und Seitenzahl. Eine Regression, die den Text leer
lässt, ihn außerhalb der Seitenfläche zeichnet (`y: 10` ist bereits sehr knapp,
`pdf-watermark.ts:85-91`) oder die Kürzungsschleife (`:76-84`) auf zwanzig Zeichen
eindampft, lässt beide Assertions bestehen. Auch der Fall „Text wird nur auf
Seite 1 gezeichnet" würde nicht auffallen — die Byte-Länge steigt trotzdem.

Ebenfalls ungetestet: der in S06-06 belegte Fall der verschlüsselten PDF (der
Test `:69-73` nutzt `Buffer.from("not a pdf")`, also ein syntaktisch kaputtes
Dokument, nicht ein valides verschlüsseltes).

**Fix-Richtung:** Text nach dem Stempeln extrahieren (`pdf-lib` liefert keinen
Extractor; über den vorhandenen `extractFileText`-Helper aus
`apps/web/src/lib/documents/extract-text.ts` möglich) und
`Unkontrollierte Kopie nach Ausdruck` je Seite assertieren.

---

### S06-18 — Vollständiger Dateiinhalt im Heap auf allen Upload- und Download-Pfaden (Low)

**Severity:** Low — kein Angriffspfad im engeren Sinn, aber ein
Verfügbarkeitsrisiko mit klarem Auslöser.

**Fundstellen:**

- `packages/shared/src/lib/file-storage.ts:229-234` — `Buffer.from(await res.arrayBuffer())`
- `apps/web/src/app/api/v1/documents/[id]/download/route.ts:165` — `new Response(new Uint8Array(buffer))`
- `apps/web/src/app/api/v1/documents/[id]/upload/route.ts:105` — `Buffer.from(await file.arrayBuffer())`
- zusätzlich beim Wasserzeichen: `pdf-lib` hält Original + Kopie gleichzeitig
  (`pdf-watermark.ts:67, 94`)

Maximale Dateigröße 50 MB (`upload/route.ts:14`), Web-Container `mem_limit: 1600m`
(`docker-compose.production.yml:159`). Ein Dutzend paralleler Downloads
freigegebener 50-MB-PDFs (jeweils Original + gestempelte Kopie im Speicher)
reicht rechnerisch für ein OOM des Web-Containers. Es gibt weder Streaming noch
ein Concurrency-Limit auf diesen Routen.

---

### S06-19 — `restore` teilt den Storage-Key mit der Quellversion; Löschvorgänge treffen dann beide Versionen (Low)

**Severity:** Low — Datenverlustrisiko, kein Sicherheitsproblem.

**Fundstelle:**
`apps/web/src/app/api/v1/documents/[id]/versions/[versionId]/restore/route.ts:89-95`

```ts
        file: {
          fileName: source.fileName,
          filePath: source.filePath,
          …
```

Die neue Version referenziert **denselben** Objekt-Key wie die Quellversion; es
wird keine Kopie im Storage angelegt. `erase/route.ts:117-124` und
`apps/worker/src/crons/document-retention-purge.ts:117-124` löschen anschließend
das Objekt anhand des Keys — für ein Dokument sammeln sie zwar alle Keys ein,
aber ein Key, den zwei Dokumente teilen (z. B. nach künftigen Kopier-/Import-
Funktionen), verschwindet für beide. Innerhalb eines Dokuments ist der Effekt
harmlos; er wird es nicht, sobald Keys dokumentübergreifend geteilt werden.

Zusätzlich: `DELETE /documents/:id/files/:fileId`
(`files/[fileId]/route.ts:59-99`) setzt `documentFile.deletedAt` und zieht
`document.file_sha256` auf die nächste Datei nach — aktualisiert aber
`document_version` **nicht**. Eine signierte Version kann danach auf eine
soft-gelöschte Datei zeigen.

---

### S06-20 — Durchgängig falsche eIDAS-Fundstelle in Recht­stexten der Oberfläche (Low)

**Severity:** Low — Doku-Drift in einem rechtlich formulierten Hinweistext.

Betroffene Stellen (wörtlich, alle mit derselben Formulierung):

- `apps/web/messages/de/document-signature.json:40` — „elektronische Signatur i.S.d. Art. 25 eIDAS (einfache elektronische Signatur)"
- `apps/web/messages/en/document-signature.json:40` — „within the meaning of Art. 25 eIDAS"
- `apps/web/src/app/api/v1/signature-requests/[requestId]/certificate/route.ts:93`
- `apps/web/src/lib/documents/signature-provider.ts:7-8`
- `apps/web/src/app/api/v1/signature-requests/[requestId]/sign/route.ts:10`
- `apps/web/src/components/documents/document-signatures-tab.tsx:8`
- `docs/STATUS.md:84`, `docs/ALPHA_INVITE.md:184`, `docs/qa-reports/wave19-n7-dms-scope-decision.md:103`

**Sachlage:** VO (EU) 910/2014 definiert die „elektronische Signatur" in
**Art. 3 Nr. 10**; die fortgeschrittene in Art. 3 Nr. 11 i. V. m. Art. 26, die
qualifizierte in Art. 3 Nr. 12. **Art. 25** regelt ausschließlich die
_Rechtswirkung_ (Nichtdiskriminierung in Abs. 1, Gleichstellung der QES mit der
handschriftlichen Unterschrift in Abs. 2). Eine Signatur „i.S.d. Art. 25" gibt
es nicht. Korrekt wäre: „einfache elektronische Signatur i.S.d. Art. 3 Nr. 10
eIDAS; Rechtswirkung nach Art. 25 Abs. 1 eIDAS".

Der inhaltliche Kern (einfache Signatur, kein QES) ist richtig — die Zitierung
ist es nicht, und sie steht in dem Text, den der Unterzeichner unmittelbar vor
der Abgabe seiner Willenserklärung liest.

---

### S06-21 — Upload-Typprüfung vertraut dem clientgesetzten Content-Type (Low)

**Severity:** Low — kompensiert durch die Auslieferungs-Härtung; für die
Vollständigkeit des DMS-Eintrittspunkt-Inventars aufgenommen. Cross-Ref S04.

**Fundstelle:** `apps/web/src/app/api/v1/documents/[id]/upload/route.ts:92-97`

```ts
if (!ALLOWED_MIMES.has(file.type)) {
  return Response.json(
    { error: `File type not allowed: ${file.type}` },
    { status: 415 },
  );
}
```

`file.type` stammt aus dem `Content-Type`-Teil des Multipart-Parts, also vom
Client. Es findet keine Magic-Byte-Prüfung statt; der Wert wird als
`document.mime_type` gespeichert und auf dem Download-Pfad als
`Content-Type` **zurückgeliefert** (`download/route.ts:148-152`).
`image/svg+xml` ist zugelassen (`:29`).

**Kompensierende Kontrollen geprüft (wirksam):**

- SVG wird beim Download hart auf `application/octet-stream` gezwungen plus
  `X-Content-Type-Options: nosniff` und `Content-Disposition: attachment`
  (`download/route.ts:134-155`) — der Stored-XSS-Pfad ist geschlossen. ✓
- Optionaler ClamAV-Scan mit Fail-Closed-Schalter (`upload/route.ts:109-159`). ✓

Verbleibendes Restrisiko: falsch deklarierte Typen verfälschen die
Wasserzeichen-Entscheidung (`isPdf = mimeType === "application/pdf"`,
`download/route.ts:73`). Eine als `text/plain` hochgeladene PDF wird nie
gestempelt — eine weitere Variante des Bypasses aus S06-06, ohne jede
Verschlüsselung.

---

### S06-22 — Sicherheitsrelevante DDL in Migration 0375 ist in `EXCEPTION WHEN OTHERS` gekapselt (Low)

**Severity:** Low — greift im geprüften Lauf korrekt; die Konstruktion kann einen
Fehlschlag aber nur als `NOTICE` melden.

**Fundstelle:** `packages/db/drizzle/0375_document_signature.sql:137-169`

```sql
DO $$ BEGIN
  EXECUTE 'ALTER TABLE document_signature ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE document_signature FORCE ROW LEVEL SECURITY';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'document_signature RLS enable/force: %', SQLERRM;
END $$;
```

Schlägt `ENABLE ROW LEVEL SECURITY` oder das Anlegen der Policy fehl, läuft die
Migration **erfolgreich durch**; die Tabelle bleibt ohne Mandantentrennung, und
im Migrationsprotokoll steht nur ein `NOTICE`. Bei einem Produkt mit
43 bereits dauerhaft fehlschlagenden Migrationen (BASE-002) ist ein
Fehlerbild, das nicht rot wird, ein reales Risiko.

**Live-Gegenprobe (Kontrolle greift hier):**

```
       relname            | rls | force | policies
--------------------------+-----+-------+----------
 document_signature       |  t  |   t   |    1
 document_signature_request|  t  |   t   |    1
```

RLS ist auf beiden Tabellen aktiv, mit FORCE und je einer Policy mit
`USING` **und** `WITH CHECK` — in dieser Installation also korrekt aufgesetzt.
Das Finding betrifft die Wiederholbarkeit, nicht den Ist-Zustand.

---

### S06-23 — Eine Signaturanforderung bleibt nach Dateiänderung unbegrenzt „pending" (Info)

`signature-provider.ts:417-425` lässt den Signaturversuch mit 422 scheitern,
wenn der Live-Hash abweicht — die Anforderung selbst wird aber **nicht**
invalidiert, ihr Status bleibt `pending`, bereits abgegebene Signaturen bleiben
im Zustand `signed`, und niemand wird benachrichtigt. Für die noch offenen
Signer sieht die Anforderung in `GET /documents/my-pending-signatures` weiterhin
normal aus; erst der Klick auf „Signieren" bringt den Fehler. Der Ersteller
erfährt nie, dass seine Zeremonie tot ist. Der Due-Date-Reminder-Cron
(`apps/worker/src/crons/signature-due-reminder.ts`) mahnt eine Signatur an, die
technisch nicht mehr abgegeben werden kann.

**Empfehlung:** Bei erkanntem Mismatch die Anforderung auf einen neuen Status
`invalidated` setzen und Ersteller + offene Signer benachrichtigen.

---

### S06-24 — Das Signatur-Zertifikat ist selbst weder signiert noch verankert (Info)

`certificate/route.ts:112-122` rendert ein reines pdfkit-Dokument ohne
PDF-Signatur, ohne QR-/Verifikations-URL und ohne Hash des Zertifikats selbst.
Es ist nachbaubar; seine Beweiskraft hängt vollständig daran, dass jemand die
Plattform online befragt. Für eine einfache elektronische Signatur ist das
konsistent, sollte aber auf dem Dokument stehen — heute steht dort nur
„Verifiziert am … durch die ARCTOS-Plattform" (`certificate/route.ts:94`), was
den Eindruck eines geprüften Dokuments erweckt.

**Empfehlung:** Verifikations-Link + Request-ID + Zeitpunkt als QR aufnehmen und
den Satz um den Hinweis ergänzen, dass die Prüfung nur online belastbar ist.

---

### S06-25 — `garage.toml` setzt `rpc_public_addr` auf die Loopback-Adresse (Info)

`deploy/garage/garage.toml:24`: `rpc_public_addr = "127.0.0.1:3901"`.
Für den beabsichtigten Single-Node-Betrieb (`replication_factor = 1`, `:21`)
funktionsfähig. Sobald ein zweiter Knoten dazukommt — der im Kommentar
angekündigte Multi-Node-/Geo-Fall (`:20`) — kündigt der Knoten eine Adresse an,
unter der ihn niemand erreicht. Ohne Handlungsdruck, aber eine Falle beim
Skalieren.

---

## 5. Geprüft und **nicht** als Finding aufgenommen

| Hypothese                                                                                                           | Prüfung                                                                                                                                                                                                                                                                                 | Ergebnis                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Original ohne Wasserzeichen über den **Storage-Endpunkt direkt** abrufbar                                           | `grep` nach Presigned-URL-Erzeugung in `file-storage.ts`, `sigv4.ts`; `deploy/garage/garage.toml:6-9` („no presigned URLs"); Ports in `docker-compose.production.yml:89, 126-127` nicht exponiert                                                                                       | **Widerlegt** für den Browser-/Internet-Pfad. Der Client bekommt nie eine Storage-URL. Der Netzwerk-interne Pfad ist als S06-09 erfasst.                         |
| Pfad-Traversal über nutzergesetzten `file_path`                                                                     | Alle Zod-Schemas unter `packages/shared/src/schemas/` durchsucht — DMS-Schemas enthalten `filePath` nicht; `upload/route.ts:99-103` konstruiert serverseitig; `LocalFsStorage.resolveKey` (`file-storage.ts:72-80`) verweigert Traversal zusätzlich                                     | **Widerlegt**                                                                                                                                                    |
| Sequenzielle Signaturreihenfolge nicht durchgesetzt                                                                 | `signature-provider.ts:405-415` + Testfall „409 sequential"                                                                                                                                                                                                                             | **Widerlegt** — korrekt durchgesetzt                                                                                                                             |
| Race auf den Kettenkopf bei parallelen Signaturen                                                                   | Partieller UNIQUE-Index `(request_id, previous_chain_hash) NULLS NOT DISTINCT` (`0375:129-131`) + Mapping `23505 → 409` (`signature-provider.ts:529-536`)                                                                                                                               | **Widerlegt** — sauber gelöst                                                                                                                                    |
| DSGVO-Löschung eines signierten Dokuments scheitert an `document_signature_request.version_id … ON DELETE RESTRICT` | Live gegen die laufende DB geprüft: Dokument + Version + Signaturanforderung angelegt, `DELETE FROM document` → **erfolgreich** (die RI-Trigger feuern in Namensreihenfolge; `document_signature_request_document_id_fkey` (CASCADE) vor `document_version_document_id_document_id_fk`) | **Widerlegt**                                                                                                                                                    |
| Fehlende RLS / fehlender Audit-Trigger auf den DMS-Tabellen                                                         | Live: `document`, `document_version`, `document_file`, `document_signature`, `document_signature_request`, `acknowledgment`, `policy_acknowledgment` — alle `relrowsecurity=t`, `relforcerowsecurity=t`, ≥1 Policy; alle mit `audit_trigger`                                            | **Widerlegt**                                                                                                                                                    |
| Signaturklasse wird als „fortgeschritten" oder „qualifiziert" beworben                                              | Vollständiger `grep` über `apps/`, `packages/`, `docs/`, `README.md`, `CLAUDE.md`, alle i18n-Bundles nach `eidas`, `QES`, `qualifiz*`, `fortgeschritt*`, `advanced electronic`                                                                                                          | **Widerlegt** — durchgängig „einfache elektronische Signatur, kein QES". Die Überhöhung liegt bei den _Eigenschaften_, nicht bei der Klasse (S06-02 bis S06-05). |
| SigV4-Implementierung fehlerhaft                                                                                    | `packages/shared/src/lib/sigv4.ts` gegen die AWS-Spezifikation gelesen; `encodeRfc3986` korrekt inkl. `!'()*`, Payload immer real gehasht (nie `UNSIGNED-PAYLOAD`), Testvektoren in `packages/shared/tests/sigv4.test.ts`                                                               | **Widerlegt**                                                                                                                                                    |
| Vier-Augen-Prinzip bei Freigabe fehlt                                                                               | `status/route.ts:73-114`, `checkFourEyes` aus `@grc/shared`                                                                                                                                                                                                                             | **Widerlegt** — vorhanden und wirksam (die Umgehungen sind S06-01 und S06-14)                                                                                    |

---

## 6. Zusammenfassung (final)

Die DMS- und Signatur-Implementierung ist handwerklich überdurchschnittlich:
Provider-Abstraktion, deterministische Hash-Kette mit Concurrency-Guard, RLS mit
FORCE und `WITH CHECK` auf allen Tabellen, Audit-Trigger flächendeckend,
Vier-Augen bei der Freigabe, saubere SigV4-Eigenimplementierung, kein einziger
nutzersetzbarer Storage-Pfad. Die **Signaturklasse wird nicht überhöht
dargestellt** — Code, Doku, i18n und Zertifikat sagen übereinstimmend „einfache
elektronische Signatur, kein QES", und das entspricht der Implementierung.

Die Probleme liegen eine Ebene tiefer, und sie liegen konsistent an derselben
Stelle: **überall dort, wo das Produkt eine Integritäts- oder
Kontrollzusage macht, ist die Zusage stärker als die Prüfung dahinter.**
Das Zertifikat bescheinigt „Datei-Integrität UNVERÄNDERT" auf Basis eines
Vergleichs zweier Datenbankspalten (S06-04); die Signatur-UI verspricht
revisionssichere Protokollierung von IP und Zeitpunkt, während die IP
client-steuerbar und ungehasht ist (S06-03) und der Zeitstempel unverankert
bleibt, obwohl die RFC-3161-Anbindung im Produkt existiert (S06-05); das
Policy-Modul nennt einen ungeschlüsselten SHA-512-Hash „Digitale Signatur … dient
als Nachweis", der bei datei-basierten Richtlinien nachweislich an einen
konstanten Leer-Hash bindet (S06-02); das Trust-Portal verspricht AES-256 at
rest, die es nicht gibt (S06-11).

Bei der Umgehbarkeit sind drei Wege bestätigt und reproduziert. Erstens:
`POST /documents/:id/upload` überschreibt den Datei-Snapshot der **aktuellen,
freigegebenen** Version in-place, ohne Statusprüfung, ohne Vier-Augen, ohne neue
Version und mit NULL als Akteur im Audit-Log (S06-01, High) — eine freigegebene
Dokumentversion ist also überschreibbar, und der Freigabe-Workflow ist über
`PUT` zusätzlich umgehbar (S06-14). Zweitens: das Controlled-Copy-Wasserzeichen
fällt bei jeder PDF, die pdf-lib nicht laden kann, ersatzlos aus — eine
Berechtigungs-verschlüsselte PDF, die in jedem Reader ohne Passwort öffnet,
genügt; das Original geht an jeden DMS-Nutzer und der Download wird gar nicht
protokolliert (S06-06, High; PoC beiliegend), und archivierte wie abgelaufene
Fassungen werden ohnehin nie gestempelt (S06-07). Drittens: eine inhaltliche
Änderung nach Teilsignatur wird zwar beim nächsten Signaturversuch mit 422
erkannt, aber nicht verhindert, nicht gemeldet und macht die Zeremonie zu einer
stillen Dauerleiche (S06-23). Der im Auftrag vermutete direkte Zugriff auf den
Storage-Endpunkt aus dem Browser existiert dagegen **nicht** — es gibt keine
Presigned URLs; der Weg führt über das Docker-Netz und den weiterhin
konfigurierten MinIO-Sidecar mit unpatchbaren CRITICAL-CVEs (S06-09), auf einem
Objektspeicher ohne jede Mandantentrennung unterhalb der Applikation (S06-10).
