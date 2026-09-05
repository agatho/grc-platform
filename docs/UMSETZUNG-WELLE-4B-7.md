# Welle 4b, Strang 7 — OP-079 und OP-116: das einheitliche Fehlerformat, und was es verdeckt hat

**Grundlage:** `docs/OFFENE-PUNKTE-REGISTER.md` OP-079, OP-116, OP-084 sowie
die Nachträge vom 2026-09-03/04 (OP-174, OP-176, OP-182) ·
`docs/audits/ARCTOS-FULL-2026-08-31/umsetzungsprotokolle/WP5.md` §S04-09 und
`WP12.md` §3.9
**Punkte:** OP-079 (M), OP-116 (L), OP-084 (M, mitgenommen)
**Stand:** Branch `audit/full-2026-08-31`, aufsetzend auf `9504a98a`
**Gebiet:** `apps/web/src/app/api/**`, `apps/web/src/lib/api*.ts`,
`apps/web/src/lib/query-schema.ts`, `apps/web/src/__tests__/**`

---

## 1. Ergebnis in einem Satz

Das einheitliche Fehlerformat gilt jetzt für **1.977 von 2.039** exportierten
Handlern; die 62 Ausnahmen sind konstante Antworten ohne Fehlerpfad und stehen
namentlich in einem Test. Wichtiger als diese Zahl: der zentrale Wickel, durch
den alle diese Routen laufen, hat auf zwei ganzen Fehlerklassen den
**Treibertext wörtlich an den Aufrufer zurückgegeben** — darunter die
vollständige Datenzeile eines fehlgeschlagenen INSERT und die E-Mail-Adresse
einer Person aus einer **fremden Organisation**. Insgesamt **dreizehn
Produktdefekte**.

| Punkt      | vorher                                    | nachher                                      |
| ---------- | ----------------------------------------- | -------------------------------------------- |
| **OP-079** | 94 ungewickelte Handler in 49 Dateien     | 62 in 25 Dateien, alle begründet und im Test |
| **OP-084** | dieselben 94 (das Register nennt 115)     | siehe oben                                   |
| **OP-116** | 12 UUID- und 12 Datumsflüsse ohne Prüfung | 0 / 0                                        |

---

## 2. Zuerst messen

### 2.1 OP-079: die Zahl aus dem Register stimmt nicht mehr

Das Register nennt „heute 107 von 1.362 Routen", Quelle `WP12.md` S14-16. Seit
WP12 haben die Wellen 4a, 4b-1 bis 4b-6 und 4c in `api/v1` gearbeitet. Selbst
nachgemessen am **2026-09-04 gegen `9504a98a`**, über alle Routendateien, mit
Auflösung der Alias-Exporte (`export const DELETE = GET;` und
`export { PUT as PATCH }` — wer die nicht auflöst, zählt gewickelte Routen als
ungewickelt und kommt auf 97 statt 94):

```
route files: 1372 | exported handlers: 2039 | wrapped: 1945 | NOT wrapped: 94 | files: 49
```

Also **94 Handler in 49 Dateien**, nicht 107. Die Zähleinheit war ausserdem
verschoben: das Register zählt „Routen", gemeint sind Handler, und eine
Routendatei trägt im Schnitt 1,5 davon.

### 2.2 Welche Formen von Fehlerantworten es gab

Über alle Routendateien, jede Konstruktion einer Antwort mit Status ≥ 400,
getrennt danach, ob sie durch `withErrorHandler` läuft (dort schreibt
`normaliseErrorResponse` die Antwort auf `application/problem+json` um) oder
nicht:

| Stelle                   | Form                  | Anzahl |
| ------------------------ | --------------------- | -----: |
| gewickelt (normalisiert) | `{ error: … }`        |  2.421 |
| gewickelt                | problem+json von Hand |     15 |
| gewickelt                | sonstige              |     28 |
| **ungewickelt**          | **`{ error: … }`**    | **72** |
| ungewickelt              | problem+json von Hand |      2 |
| ungewickelt              | sonstige              |      3 |

Die 2.421 sind kein Problem: der Wickel macht daraus problem+json und behält
jedes Originalfeld als Erweiterungsglied. Die **75 ungewickelten** sind es —
sie erreichen den Aufrufer so, wie sie geschrieben stehen.

### 2.3 OP-116: das Register beschreibt einen anderen Punkt als seine Quelle

Das Register führt OP-116 als „S04-09 (**Fehlerbehandlung in Handlern**) ist zu
~8 % abgedeckt — 23 von 276 Handlern". Die Quelle sagt etwas anderes.
`FINDINGS_REGISTER.md` S04-09 lautet: „**276 GET-Handler lesen Query-Parameter
ohne dediziertes Zod-Schema**", und `WP5.md` §4 nennt als Restrisiko
„inkonsistente Fehlerbehandlung, **nicht** Sicherheit". Der Registereintrag hat
die Wirkung zum Namen gemacht. Das ist keine Wortklauberei: wer nach
„Fehlerbehandlung in Handlern" sucht, sucht `try`/`catch`; wer S04-09 erledigen
will, muss Abfrageparameter prüfen.

Selbst nachgemessen am 2026-09-04:

```
GET route files reading non-pagination query params: 284
  via schema (parseQueryParams/searchParamsToObject): 29
  raw searchParams.get only: 255
```

284 statt 276, 29 statt 23 — also **10,2 %** statt 8 %. Die Zahl ist nahe an der
geerbten; die Arbeit war trotzdem eine andere, siehe §5.

---

## 3. Der Befund, um den es eigentlich geht

### 3.1 Der Wickel gab den Treibertext heraus

`apps/web/src/lib/api-wrapper.ts` ist die Engstelle, über die OP-079 gelöst
werden sollte, und sie trug an ihrem 500er-Pfad seit WAVE11 diesen Kommentar:

> full message + stack are logged for operators … but **NEVER returned in the
> response body**. CodeQL js/stack-trace-exposure flagged the earlier Wave-3
> version … error messages can leak schema names, table names, query fragments

Dreissig Zeilen darüber, in derselben Datei, standen zwei Zweige, die genau das
Gegenteil taten:

```ts
if (e.code && CONSTRAINT_VIOLATION_CODES.has(e.code)) {
  return problem.validation({
    detail: e.detail ?? e.message ?? "Database constraint violated",
    errors: [{ path: "", message: e.detail ?? e.message ?? e.code }],
  });
}
if (e.code && INVALID_INPUT_CODES.has(e.code)) {
  return problem.validation({
    detail: e.message ?? "Invalid input format",
    errors: [{ path: "", message: e.message ?? e.code }],
  });
}
```

Die Regel galt für den **unbekannten** Fehler und ausgerechnet nicht für die
beiden Klassen, in denen Postgres die Nutzdaten mitschickt.

### 3.2 Was da wörtlich hinausging

Gemessen am 2026-09-04 über den `postgres`-Treiber dieses Repositories gegen
die laufende Datenbank `grc_v4c` (617 Tabellen):

```
A) 22P02 uuid
   code    = 22P02
   message = "invalid input syntax for type uuid: \"not-a-uuid\""
C) 23505 unique
   code    = 23505
   message = "duplicate key value violates unique constraint \"user_email_unique\""
   detail  = "Key (email)=(ciso@arctos.dev) already exists."
D) 23503 fk
   code    = 23503
   message = "insert or update on table \"work_item\" violates foreign key
              constraint \"work_item_org_id_organization_id_fk\""
   detail  = "Key (org_id)=(00000000-…-0001) is not present in table \"organization\"."
23502 not-null
   message = "null value in column \"email\" of relation \"user\" violates not-null constraint"
   detail  = "Failing row contains (313defd8-bcc4-4090-b823-f4b7fa43744a, null,
              null, null, null, de, t, null, 2026-09-04 21:34:35.526799+00, …,
              local, …)."
```

Drei Dinge daran, in aufsteigender Schwere:

1. **Interna.** `work_item` ist der Relationsname hinter der API-Ressource
   `risk`; `work_item_org_id_organization_id_fk` ist ein Constraint-Name;
   `risk_status` ein Enum-Typ. Das ist die Auskunft, die der WAVE11-Kommentar
   ausdrücklich nicht geben wollte.
2. **Ein Orakel über Mandantengrenzen.** `user_email_unique` ist eine
   **globale** Eindeutigkeit (`UNIQUE (email)` auf `"user"`, nachgeprüft über
   `pg_constraint`). Ihr `detail` nennt also die E-Mail-Adresse einer Person aus
   einer **fremden** Organisation. Ein Administrator in Mandant A erfährt damit
   über eine 422-Antwort, dass `ciso@konkurrent.example` auf dieser Plattform
   ein Konto hat.
3. **Die ganze Zeile.** Bei `23502` ist `detail` = `Failing row contains (…)`,
   also **jeder Spaltenwert des versuchten INSERT**, auch der serverseitig
   erzeugten. Auf `"user"` steht in dieser Spaltenliste `password_hash`. Über
   alle 617 Tabellen tragen **30 weitere** eine NOT-NULL-Spalte mit `hash`,
   `secret` oder `token` im Namen — `api_key.key_hash`, `invitation.token`,
   `dd_session.access_token`, `scim_token.token_hash`,
   `developer_app.client_secret_hash`, `portal_session.access_token`,
   `mobile_session.refresh_token_hash`.

Das galt für **jeden** der 1.945 gewickelten Handler. Gegenüber OP-174 — zwei
einzelne Routen mit rohem Treibertext — ist das dieselbe Defektklasse an der
Stelle, an der alle durchmüssen.

### 3.3 Der Test behauptete die Regel und ihren Bruch, dreissig Zeilen auseinander

`apps/web/src/__tests__/lib/api-wrapper.test.ts` hatte beides:

```ts
// Zeile 112
expect(body.detail).toContain("demo detail");      // ← sichert den Durchreicher ZU
...
// Zeile 224
expect(JSON.stringify(body)).not.toContain("customer_pii_v2");
// „Critical: the error message MUST NOT appear in the response body."
```

Nach der eisernen Regel dieses Audits wird der Defekt behoben, nicht die
Erwartung — hier war die Erwartung selbst der Defekt. Sie ist umgedreht, mit
dem gemessenen alten Verhalten im Kommentar.

### 3.4 Was jetzt herausgeht

Neu in `api-errors.ts`: `sanitiseDbError(e)`. Sie behält, was der Aufrufer
braucht — die **Spalte** und die **Art** des Verstosses — und lässt Werte,
Constraint- und Relationsnamen weg:

| SQLSTATE | `detail` der Antwort                                                       | `errors[].path`        |
| -------- | -------------------------------------------------------------------------- | ---------------------- |
| 23505    | A record with these values already exists. …                               | Spalten aus `Key (…)`  |
| 23503    | A referenced record does not exist or is not visible to this organization. | Spalten aus `Key (…)`  |
| 23502    | A required field was empty.                                                | Spalte aus der Meldung |
| 22P02    | … not a valid `uuid` / Enumeration `risk_status`                           | —                      |

Die Spaltennamen bleiben mit Absicht: sie sind das Einzige an diesen Meldungen,
was ein Integrator handlungsleitend verwenden kann, sie sind die Feldnamen
seiner eigenen Anfrage, und sie enthalten keinen Wert. Der Typname bei 22P02
bleibt aus demselben Grund — `uuid` und `risk_status` stehen in jeder
Erfolgsantwort derselben Route ohnehin. Der volle Treibertext steht unverändert
im Log, korreliert über dieselbe `requestId`.

---

## 4. Die übrigen zwölf Defekte

### 4.1 `GET /api/v1/health` gab den Treibertext an anonyme Aufrufer

Über dem Handler steht: „No business data is exposed. Payload kept minimal to
prevent info leaks to **unauthenticated** callers." Darunter stand:

```ts
error: err instanceof Error ? err.message.slice(0, 200) : "unknown",
```

Der Endpunkt ist auf der Allowlist von `middleware.ts`, also ohne Sitzung
erreichbar. Was dort landete, waren Meldungen der Form
`password authentication failed for user "grc_app"`,
`connect ECONNREFUSED 127.0.0.1:5432`, `database "grc_v4c" does not exist` —
Rollenname, Host, Port, Datenbankname.

Der Schwesterendpunkt **`/api/health` macht es seit jeher richtig**
(`catch { dbOk = false; }`) und ist damit der Beweis, dass die Meldung für den
Zweck einer Sonde nicht gebraucht wird. Sie steht jetzt im Log; die Antwort
trägt `reason: "database_unreachable"` — auswertbar für einen Monitor, stumm
gegenüber einem Fremden.

### 4.2 SCIM-Gruppen: eine Tabelle, die es nicht gibt, und vier Unwahrheiten

Alles unter `/api/v1/scim/v2/Groups` steht auf `user_group` und
`user_group_member`. Nachgemessen am 2026-09-04:

```
psql> select id from user_group limit 1;
ERROR:  relation "user_group" does not exist

$ grep -rn "user_group" --include=*.sql --include=*.ts .   # ohne node_modules
(ausser den beiden Groups-Routendateien: kein Treffer)
```

Keine Migration, kein Drizzle-Schema, kein Entwurf. Die beiden Tabellen sind in
diesen zwei Dateien erfunden worden. Die Wirkung war nicht ein Fehler, sondern
**vier verschiedene Unwahrheiten**, gemessen gegen `9504a98a` mit genau diesem
SQLSTATE (42P01):

| Handler             | alte Antwort                                       |
| ------------------- | -------------------------------------------------- |
| `GET /Groups`       | **200**, `totalResults: 0`                         |
| `GET /Groups/:id`   | **404** „Group not found"                          |
| `POST /Groups`      | **500** mit `relation "user_group" does not exist` |
| `PATCH /Groups/:id` | **500** mit demselben Text                         |

Die erste ist die gefährlichste. Ihr `catch` trug den Kommentar „user_group
table may not exist **yet** — return empty"; er beschrieb keinen Übergang,
sondern den Dauerzustand. Entra ID und Okta lesen eine leere `ListResponse`
nicht als „kann ich nicht", sondern als **Bestandsauskunft** und leiten daraus
Mitgliedschaftsänderungen ab. Und der `catch` fing nicht nur die fehlende
Tabelle: gegen den alten Stand liefert er auch bei einem Deadlock (`40P01`)
**200 mit leerer Liste** — gemessen, siehe §6.2.

Was hier **nicht** passiert ist: die Implementierung wegzuwerfen. Sie ist
richtig für den Tag, an dem die Migration kommt. Die drei lügenden `catch` sind
durch einen Zweig ersetzt, der den gemessenen Zustand benennt: `42P01` auf
diesen vier Routen heisst „dieser Dienst führt keine Gruppen", und das ist
**501 Not Implemented**. Ein Bereitsteller trägt 501 in seinen Sync-Bericht
ein. Jeder andere Fehler geht an den Wickel weiter — ohne Treibertext, und ein
Deadlock bleibt ein 500er.

### 4.3 SCIM `/Users`: vier Handler ohne jedes `try`, drei mit rohem `err.message`

`scim/v2/Users/[id]` hatte in keinem seiner vier Handler ein `try`. Eine
Kennung, die keine UUID ist — beim Anschluss eines neuen Verzeichnisses der
Normalfall, weil der Bereitsteller zunächst seine eigene Kennung schickt —
traf auf `WHERE u.id = $1` gegen eine `uuid`-Spalte, ergab
`invalid input syntax for type uuid` und damit **500 mit leerem Rumpf**; der
Bereitsteller protokollierte „unknown error" und wiederholte.

`POST /Users` und die beiden Gruppen-Handler hatten ein `catch` und gaben
`err.message` wörtlich zurück. Bei `POST /Users` ist das derselbe
Mandantenleck-Pfad wie in §3.2: die Vorprüfung auf eine vorhandene
E-Mail-Adresse liest unter RLS und sieht eine Person aus einer fremden
Organisation **nicht**, das INSERT sieht sie — die Antwort war
`duplicate key value violates unique constraint "user_email_unique"`.

Behoben: ein SCIM-eigener Wickel (§4.10) und für den Eindeutigkeitsfall
**409 mit `scimType: "uniqueness"`** statt eines 500ers, wie RFC 7644 §3.3 es
vorsieht — ein Bereitsteller behandelt 409 als endgültig, statt es ewig zu
wiederholen. `scim_sync_log.error_message` behält den vollen Text; die Tabelle
ist org-gebunden und genau dafür da.

### 4.4 `reports/preview` gab `error.message` zurück

`reportGenerator.preview` liest Vorlage, Bindungen und Nutzdaten aus der
Datenbank. Der `catch` schrieb dessen Meldung in `{ error }` eines 500ers —
also im Fehlerfall den Treibertext. Jetzt `problem.internal` mit `requestId`,
voller Text ins Log.

### 4.5 `erm/risks/[id]/fair/simulate` gab `errorMessage` zurück

Derselbe Fall: `{ error: "Simulation failed", message: errorMessage }`. Der
Text bleibt in `fair_simulation_result.error_message` stehen — dort gehört er
hin, dort liest ihn ein Betreiber mit Org-Kontext — und verlässt die Antwort
nicht mehr.

### 4.6 Der SAML-ACS-Endpunkt warf statt zu antworten

`POST /api/v1/auth/sso/saml/callback` beginnt mit `await req.formData()`, ohne
Absicherung. Ein POST mit einem anderen Content-Type — der Normalfall bei einer
falsch konfigurierten Gegenstelle oder wenn jemand die ACS-URL von Hand
ausprobiert — wirft in undici

```
TypeError: Content-Type was not one of "multipart/form-data" or
           "application/x-www-form-urlencoded".
```

Der Handler war ungewickelt; der Wurf ging an die Laufzeit. **Und die
Smoke-Suite kannte den Fall**: `all-routes-auth-smoke.test.ts` trug für genau
diese Route `allowThrow: true` mit der Begründung, der generische JSON-Rumpf
des Tests lasse den Handler werfen. Die Nachsicht hat den Befund nicht
beschrieben, sondern zugedeckt.

Jetzt: **400** mit einer Begründung, die auf das SAML HTTP POST Binding
verweist. Die Ausnahme `allowThrow` ist gestrichen — und danach setzt sie
**kein** Eintrag der Liste mehr, kein Handler wirft noch statt zu antworten.

### 4.7 und 4.8 Zwei unauthentifizierte Endpunkte der Anmeldeseite, beide 500 mit leerem Rumpf

Beide nehmen eine Organisationskennung entgegen, die der Aufrufer bestimmt, und
geben sie ungeprüft an eine `uuid`-Spalte:

- `GET /api/v1/auth/sso/config?orgId=…` → `eq(ssoConfig.orgId, orgId)`
- `GET /api/v1/branding/css/<orgId>` → `withOrgReadContext(orgId, …)` und
  `eq(orgBranding.orgId, orgId)`

Beide werden von `login/page.tsx` bei jedem Besuch aufgerufen, beide waren
ungewickelt, beide endeten bei einem nicht-UUID-Wert in
`invalid input syntax for type uuid` und damit in einem 500er ohne Rumpf. Jetzt
422 (`sso/config`, mit Parameternamen) beziehungsweise 404 (`branding/css` —
mehr darf ein anonymer Aufrufer an dieser Stelle nicht erfahren).

### 4.9 Der Datumsfilter, den der Wickel nicht auffangen konnte

Der zweite ungeprüfte Fluss aus §5, und der einzige, den `withErrorHandler`
strukturell **nicht** abfangen kann. `new Date("garbage")` wirft nicht, es
ergibt `Invalid Date`; erst der Treiber stolpert darüber. Gemessen am
2026-09-04:

```
sql`select 1 from audit_log where created_at >= ${new Date("garbage")}`
→ code: undefined | name: RangeError | message: Invalid time value
```

**Kein SQLSTATE.** Der Wickel ordnet nach `e.code` zu; ohne Code greift weder
die 22er- noch die 23er-Regel, und der Aufruf endet im generischen Zweig als
**500**. Betroffen waren 12 Stellen in 6 Dateien, darunter
`GET /api/v1/admin/abac/audit` — die ABAC-Zugriffsprotokollansicht, also genau
die Seite, die man aufruft, wenn man einem Vorfall nachgeht. Ein Tippfehler im
Datumsfilter machte daraus einen Serverfehler.

Zwei Routen im selben Repository machen es richtig und beweisen, dass die
Prüfung bekannt ist: `calendar` und `compliance/calendar` verwerfen ein
`Number.isNaN(d.getTime())` mit 422.

### 4.10 Ein zweiter Wickel, weil SCIM eine andere Form verlangt

`withErrorHandler` normalisiert jede Fehlerantwort auf
`application/problem+json`. Für einen SCIM-Bereitsteller ist das keine
Fehlermeldung, sondern eine unlesbare Antwort: RFC 7644 §3.12 verlangt
`application/scim+json` mit
`{"schemas":["urn:ietf:params:scim:api:messages:2.0:Error"], "status":"…"}`
(Status als **Zeichenkette**). Neu: `apps/web/src/lib/api-scim.ts` mit
`withScimErrorHandler` — dieselbe Aufgabe, dieselbe Zuordnung, dieselbe
`sanitiseDbError`, die richtige Form. Constraint- und Formatverstösse werden
400 mit `scimType: "invalidValue"` (SCIM kennt kein 422),
Verbindungsabbrüche 503, alles Übrige 500 mit der `requestId`.

### 4.11 Die letzte Fehlerantwort, die noch nicht RFC 7807 war

`POST /api/v1/risk-acceptances` gab einen konstanten 405 als
`Response.json({ error, detail }, { status: 405 })` in `application/json` —
und weil der Handler nicht gewickelt ist, kam dieser Rumpf auch so beim
Aufrufer an. Nachgemessen war das nach allen übrigen Umstellungen die
**einzige** Fehlerantwort ausserhalb der beiden Sonden, die noch nicht
problem+json war; die dreizehn anderen 405 des Repositories benutzen längst
`problem.methodNotAllowed`, das denselben `Allow`-Kopf setzt.

---

## 5. OP-116: was geprüft ist, und was nicht

Die 255 rohen Leser (§2.3) sind nicht die Defektmenge. Die Defektmenge sind die
Stellen, an denen ein ungeprüfter Wert **den Treiber erreicht**. Über alle
1.372 Routendateien, gegen die Spaltentypen aus `packages/db/src/schema`:

| Fluss                                                | vorher                 | nachher |
| ---------------------------------------------------- | ---------------------- | ------: |
| roher Parameter → `eq(<uuid-Spalte>, …)`             | 12 in 8 Dateien        |   **0** |
| roher Parameter → `new Date(…)` als Vergleichsgrenze | 12 in 6 Dateien        |   **0** |
| roher Parameter → Enum-Spalte                        | **0** (schon erledigt) |       0 |

Die dritte Zeile ist bemerkenswert: der Enum-Teil von S04-09 — der Teil, den
der Kopfkommentar von `query-schema.ts` als den Defekt beschreibt („cast mit
`as SomeEnum`, Postgres antwortet mit `invalid input value for enum …`") — war
bereits abgetragen. Welle 4b-3 hat ihn mit `isEnumValue` gegen
`column.enumValues` in fünf Routen geschlossen, ohne dass OP-116 davon Notiz
genommen hätte. Übrig war der UUID- und der Datumsteil, und der Datumsteil war
der schwerere (§4.9).

Neu in `query-schema.ts`: `isUuidParam` / `invalidUuidParam` und
`toDateParam` / `invalidDateParam`. Die 422-Antwort nennt den **Parameter** in
`errors[0].path` — genau die Angabe, die ein aus dem Treiber hochgereichter
22P02 nicht liefern kann, weil Postgres nicht weiss, welcher Parameter gemeint
war.

---

## 6. Nachweis

### 6.1 Die Tore

Alle gegen den Endstand neu erzeugt, nicht aus einem früheren Lauf übernommen.
Beide Datenbank-Umgebungsvariablen gesetzt (`grc_v4c`, 617 Tabellen).

| Lauf                                          | Ergebnis                                                             |
| --------------------------------------------- | -------------------------------------------------------------------- |
| `npx tsc --noEmit -p apps/web/tsconfig.json`  | `EXIT=0`, keine Ausgabe                                              |
| `npm test` (apps/web)                         | `Test Files 127 passed`, `Tests 2798 passed` + DB-Suiten             |
| `npm run test:rls` (apps/web)                 | `Test Files 4 passed`, `Tests 24 passed`                             |
| `npx prettier --check .`                      | `All matched files use Prettier code style!`                         |
| `node scripts/lint-ratchet.mjs`               | `[apps/web] 0 Befunde (Baseline 0), 2284 Dateien` · keine Regression |
| `node scripts/check-gate-inputs.mjs`          | `✓ 9 Tor-Eingaben …`                                                 |
| `node scripts/audit-dead-exports.mjs --check` | `2765 (Baseline 2765)` · keine Regression                            |

Zur Dead-Exports-Ratsche eine Anmerkung, weil sie den Entwurf verändert hat:
die erste Fassung dieser Arbeit hat die Gruppen-Implementierung **gelöscht** und
durch ein konstantes 501 ersetzt. Damit wurde `scimCreateGroupSchema` in
`packages/shared` zu einem toten Export — die Ratsche fiel mit `+2`. Das war
kein Formalismus, sondern ein berechtigter Hinweis: die Implementierung zu
löschen wirft Arbeit weg, die richtig wird, sobald die Migration existiert. Die
jetzige Fassung behält sie und ändert nur die Fehlerbehandlung (§4.2). Das ist
die bessere Lösung, und die Ratsche hat sie erzwungen.

### 6.2 Jeder neue und geänderte Test fällt gegen den alten Stand

Nachgewiesen über `git stash push -u` auf `9504a98a`, Testdateien
zurückkopiert, Lauf, `git stash pop`. **25 von 25** neuen beziehungsweise
geänderten Zusicherungen fallen:

```
× 23502: gibt die 'Failing row contains (…)'-Zeile NICHT heraus
    AssertionError: expected '…' not to contain 'Failing row contains'
× 23505: gibt weder den Constraint-Namen noch den fremden Wert heraus
    AssertionError: expected '…' not to contain 'ciso@arctos.dev'
× 23503: gibt weder Relationsname noch Schluesselwert heraus
    AssertionError: expected '…' not to contain '00000000-0000-0000-0000-000000000001'
× 22P02: nennt den Typ, nicht den Wert
    AssertionError: expected '…' not to contain 'geheimes-praefix-42'
× kein exportierter Handler ohne Wickel ausserhalb der Ausnahmeliste
    AssertionError: expected [ …(32) ] to deeply equal []
× die ungewickelten Ausnahmen bauen keine {error}-Rümpfe mit Status >= 400
    + "v1/risk-acceptances/route.ts POST — Status 405 ohne problem+json"
× liefert 503 degraded — ohne Rolle, Host, Port oder Datenbankname
    AssertionError: expected '{"status":"degraded",…' not to contain 'grc_app'
× GET /Groups meldet 501 — und NICHT 200 mit totalResults: 0
    AssertionError: expected 200 to be 501
× GET /Groups/:id meldet 501 statt eines erfundenen 404
    AssertionError: expected 404 to be 501
× POST /Groups · PATCH /Groups/:id meldet 501
    AssertionError: expected 500 to be 501
× ein anderer Datenbankfehler wird NICHT zu 501 umgedeutet
    AssertionError: expected 200 to be 500      ← der Deadlock aus §4.2
× /api/v1/auth/sso/saml/callback [anonymous → 401/403]
    AssertionError: POST … threw instead of returning 401/403
× ?from=garbage / ?to=garbage → 422
    AssertionError: expected 200 to be 422
× answers POST with 405 as problem+json, with the Allow header
    AssertionError: expected 'application/json' to contain 'problem+json'
(dazu 11 Zusicherungen in api-scim.test.ts und query-param-guards.test.ts,
 die gegen den alten Stand am fehlenden Modul scheitern)
```

Die vorletzte Zeile ist die schönste: der `catch` der Gruppenliste hat gegen
den alten Stand auch einen **Deadlock** in „200, keine Gruppen" übersetzt.

### 6.3 Was diese Tests nicht zeigen

`events-date-filter-422.test.ts` zeigt den 500er des alten Standes **nicht** —
sein `drizzle-orm`-Mock serialisiert nichts, wirft also nichts, und gegen den
alten Stand antwortete er mit 200. Der 500er ist die Messung gegen den echten
Treiber aus §4.9, nicht die Behauptung dieses Tests. Das steht auch im Kopf der
Testdatei.

### 6.4 Der Strukturtest statt einer Zahl

`apps/web/src/__tests__/api/error-envelope-coverage.test.ts` prüft den
Routenbaum, nicht einen Zählwert: jeder exportierte Handler läuft durch einen
der beiden Wickel — oder steht namentlich in einer Ausnahmeliste **mit
Begründung**. Der Test hat drei Zähne:

1. Ein Handler ohne Wickel ausserhalb der Liste lässt ihn fallen.
2. Ein Eintrag, dessen Datei inzwischen vollständig gewickelt ist, lässt ihn
   ebenfalls fallen — eine Ausnahme, die nicht mehr gebraucht wird, muss
   ausgetragen werden.
3. Die ungewickelten Ausnahmen dürfen keinen `{error}`-Rumpf mit Status ≥ 400
   bauen, handlerweise geprüft (mehrere dieser Dateien haben einen gewickelten
   GET und einen konstanten 405 daneben).

Eine Zahl in einem Dokument altert — genau das ist mit den 107 aus WP12
passiert. Dieser Test nicht.

---

## 7. Was begründet offen bleibt

### 7.1 Die 62 ungewickelten Handler

Sie sind keine Sammelposition, sondern drei nachgesehene Formen:

| Form                                     | Handler | Dateien |
| ---------------------------------------- | ------: | ------: |
| konstante 308-Aliasse                    |      36 |       9 |
| konstante Discovery-Nutzlast oder 405    |      24 |      14 |
| Health-Sonden mit eigenem Antwortvertrag |       2 |       2 |

Keiner ruft `await` auf, keiner berührt die Datenbank, keiner kann werfen — ein
Wickel hätte dort nichts zu fangen. Die beiden Sonden sind der einzige
Sonderfall mit Begründung: ihr Rumpf **ist** ihr Vertrag
(`{status, checks, dbLatencyMs}`), und eine Normalisierung auf problem+json
würde jeden Monitor brechen, der sie liest. Wird eine dieser Dateien um einen
echten Handler erweitert, fällt der Test (§6.4).

### 7.2 Die 255 rohen Query-Leser (OP-116, Kern)

Sie bleiben. Nicht aus Zeitmangel, sondern weil ein Schema pro Route eine
**Verhaltensänderung pro Route** ist: `parseQueryParams` verwirft leere Werte,
strippt unbekannte Parameter und lehnt Werte ab, die heute stillschweigend
durchgehen. Welches Frontend welchen dieser 255 Endpunkte mit welchen
Parametern aufruft, lässt sich nicht aus dem Repository beantworten, und 255
unverifizierte Verhaltensänderungen sind schlechter als ein bezifferter Rest.

Die **Defektklasse** dahinter ist geschlossen (§5): kein roher Parameter
erreicht mehr eine `uuid`-Spalte oder ein `new Date`. Was bleibt, ist die
Stilfrage — inkonsistente Prüfung, wie `WP5.md` §4 sie einstuft.

Eine Einschränkung dieser Aussage, die dazugehört: gemessen wurden zwei
Suchmuster (`eq(<Spalte>, <Variable>)` gegen den Spaltentyp aus dem
Drizzle-Schema, und `gte|lte|lt|gt(<Spalte>, new Date(<Variable>))`). Andere
Formen — Interpolation in ein `sql`-Template, `inArray`, `parseInt` ohne
Bereichsprüfung — sind damit **nicht** ausgeschlossen.

### 7.3 Die Migration für `user_group`

Vier SCIM-Handler antworten mit 501, weil ihre Tabelle nicht existiert. Die
Migration samt RLS-Policy gehört nach `packages/db` und damit ausserhalb der
Dateihoheit dieser Welle. Bis dahin ist der Zustand benannt statt
stillschweigend — und die Handler arbeiten ohne weitere Änderung, sobald die
Tabelle da ist.

### 7.4 SCIM kann eine Person aus einer fremden Organisation nicht aufnehmen

Der Weg dahin ist jetzt sauber (409 `uniqueness` statt 500 mit Treibertext),
die Funktion fehlt weiterhin: `POST /Users` prüft unter RLS auf ein
vorhandenes Konto, sieht ein Konto aus einer fremden Organisation nicht und
läuft ins INSERT. Ein bestehendes Konto über Mandantengrenzen zu verknüpfen ist
eine Produktentscheidung mit Datenschutzgewicht, keine Reparatur.

### 7.5 Sechs Discovery-Routen geben `requestId: ""` aus

`compliance`, `marketplace`, `rcsa`, `reports`, `isms/nis2`, `identity` und
`whistleblowing/intake` tragen je eine eigene Kopie von

```ts
function getRequestId(req: Request): string {
  return req.headers.get("x-request-id") ?? "";
}
```

`api-errors.ts` sagt für seine Fassung ausdrücklich zu: „The fallback
guarantees that **every** problem+json response carries a non-empty correlation
ID for log-grep". Diese sieben Kopien geben stattdessen die leere Zeichenkette
zurück. Es sind Erfolgsantworten, kein Fehlerformat, und deshalb nicht in
dieser Welle geändert — aber es ist dieselbe Sorte Abweichung, und sie steht
hier, damit sie nicht wieder verloren geht.

---

## 8. Geänderte Dateien

**Bausteine** — `lib/api-errors.ts` (`sanitiseDbError`),
`lib/api-wrapper.ts` (beide Treibertext-Zweige), `lib/api-scim.ts` (neu),
`lib/query-schema.ts` (UUID- und Datumsprüfer).

**Routen** — 4 × SCIM, `health` (v1), `reports/preview`,
`erm/risks/[id]/fair/simulate`, `auth/sso/saml/callback`, `auth/sso/config`,
`branding/css/[orgId]`, `risk-acceptances`, 6 Dateien mit Datumsfiltern,
8 Dateien mit UUID-Filtern, sowie 17 zuvor ungewickelte Handler in
`portal/**`, `auth/**`, `platform/**`, `invitations/**`, `vendors/**`,
`calendar/ical/**`.

**Tests** — neu: `api/error-envelope-coverage.test.ts`,
`api/scim-groups-unsupported.test.ts`, `api/health-v1-no-driver-text.test.ts`,
`api/events-date-filter-422.test.ts`, `lib/api-scim.test.ts`,
`lib/query-param-guards.test.ts`. Geändert: `lib/api-wrapper.test.ts` (die
umgedrehte Erwartung aus §3.3), `api/all-routes-auth-smoke.test.ts`
(`allowThrow` gestrichen, §4.6), `api/risk-acceptances-rbac.test.ts` (die 405
wird jetzt auf ihre Form geprüft, nicht nur auf ihren Status, §4.11).

---

## 9. Was mir aufgefallen ist, das vorher niemand wusste

**Eine Engstelle verdoppelt jeden Fehler, den sie hat.** OP-079 wurde
eingerichtet, damit alle Routen dieselbe Fehlerform benutzen. Das war richtig
und ist erledigt. Der Preis derselben Bauweise ist, dass ein Durchreicher an
der Engstelle nicht eine Route betrifft, sondern alle 1.945 — und dass er
schwerer zu sehen ist als in einer einzelnen Route, weil niemand mehr auf die
einzelne Route schaut. OP-174 hat zwei Routen mit rohem Treibertext gefunden.
Der dritte Fall stand in der Datei, die die anderen beiden hätte verhindern
sollen.

**Ein `catch` ohne Fehlerobjekt ist eine Behauptung.** Die drei schlimmsten
Funde dieser Welle haben dieselbe Form: `catch { return <etwas Plausibles> }`.
„Return empty" bei der Gruppenliste, „Group not found" bei der Einzelgruppe,
„degraded, hier ist der Grund" bei der Sonde. In allen drei Fällen war das
Plausible falsch, und in allen drei Fällen hat es nie jemand gemerkt, weil
nichts fehlgeschlagen ist. Ein `catch`, der eine fachliche Aussage macht, sagt
etwas über einen Zustand, den er nicht geprüft hat.

**Eine Testnachsicht ist ein ungelesener Befund.** `allowThrow: true` stand mit
einer korrekten technischen Beschreibung in der Smoke-Suite: „the handler starts
with `req.formData()`; our generic application/json smoke body makes that
throw". Der Satz beschreibt einen Defekt und wurde als Konfiguration gelesen.
Das ist dieselbe Mechanik wie bei den abgeschalteten Lint-Regeln aus Welle 4b-3
— nur dass die Begründung hier sogar richtig war.
