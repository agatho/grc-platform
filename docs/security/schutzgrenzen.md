# Schutzgrenzen — was die Prüfungen leisten und was nicht

**Stand:** 2026-09-05 · Branch `audit/full-2026-08-31`, HEAD `2f716205`
**Punkte:** OP-112, OP-114, OP-115, OP-117 aus `docs/OFFENE-PUNKTE-REGISTER.md`

Dieses Dokument beschreibt die drei Schranken, an denen fremde Daten in ARCTOS
hinein- oder herausgehen: Datei-Uploads, ZIP-Archive und ausgehende
HTTP-Aufrufe. Für jede steht hier, **was sie garantiert** und **was sie
ausdrücklich nicht garantiert**.

Der Anlass ist einer der Befunde dieses Audits: Für zwei dieser Schranken
existierte eine Zusage nur im Prüfbericht, und in der Produktdokumentation
stand entweder nichts oder eine stärkere Aussage, als der Code hergibt. Eine
Schranke, deren Grenze nirgends steht, wird beim nächsten Review für stärker
gehalten, als sie ist.

---

## 1. Upload-Prüfung: Magic Bytes sind eine Formatprüfung, keine Inhaltsprüfung

**Code:** `packages/shared/src/lib/file-signature.ts` (`sniffFileType`,
`verifyUploadSignature`, `MAGIC_BYTE_SIGNATURES`)

### Was sie leistet

Der vom Client gelieferte `Content-Type` wird **nicht** geglaubt. Die Datei
wird an ihren führenden Bytes identifiziert, und der _ermittelte_ Typ ist der
maßgebliche — er wird persistiert und beim Download als `Content-Type`
ausgeliefert. Damit ist die Klasse „beliebiger Inhalt, gespeichert und
ausgeliefert als `application/pdf`" geschlossen (`#S04-06`).

### Was sie nicht leistet

**Eine Datei, die mit `%PDF-` beginnt und danach beliebige Bytes enthält,
passiert.** Die Prüfung liest ein Präfix von wenigen Bytes; sie parst das
Dokument nicht, validiert keine interne Struktur und stellt nicht fest, ob der
Rest ein wohlgeformtes PDF ist. Ein als PDF getarnter Payload wird als PDF
gespeichert und als PDF ausgeliefert.

Konkret nicht abgedeckt:

| Fall                                                            | Verhalten                                                                                           |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Gültiger Magic-Header, beliebiger Rest                          | **passiert** — dafür ist ClamAV zuständig, siehe unten                                              |
| CSV, Klartext, XML, SVG                                         | haben keine verlässlichen Magic Bytes → `null`; der Aufrufer entscheidet über `allowUnknownForText` |
| `.docx` als `.xlsx` hochgeladen                                 | beide sind `PK\x03\x04`; die Unterscheidung fällt erst im Parser                                    |
| Eingebettetes aktives Element in einem formal gültigen Dokument | nicht Gegenstand dieser Schicht                                                                     |

### Wer stattdessen zuständig ist

ClamAV (`packages/shared/src/lib/clamav.ts`). **Mit zwei Einschränkungen, die
ein Betreiber kennen muss:**

1. Ist `CLAMAV_HOST` nicht gesetzt, wird **gar nicht gescannt** — der Upload
   wird mit `scan_status = 'skipped'` angenommen. Es gibt einen einmaligen
   Log-Hinweis, keine Ablehnung.
2. Scan-**Fehler** (Daemon nicht erreichbar, Timeout) sind **fail-open**,
   solange `CLAMAV_FAIL_CLOSED=1` nicht gesetzt ist. Der Upload geht durch.

Wer eine Malware-Prüfung als Zusage braucht, setzt beides: `CLAMAV_HOST` **und**
`CLAMAV_FAIL_CLOSED=1`. Sonst ist der Satz „Uploads werden auf Schadsoftware
geprüft" für diese Installation nicht wahr.

---

## 2. ZIP-Vorprüfung: sie glaubt dem Zentralverzeichnis

**Code:** `packages/shared/src/lib/zip-safety.ts` (`assertZipWithinLimits`,
`inspectZipArchive`)

### Was sie leistet

Vor dem ersten entpackten Byte wird das ZIP-Zentralverzeichnis gelesen und
gegen `SPREADSHEET_ZIP_LIMITS` geprüft: 100 MB unkomprimiert gesamt, 80 MB je
Element, Verhältnis 150:1, höchstens 2 048 Einträge. Das schließt den
gemessenen Fall aus `#S04-04` (9,3 MB Upload → 2,26 GB RSS in 17,5 s).

### Was sie nicht leistet

**Sie prüft eine Selbstauskunft.** Die Größenangaben im Zentralverzeichnis
stammen aus dem Archiv selbst; ein Archiv kann beim tatsächlichen Entpacken
mehr liefern, als es dort angibt. Die Vorprüfung ist eine billige erste
Schicht, keine Garantie.

### Wo die zweite und dritte Schicht greifen — und wo nicht

Im **Import-Pfad** (`apps/web/src/lib/import-export/file-parser.ts:160`) ist
das aufgefangen: exceljs liest mit dem streamenden `WorkbookReader`, und harte
Zeilen-/Zellengrenzen (`IMPORT_MAX_ROWS`, Standard 100 000) brechen den Lauf
mitten im Strom ab. Eine Datei, die an Schicht 1 vorbeikommt, kann das Ergebnis
nicht unbegrenzt wachsen lassen.

Im **BPMN-Excel-Import** (`packages/shared/src/lib/excel-to-bpmn.ts:43`) gibt es
nur Schicht 1. Zeile 54 ruft `wb.xlsx.load()` — die nicht-streamende Variante,
also genau den Aufruf, den `#S04-04` gemessen hat. Ein Archiv, dessen
Zentralverzeichnis die Größen zu niedrig angibt, wird hier vollständig
materialisiert.

> **Offen (OP-114):** Der ehrliche Zustand ist damit beschrieben, nicht
> behoben. Der Weg ist derselbe wie im Import-Pfad — `WorkbookReader` statt
> `Workbook.xlsx.load()` in `excel-to-bpmn.ts:54`, plus eine Zeilenobergrenze.
> Das ist eine Änderung in `packages/shared/src/**` und gehört dem Eigentümer
> dieses Pakets.

---

## 3. Ausgehende HTTP-Aufrufe: SSRF-Schranke mit einem bekannten Fenster

**Code:** `packages/shared/src/url-safety.ts` (synchron),
`packages/shared/src/lib/url-safety-server.ts` (DNS), `safeFetch`

### Was sie leistet

Drei Ebenen, an jedem ausgehenden Aufruf — Webhooks, SAML-Metadaten,
OIDC-Discovery, Threat-Feeds, Interface-Health-Checks:

1. **Protokoll und Literale** (synchron, auch beim Registrieren via Zod):
   nur `http`/`https`, keine eingebetteten Zugangsdaten, verbotene Hostnamen
   (`localhost`, `metadata.google.internal`, …), private und reservierte
   IP-Literale einschließlich IPv6, CGNAT und der Metadaten-Adressen.
2. **DNS-Auflösung** (`checkResolvedHostIsPublic`): der Name wird über den
   System-Resolver aufgelöst und die _aufgelöste_ Adresse geprüft. Das fängt
   `aaa.example.com → A 10.0.0.5`, `/etc/hosts`, Split-Horizon-DNS und
   CNAME-Ketten.
3. **Je Redirect-Sprung** wird erneut geprüft.

### Was sie nicht leistet

**Zwischen der DNS-Prüfung und dem `fetch` liegt ein Zeitfenster
(TOCTOU).** `fetch` löst den Namen selbst noch einmal auf; wer die Antwort
zwischen beiden Auflösungen ändern kann (DNS-Rebinding mit sehr kurzer TTL),
erreicht eine Adresse, die die Prüfung abgelehnt hätte.

> **Offen (OP-112):** Der belastbare Fix ist ein eigener undici-Dispatcher, der
> die in Schritt 2 aufgelöste IP für genau diesen Aufruf festnagelt
> (IP-Pinning), statt `fetch` erneut auflösen zu lassen. Das ändert das
> HTTP-Verhalten **aller** ausgehenden Aufrufe und ist deshalb kein
> Doku-Punkt — es gehört in eine eigene Runde mit eigenem Testlauf.
> Die heutige Ebene 2 ist trotzdem deutlich mehr als die reine
> Literal-Prüfung, die durch einen einzigen A-Record umgangen wird.

### `WEBHOOK_ALLOW_HTTP` — eine bewusste Regression (OP-117)

Seit WP5 wird **ausgehendes Klartext-HTTP abgelehnt**. Das betrifft nicht nur
Webhooks, sondern jeden Aufrufer von `checkOutboundUrl` — insbesondere
**Threat-Feeds**, die vorher über `http://` bezogen werden konnten.

| Variable                      | Standard | Wirkung                                                             |
| ----------------------------- | -------- | ------------------------------------------------------------------- |
| `WEBHOOK_ALLOW_HTTP`          | `0`      | `1` lässt `http://` wieder zu — **für alle** ausgehenden Aufrufe    |
| `WEBHOOK_ALLOW_PRIVATE_HOSTS` | `0`      | `1` schaltet die Prüfung auf private Ziele ab — **nur Entwicklung** |

`WEBHOOK_ALLOW_HTTP=1` wirkt **nicht** dort, wo der Aufrufer `requireHttps`
setzt: SSO/SAML/OIDC lehnen Klartext in jedem Fall ab. Ein Klartext-Aufruf ist
dort ein Befund für sich.

**Für ein Upgrade heißt das:** Eine Installation, die einen Threat-Feed oder
ein Webhook-Ziel über `http://` bezieht, verliert diese Verbindung beim Wechsel
auf diesen Stand — kommentarlos, mit einer Ablehnung im Log. Vor dem Rollout
prüfen:

```sql
-- beide Tabellen, beide Spaltennamen (2026-09-05 gegen grc_v4c geprueft)
SELECT 'webhook' AS art, id, url        FROM webhook_registration WHERE url      LIKE 'http://%'
UNION ALL
SELECT 'feed',          id, feed_url    FROM threat_feed_source   WHERE feed_url LIKE 'http://%';
```

Wo ein `https://`-Ziel existiert, ist die URL zu ändern. Wo nicht, ist
`WEBHOOK_ALLOW_HTTP=1` in `.env` einzutragen — **mit einem Datum und einem
Grund daneben**, damit die Ausnahme nicht dauerhaft wird.

---

## 4. Zusammenfassung für einen Prüfer

| Zusage                                                     | Trägt sie?                                               | Grenze                                                |
| ---------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------- |
| „Der Dateityp wird serverseitig verifiziert"               | ja                                                       | nur das Format am Präfix, nicht der Inhalt            |
| „Uploads werden auf Schadsoftware geprüft"                 | **nur mit** `CLAMAV_HOST` **und** `CLAMAV_FAIL_CLOSED=1` | sonst wird übersprungen oder fail-open durchgelassen  |
| „ZIP-Bomben werden abgewiesen"                             | im Import-Pfad ja                                        | im BPMN-Excel-Pfad nur die Selbstauskunft des Archivs |
| „Ausgehende Aufrufe können keine internen Ziele erreichen" | weitgehend                                               | TOCTOU-Fenster bei DNS-Rebinding (OP-112)             |
| „Es wird kein Klartext-HTTP gesprochen"                    | ja, sofern `WEBHOOK_ALLOW_HTTP` nicht auf `1` steht      | SSO/SAML/OIDC ausnahmslos                             |
