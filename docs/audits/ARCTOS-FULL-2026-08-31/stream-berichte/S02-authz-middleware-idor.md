# S02 — Authentifizierung, Autorisierung, Middleware-Kette, IDOR

**Audit-ID:** ARCTOS-FULL-2026-08-31 · **Stream:** S02
**Prüfgegenstand:** `/work/repo` @ `a8d1414f`
**Scope:** `apps/web/src/app/api/**` (1.357 `route.ts`), `packages/auth/**`,
`apps/web/src/middleware.ts`, `apps/web/src/lib/api.ts`, Role-Matrix, RLS-Gegenkontrollen
**Stand:** abgeschlossen (fortlaufend geschrieben, letzte Fassung)

---

## 1. Zusammenfassung

Die Zugriffskontrolle von ARCTOS ist **zweistufig** angelegt: eine globale
Edge-Middleware (`apps/web/src/middleware.ts`), die jede Anfrage außerhalb einer
kurzen Public-Allowlist ohne gültige Session mit 401/Redirect abweist, und eine
Handler-lokale Kette `withAuth(...roles)` → `requireModule(...)` →
Org-Scoping/RLS. Die maschinelle Analyse aller 1.357 Routendateien
(2.021 exportierte HTTP-Handler) zeigt, dass die **Authentifizierungsschicht
flächendeckend vorhanden ist** — nur 44 von 2.021 Handlern rufen keinerlei
Auth-Primitive auf, und davon sind nach Einzelprüfung **null echte, ungeschützte
Datenendpunkte**. Das ist der positive Befund dieses Streams.

Die Defekte liegen eine Ebene darunter, in der **Autorisierung**:

1. **Der Rollen-Check ist global aushebelbar.** `withAuth()` fällt bei
   verweigerter Standardrolle auf `checkCustomRoleAccess()` zurück, das lediglich
   prüft, ob der Nutzer _irgendeine_ Custom-Rolle mit _irgendeiner_ Berechtigung
   in der Org hat — ohne Modul- und ohne Aktionsbezug. Jeder Nutzer mit einer
   beliebigen Custom-Rolle besteht damit **jede** Rollenprüfung der Plattform,
   inklusive `withAuth("admin")` auf `POST /api/v1/users/:id/roles` — also
   Selbstzuweisung der Admin-Rolle (S02-02, reproduziert).
2. **Plattformweite Konfiguration ist nur mit einer Mandanten-Rolle geschützt.**
   `feature_gate`, `subscription_plan`, `plugin`, `data_region` haben kein
   `org_id` und keine RLS; ihre Schreib-Endpunkte sind mit `withAuth("admin")`
   abgesichert — und `admin` ist eine _pro-Org_-Rolle. Ein Mandanten-Admin kann
   damit Konfiguration verändern, die alle Mandanten betrifft. Ein
   Plattform-Admin-Konzept existiert im gesamten Repository nicht (S02-03).
3. **Das dokumentierte Produktions-Setup legt einen Admin mit bekanntem Passwort
   an** (`admin@arctos.dev` / `admin123`), ohne Environment-Guard im Seed und mit
   `RUN_SEEDS=true` im Produktions-Env-Template. In Kombination mit BASE-001
   (öffentliches Repository) ist das ein direkter Authentifizierungs-Bypass
   (S02-01).
4. **Die anonymen Fachkanäle sind doppelt zugemauert.** 15 Endpunkte, die laut
   dem projekteigenen Auth-Smoke-Test bewusst anonym sein müssen (HinSchG-
   Meldeportal, anonymes Postfach, Vendor-DD-Portal, SSO-Login/Callback,
   Invitation-Accept, SCIM-Provisioning, iCal-Feed, Break-Glass-Login), stehen
   nicht in der Middleware-Allowlist (S02-04) — und selbst wenn sie es täten,
   scheitert die Token-Auflösung unter der Produktions-DB-Rolle `grc_app` an den
   FORCE-RLS-Policies, weil vor der Token-Auflösung kein Org-Kontext existieren
   kann (S02-05, per SQL reproduziert). Für den HinSchG-Kanal ist das ein
   Compliance-Versprechen des Produkts, das technisch nicht eingelöst wird.

5. **Die SAML-Signaturprüfung prüft den Digest nicht.** `validateSAMLSignature`
   verifiziert ausschließlich `SignatureValue` über `SignedInfo` und vergleicht
   nie den `DigestValue` mit dem tatsächlichen Assertion-Inhalt. Wer _eine_
   gültige, vom IdP signierte Response besitzt, kann NameID und Gruppen frei
   ersetzen und sich als beliebiger Nutzer der Organisation anmelden (S02-23).
   Dass der Endpunkt derzeit durch S02-04 unerreichbar ist, ist Zufall, keine
   Kontrolle — die beiden Findings dürfen nur in der Reihenfolge S02-23 vor
   S02-04 behoben werden.

Dazu kommen 91 mutierende Endpunkte ohne jede Rollenprüfung (darunter der
hash-ketten-verankerte Audit-Sign-off und der Massenexport), eine fehlende
Funktionstrennung im BPMN-Freigabezyklus, ein Org-Kontext-Leck über den
Connection-Pool und ein praktisch nicht vorhandenes Rate-Limiting am Login.

**Severity-Verteilung:** 4 Critical · 5 High · 8 Medium · 5 Low · 2 Info
(24 Findings).

---

## 2. Methodik-Protokoll

### 2.1 Schritt 1 — Maschinelle Middleware-Ketten-Analyse (alle 1.357 Routen)

Skript: `/work/audit/evidence/S02-classify-routes.py` (Python 3, keine
Abhängigkeiten). Ausgabe: `/work/audit/evidence/S02-routes-matrix.csv`.

Vorgehen je `route.ts`:

1. Kommentare werden entfernt (String-/Template-Literal-bewusster Scanner), damit
   die vielen erklärenden Kommentare (`// withAuth …`) keine Treffer erzeugen.
2. Jeder exportierte HTTP-Handler (`export (async) function|const GET|POST|PUT|
PATCH|DELETE|HEAD|OPTIONS`) wird isoliert. Als Region gilt der Text bis zum
   nächsten Top-Level-`export` — Brace-Matching ist hier unbrauchbar, weil
   `export async function GET(req: Request, { params }: { … })` bereits im
   _Parameter_-Teil eine Klammer öffnet (dieser Fehler in der ersten
   Skriptfassung erzeugte 1.104 falsche Lücken).
3. Drei Auflösungsschritte gegen Fehlalarme:
   - **Helper-Inlining:** Das verbreitete Muster
     `async function GET__ctx(req){ … withAuth() … }` +
     `export const GET = withErrorHandler(GET__ctx)` wird aufgelöst, indem alle
     im Region referenzierten Top-Level-Deklarationen (2 Ebenen tief) angehängt
     werden.
   - **Methoden-Aliase:** `export const PATCH = PUT;` erbt die Klassifikation von
     `PUT` (transitiv, max. 4 Sprünge).
   - **Re-Exporte:** `export { GET, POST } from "../x/route";` wird als
     `RE-EXPORT` markiert statt als Lücke.
4. Klassifiziert werden: `withAuth` (+ extrahierte Rollenliste),
   `validateScimToken` (SCIM-Bearer), Portal-Token-Validierer, API-Key-/HMAC-/
   Cron-Secret-Muster, rohes `auth()`, `alias308`-Weiterleitungen, 405-Stubs;
   dazu `requireModule("<key>")`, `requireRole`/`requireLineOfDefense`,
   `checkCustomRoleModuleAccess`, `withErrorHandler`-Wrapping und eine
   Org-Referenz-Heuristik (`ctx.orgId`/`orgId`/`organizationId`).
5. IDOR-Heuristik für dynamische Routen: Region ohne jede Org-Referenz
   (`no-org-ref`) bzw. `eq(<tabelle>.id, …)` ohne erkennbares `orgId`-Prädikat
   (`id-lookup-org-unclear`).

Reproduktion:

```
cd /work/audit/evidence && python3 S02-classify-routes.py
```

### 2.2 Schritt 2 — Manuelle Bewertung jeder Lücke

Alle 44 als `GAP-NO-AUTH` / `NO-HANDLER` / `STUB-405` / `PUBLIC-OK`
klassifizierten Handler wurden einzeln im Quelltext gelesen und gegen die
projekteigene Public-Allowlist in
`apps/web/src/__tests__/api/all-mutating-routes-auth-smoke.test.ts:163-320`
gehalten (die Datei ist die einzige explizite Soll-Dokumentation anonymer
Endpunkte im Repo).

### 2.3 Schritt 3 — Prüfung kompensierender Kontrollen (vor jeder Aufnahme)

| Kontrolle                                                            | geprüft                                                                                                          | Ergebnis                                                                                                                                                                    |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Globale Edge-Middleware                                              | `apps/web/src/middleware.ts:69-179`, Matcher `/((?!_next/static\|_next/image\|favicon.ico).*)`                   | greift für **alle** API-Pfade; deshalb sind Discovery-/Alias-/405-Stub-Routen **kein** Finding, sondern nur Info                                                            |
| Next.js-Middleware-Bypass CVE-2025-29927 (`x-middleware-subrequest`) | `apps/web/package.json:48` → `next ^16.2.11`, installiert 16.2.11                                                | nicht betroffen, **kein Finding**                                                                                                                                           |
| RLS als Org-Scoping-Netz                                             | `pg_class.relrowsecurity/relforcerowsecurity`, `pg_policies` gegen die laufende DB                               | greift für org-skalierte Tabellen; greift **nicht** für `feature_gate`, `subscription_plan`, `plugin`, `data_region`, `control_catalog*`, `risk_catalog*`, `user` (RLS aus) |
| Runtime-Rolle ohne BYPASSRLS                                         | `pg_roles`: `grc_app` `rolsuper=f`, `rolbypassrls=f`; `packages/db/src/index.ts:161`                             | bestätigt — deshalb ist S02-05 ein echter, kein theoretischer Defekt                                                                                                        |
| Request-Scoped RLS-Kontext                                           | `apps/web/src/lib/api.ts:74-160`, `apps/web/src/lib/api-wrapper.ts:82-140`, `packages/db/src/request-context.ts` | für `withAuth`-Routen wirksam; für die anonymen Token-Routen per Design nicht vorhanden                                                                                     |
| Projekteigener Auth-Smoke-Test                                       | `all-mutating-routes-auth-smoke.test.ts`                                                                         | deckt **nur** mutierende Handler ab; 618 lesende Handler ohne Rollenprüfung sind ungetestet (S02-19)                                                                        |

### 2.4 Verworfene Kandidaten (dokumentierte Falsch-Positive)

| Kandidat                                                                                                                                                                                  | Warum verworfen                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 36 `alias308`-Handler (`/api/v1/admin/{users,organizations,api-keys,sso-providers}`, `/api/v1/identity/*`, `/api/v1/dpms/transfer-impact-assessments`, `/api/v1/isms/management-reviews`) | geben ausschließlich 308 + `Location` zurück, führen keine Geschäftslogik aus; Auth am Ziel. `apps/web/src/lib/api-redirect.ts:6` konstruiert das Ziel aus `url.origin` + **statischem** Pfad → kein Open Redirect |
| 4 `STUB-405`-Handler + 6 weitere 405-Stubs (`/bpm/templates`, `/eam/applications`, `/programmes`, `/risk-acceptances`, `/whistleblowing/cases`, `/esg/erm-sync` GET)                      | geben nur `problem.methodNotAllowed()` zurück                                                                                                                                                                      |
| Discovery-Payloads (`/api/v1/{compliance,marketplace,rcsa,reports,identity,isms/nis2}`, `/bcms/crisis/dashboard`)                                                                         | statische Endpunkt-Listen, kein DB-Zugriff, zusätzlich hinter der Middleware                                                                                                                                       |
| `PATCH /api/v1/findings/[id]`, `PATCH /api/v1/risks/[id]/status`                                                                                                                          | `export const PATCH = PUT;` — erben `withAuth("admin", …)` vom PUT-Handler                                                                                                                                         |
| `/api/v1/dms/documents`, `/api/v1/vendors/[id]/assessments`                                                                                                                               | reine `export { GET, POST } from …`-Aliase                                                                                                                                                                         |
| `/api/v1/scim/v2/**` (10 Handler)                                                                                                                                                         | eigene Bearer-Token-Authentifizierung via `validateScimToken` (`packages/auth/src/scim/token-auth.ts:28`)                                                                                                          |
| Next.js Middleware-Bypass, unsichere Cookie-Defaults                                                                                                                                      | Next 16.2.11; Auth.js-v5-Defaults (`httpOnly`, `sameSite=lax`, `secure` bei `AUTH_URL=https://…`) sind gesetzt, `AUTH_TRUST_HOST=true` ist im Prod-Template vorhanden                                              |

---

## 3. Routen-Statistik

Vollständige Matrix: `/work/audit/evidence/S02-routes-matrix.csv`
(Spalten: `file, route, method, line, auth, auth_detail, roles, module,
org_scoped, err_wrapper, dynamic, public_by_mw, idor_risk, verdict`).

| Kennzahl                          |                          Wert |
| --------------------------------- | ----------------------------: |
| `route.ts`-Dateien                |                         1.357 |
| exportierte HTTP-Handler          |                         2.021 |
| GET / POST / PUT / DELETE / PATCH | 1.035 / 555 / 166 / 157 / 107 |

**Erstes Kettenglied (Authentifizierung):**

| Primitiv                                                 | Handler |
| -------------------------------------------------------- | ------: |
| `withAuth(...)`                                          |   1.918 |
| `alias308` (reine Weiterleitung)                         |      36 |
| `validateScimToken` (SCIM-Bearer)                        |      10 |
| Portal-Token (`validateDdToken`, `validateMailboxToken`) |       6 |
| `export … from` (Re-Export)                              |       4 |
| rohes `auth()`                                           |       3 |
| **keines**                                               |  **44** |

**Bewertung der 44 ohne Primitiv (Einzelprüfung, Abschnitt 2.2/2.4):**

| Kategorie                             | Handler | Bewertung                                                  |
| ------------------------------------- | ------: | ---------------------------------------------------------- |
| `alias308`/405-Stub/Discovery-Payload |      26 | Falsch-Positiv (kein Datenzugriff, Middleware davor)       |
| bewusst anonym laut Projekt-Allowlist |      12 | **defekt, aber fail-closed** → S02-04 / S02-05             |
| Health/Meta (Middleware-Allowlist)    |       4 | in Ordnung; `/api/health` ist _nicht_ allowlisted (S02-18) |
| Re-Export/kein Handler                |       2 | Falsch-Positiv                                             |
| **echte ungeschützte Datenendpunkte** |   **0** | —                                                          |

**Zweites/drittes Kettenglied (Autorisierung):**

| Kennzahl                                                   |      Wert |
| ---------------------------------------------------------- | --------: |
| Handler mit `withAuth(...)` **und** mindestens einer Rolle |     1.212 |
| Handler mit `withAuth()` **ohne** Rollenargument           |       709 |
| davon mutierend (POST/PUT/PATCH/DELETE)                    |    **91** |
| davon lesend (GET)                                         |       618 |
| mutierende Handler gesamt                                  |       985 |
| davon mit `requireModule(...)`                             |       617 |
| davon **ohne** `requireModule(...)`                        |   **368** |
| Handler mit `withErrorHandler`-Wrapper                     | 123 (6 %) |

**Rollenverwendung in `withAuth(...)` vs. DB-Enum `user_role`:**

| Rolle                  | Guard-Slots | im DB-Enum |
| ---------------------- | ----------: | ---------- |
| admin                  |       1.198 | ja         |
| risk_manager           |         710 | ja         |
| auditor                |         267 | ja         |
| dpo                    |         182 | ja         |
| process_owner          |         175 | ja         |
| viewer                 |         174 | ja         |
| control_owner          |         158 | ja         |
| whistleblowing_officer |          12 | ja         |
| vendor_manager         |          10 | ja         |
| **ciso**               |          29 | **nein**   |
| **esg_manager**        |          22 | **nein**   |
| **compliance_officer** |          18 | **nein**   |
| **esg_contributor**    |          14 | **nein**   |
| **ombudsperson**       |          12 | **nein**   |
| **quality_manager**    |          11 | **nein**   |
| **contract_manager**   |           6 | **nein**   |
| **bcm_manager**        |           1 | **nein**   |

**IDOR-Heuristik:** 29 dynamische Handler ohne jede Org-Referenz,
19 mit unklarem Org-Prädikat bei `eq(<tabelle>.id, …)`. Einzelbewertung in
S02-03 und S02-13.

---

## 4. Findings

IDs sind in Entdeckungsreihenfolge vergeben, nicht nach Severity sortiert.

| ID     | Severity | Titel                                                                             | Fundstelle                                                                 |
| ------ | -------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| S02-01 | Critical | Default-Admin `admin@arctos.dev` / `admin123` im dokumentierten Produktions-Setup | `packages/db/src/seed.ts:120`, `deploy/setup.sh:88`                        |
| S02-02 | Critical | Custom-Role-Fallback hebt jede Rollenprüfung auf → Selbstzuweisung `admin`        | `apps/web/src/lib/api.ts:203-234`                                          |
| S02-03 | Critical | Plattformweite Tabellen nur mit Mandanten-Rolle geschützt                         | `apps/web/src/app/api/v1/feature-gates/[id]/route.ts:28` u. a.             |
| S02-23 | Critical | SAML-Signaturprüfung ohne Digest-Verifikation → Assertion manipulierbar           | `packages/auth/src/saml/response-validator.ts:91-127`                      |
| S02-04 | High     | Middleware-Allowlist deckt die anonymen Fachkanäle nicht ab                       | `apps/web/src/middleware.ts:79-100`                                        |
| S02-05 | High     | Token-Endpunkte können ihr Token unter `grc_app` nicht auflösen (RLS-Henne-Ei)    | `apps/web/src/app/api/v1/invitations/[token]/accept/route.ts:16` u. a.     |
| S02-06 | High     | Audit-Sign-off ohne Rollenprüfung, `signerRole` client-bestimmt                   | `…/audit-mgmt/audits/[id]/sign-off/route.ts:34-39`                         |
| S02-07 | High     | Massenexport ohne Rolle, Limit und Vier-Augen-Prinzip                             | `…/export/bulk/route.ts:8-31`                                              |
| S02-08 | High     | Org-Kontext als Session-GUC auf Pool-Verbindung (Kontext-Leck)                    | `…/calendar/ical/[token]/route.ts:43-46`                                   |
| S02-09 | Medium   | Kein Rate-Limit/Lockout am Login; XFF-Spoofing umgeht das einzige Limit           | `packages/auth/src/providers.ts:178`, `apps/web/src/lib/rate-limit.ts:128` |
| S02-10 | Medium   | 91 mutierende Endpunkte ohne Rollenprüfung                                        | `S02-routes-matrix.csv`, `apps/web/src/lib/api.ts:203`                     |
| S02-11 | Medium   | 368 von 985 mutierenden Handlern ohne `requireModule`                             | `packages/auth/src/middleware/module-guard.ts:16`                          |
| S02-12 | Medium   | Keine Funktionstrennung im BPMN-Freigabezyklus                                    | `packages/shared/src/process-approval.ts:63-71`                            |
| S02-13 | Medium   | `GET /users/[id]/roles` ohne Org-Filter                                           | `…/users/[id]/roles/route.ts:46-62`                                        |
| S02-14 | Medium   | Rollenmodell dreifach inkonsistent (9 / 20 / 17 Rollen)                           | `packages/shared/src/types/platform.ts:3-26`, `pg_enum`                    |
| S02-15 | Medium   | SCIM-Bearer-Token ohne Ablauf und Rotation                                        | `packages/auth/src/scim/token-auth.ts:28-60`                               |
| S02-24 | Medium   | OIDC-ID-Token ohne Signaturprüfung akzeptiert                                     | `packages/auth/src/oidc/id-token-validator.ts:69-115`                      |
| S02-16 | Low      | Session ohne Rotation/Idle-Timeout, Rollen im JWT bis 8 h alt                     | `packages/auth/src/config.ts:12`                                           |
| S02-17 | Low      | Benutzer-Enumeration über Antwortzeit; uneinheitliche E-Mail-Normalisierung       | `packages/auth/src/providers.ts:196-213`                                   |
| S02-18 | Low      | Break-Glass-Login prüft die SSO-Bedingung nicht, die er dokumentiert              | `…/auth/admin-login/route.ts:1-9`                                          |
| S02-19 | Low      | `/api/health` nicht in der Middleware-Allowlist                                   | `apps/web/src/app/api/health/route.ts:6`                                   |
| S02-20 | Low      | Portal-Token im Klartext gespeichert; IP-„Pseudonymisierung" umkehrbar            | `apps/web/src/lib/portal-auth.ts:20-64`                                    |
| S02-21 | Info     | Auth-Smoke-Test deckt nur mutierende Routen ab                                    | `…/all-mutating-routes-auth-smoke.test.ts:359`                             |
| S02-22 | Info     | Discovery-/Alias-/405-Stub-Routen ohne eigene Autorisierung                       | 26 Handler, siehe CSV                                                      |

---

### S02-01 — Dokumentiertes Produktions-Setup legt Admin mit bekanntem Passwort an

**Severity: Critical**

**Evidenz**

`packages/db/src/seed.ts:120-131`:

```ts
    // 3. Create admin user (idempotent)
    const passwordHash = await hash("admin123", 12);
    const [admin] = await tx
      .insert(user)
      .values({
        email: "admin@arctos.dev",
        name: "Platform Admin",
        passwordHash,
        emailVerified: new Date(),
```

Die Datei enthält **keinerlei** Environment-Guard (`grep -n "NODE_ENV\|production\|ALLOW_SEED" packages/db/src/seed.ts` → keine Treffer). Der Seed vergibt der
Kennung anschließend die Rolle `admin` in beiden angelegten Organisationen
(`seed.ts:139-158`).

`deploy/.env.production.example:48`:

```
RUN_SEEDS=true
```

`deploy/setup.sh:85-88` (die vom Handbuch vorgegebene Produktionsinstallation):

```sh
echo "  6. docker compose -f docker-compose.production.yml exec web npm run db:seed"
echo ""
echo "Login: admin@arctos.dev / admin123"
```

`deploy/create-tenant.sh:267` wiederholt das pro neu angelegtem Mandanten:

```sh
echo "  Login:     admin@arctos.dev / admin123"
```

`docker-compose.production.yml:225` übernimmt `RUN_SEEDS: ${RUN_SEEDS:-false}`,
das Produktions-Template setzt es auf `true`.

**Angriffsszenario**

Angreifer liest das öffentlich klonbare Repository (BASE-001), entnimmt Kennung
und Passwort aus `deploy/setup.sh`, ruft die Login-Seite einer beliebigen
ARCTOS-Instanz auf und meldet sich als `admin@arctos.dev` / `admin123` an. Da der
Seed idempotent per `onConflictDoNothing` läuft und die Rotation ein
_dokumentierter manueller Schritt_ ist, existiert die Kennung auf jeder Instanz,
bei der der Betreiber diesen Schritt nicht ausgeführt hat. Ergebnis: vollständige
Admin-Rechte in den geseedeten Organisationen; über S02-02/S02-03 weiter
eskalierbar.

Bestätigt wird die Erwartungshaltung im Code selbst —
`apps/web/src/app/api/v1/auth/admin-login/route.ts:12-15`:

```ts
// #SEC-HIGH-RL: rate-limit by client IP. The break-glass endpoint
// bypasses NextAuth's own throttling. Memory note: prod
// admin@arctos.dev still ships with the default `admin123` password
// pending the operator's rotation step.
```

**Severity-Begründung**

Rubrik „Authentifizierungs-Bypass" und „Secret-Exposure mit Produktivbezug".
Die Zugangsdaten sind nicht abgeleitet, nicht instanzspezifisch und stehen im
öffentlichen Repository; die Kompromittierung ist ohne jede weitere Voraussetzung
möglich. `SECURITY.md:34` behauptet, die Kennung werde „only seeded into demo
tenants" — `deploy/setup.sh` und `deploy/create-tenant.sh` widerlegen das für den
dokumentierten Produktionspfad.

---

### S02-02 — `withAuth()`-Custom-Role-Fallback hebt die gesamte Rollenprüfung auf

**Severity: Critical**

**Evidenz**

`apps/web/src/lib/api.ts:203-216`:

```ts
if (roles.length) {
  const check = requireRole(...roles)(session, orgId, requestId);
  if (check) {
    // Standard role denied — check custom roles as fallback
    const hasCustomAccess = await checkCustomRoleAccess(session.user.id, orgId);
    if (!hasCustomAccess) return check;
  }
}

return { session, orgId, userId: session.user.id };
```

`apps/web/src/lib/api.ts:222-235`:

```ts
async function checkCustomRoleAccess(
  userId: string,
  orgId: string,
): Promise<boolean> {
  const result = await db.execute(
    sql`SELECT 1 FROM user_custom_role ucr
        JOIN custom_role cr ON cr.id = ucr.custom_role_id
        JOIN role_permission rp ON rp.role_id = cr.id
        WHERE ucr.user_id = ${userId}
          AND ucr.org_id = ${orgId}
          AND rp.action != 'none'
        LIMIT 1`,
  );
  return (result?.length ?? 0) > 0;
}
```

Die Prüfung kennt **weder das geforderte Modul noch die geforderte Aktion**. Die
modulbewusste Variante `checkCustomRoleModuleAccess(userId, orgId, moduleKey,
action)` existiert direkt darunter (`api.ts:241-270`), wird von `withAuth` aber
nicht verwendet — sie wird im gesamten `apps/web/src/app/api`-Baum von keinem
einzigen Handler aufgerufen (Spalte `auth_detail` der Matrix: 0 Treffer
`customRole`).

**Reproduktion** (rollback-sicher gegen die laufende Audit-DB):

```
PGPASSWORD=grc_dev_password psql -h localhost -U grc -d grc_platform
BEGIN;
INSERT INTO "user" (id,email,name,password_hash,is_active,language)
 VALUES ('11111111-…-111111111111','s02-poc@example.test','S02 PoC','x',true,'de');
INSERT INTO user_organization_role (user_id,org_id,role,line_of_defense)
 VALUES ('11111111-…','aaaaaaaa-0000-0000-0000-000000000001','viewer','first');
INSERT INTO custom_role (id,org_id,name,is_system)
 VALUES ('22222222-…','aaaaaaaa-…','S02 PoC Rolle',false);
INSERT INTO role_permission (role_id,module_key,action) VALUES ('22222222-…','erm','read');
INSERT INTO user_custom_role (user_id,org_id,custom_role_id)
 VALUES ('11111111-…','aaaaaaaa-…','22222222-…');
-- exakt die Query aus api.ts:226
SELECT 1 FROM user_custom_role ucr JOIN custom_role cr ON cr.id=ucr.custom_role_id
  JOIN role_permission rp ON rp.role_id=cr.id
 WHERE ucr.user_id='11111111-…' AND ucr.org_id='aaaaaaaa-…' AND rp.action!='none' LIMIT 1;
ROLLBACK;
```

Ausgabe:

```
 custom_role_fallback_hit
--------------------------
                        1
 role
--------
 viewer
```

Der Nutzer hat die Enum-Rolle `viewer` und eine Custom-Rolle mit ausschließlich
`erm:read`. Der Fallback liefert `true` → `withAuth("admin")` gibt einen gültigen
`ApiContext` statt 403 zurück.

**Angriffsszenario**

Ein Mandant vergibt an einen Fachanwender eine Custom-Rolle „Leserecht ERM"
(genau der dokumentierte Anwendungsfall der Custom-Rollen; die
System-Custom-Rollen aus Migration `0096` sind exakt so gebaut). Dieser Anwender
ruft auf:

```
POST /api/v1/users/<seine-eigene-user-id>/roles
{ "role": "admin", "lineOfDefense": "first" }
```

`apps/web/src/app/api/v1/users/[id]/roles/route.ts:72-100` schützt diesen Handler
mit `withAuth("admin")`. Der Standard-Check schlägt fehl (`viewer` ≠ `admin`), der
Fallback greift, der Handler läuft und schreibt

```ts
      .insert(userOrganizationRole)
      .values({ userId, orgId: ctx.orgId, role: body.data.role, … })
```

Der Anwender ist damit Admin seiner Organisation — und über S02-03 anschließend
mandantenübergreifend wirksam. Derselbe Fallback öffnet außerdem jede
DELETE-Route, die Freigabe-Endpunkte (`canDecideApprovalStep` prüft `admin`,
siehe S02-11) und die Organisationsverwaltung.

**Severity-Begründung**

Die Rubrik nennt „Privilegieneskalation innerhalb eines Mandanten" als High. Hier
ist jedoch nicht _eine_ Route betroffen, sondern der zentrale, von 1.212 Handlern
genutzte Rollenprüfpunkt — die Rollenschicht der Plattform ist als Ganzes
wirkungslos, sobald ein Nutzer eine beliebige Custom-Rolle besitzt, und der
Eskalationspfad endet bei `admin` mit anschließender mandantenübergreifender
Wirkung (S02-03). Bewertung daher Critical.

---

### S02-03 — Plattformweite Tabellen nur mit der Mandanten-Rolle `admin` geschützt

**Severity: Critical**

**Evidenz**

Die betroffenen Tabellen haben **kein** `org_id`, **keine** RLS und **keine**
Policy (Abfrage gegen die laufende DB):

```
relname            | has_org_id | rowsecurity | force | policies
-------------------+------------+-------------+-------+---------
feature_gate       |          0 | f           | f     |        0
subscription_plan  |          0 | f           | f     |        0
plugin             |          0 | f           | f     |        0
data_region        |          0 | f           | f     |        0
framework_mapping  |          0 | f           | f     |        0
programme_template |          0 | f           | f     |        0
control_catalog    |          0 | f           | f     |        0
risk_catalog       |          0 | f           | f     |        0
template_pack      |          0 | f           | f     |        0
```

Zugehörige Schreib-Endpunkte und die Rolle, die dafür genügt:

| Endpunkt                                                                                                            | erforderliche Rolle             | betroffene globale Tabelle |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------- | -------------------------- |
| `POST/PATCH/DELETE /api/v1/feature-gates[/{id}]`                                                                    | `admin`                         | `feature_gate`             |
| `POST/PATCH /api/v1/subscriptions/plans[/{id}]`                                                                     | `admin`                         | `subscription_plan`        |
| `POST /api/v1/plugins`, `PATCH/DELETE /api/v1/plugins/{id}`                                                         | `admin`                         | `plugin`                   |
| `POST/PATCH /api/v1/data-sovereignty/regions[/{id}]`                                                                | `admin`                         | `data_region`              |
| `POST /api/v1/framework-mappings`, `PATCH /api/v1/framework-mappings/{id}`, `POST /api/v1/framework-mappings/rules` | `admin` **oder `risk_manager`** | `framework_mapping`        |

Die Schreib-Endpunkte prüfen nur `withAuth("admin")` und filtern nicht nach Org
(Spalte `org_scoped=False` in der Matrix):

`apps/web/src/app/api/v1/feature-gates/[id]/route.ts:28-52`:

```ts
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;
  …
  const [updated] = await db
    .update(featureGate)
    .set({ ...body.data, updatedAt: new Date() })
    .where(eq(featureGate.id, id))
    .returning();
```

`apps/web/src/app/api/v1/plugins/route.ts:7-21`:

```ts
export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  …
  const [created] = await db.insert(plugin).values(body.data).returning();
```

`apps/web/src/app/api/v1/framework-mappings/[id]/route.ts:7-22` — hier genügt
nicht einmal `admin`; der lesende Handler verlangt gar keine Rolle und filtert
nicht nach Org:

```ts
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  …
  const [row] = await db
    .select()
    .from(frameworkMapping)
    .where(eq(frameworkMapping.id, id));
```

und `:24-28` für den Schreibpfad:

```ts
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
```

Gleiches Muster: `POST|PATCH /api/v1/subscriptions/plans[/{id}]`,
`POST|PATCH /api/v1/data-sovereignty/regions[/{id}]`,
`PATCH|DELETE /api/v1/plugins/[id]`, `DELETE /api/v1/feature-gates/[id]`,
`POST /api/v1/framework-mappings`, `POST /api/v1/framework-mappings/rules`.

`admin` ist eine **pro-Organisation** vergebene Rolle
(`user_organization_role(user_id, org_id, role)`, geprüft in
`packages/auth/src/rbac.ts:65-79` gegen `r.orgId === orgId`). Ein
Plattform-Administrator-Konzept existiert nicht:
`grep -rn "platform_admin|platformAdmin|superadmin|super_admin|isPlatformAdmin"`
über `apps/` und `packages/` liefert genau zwei Treffer — ein i18n-Label und ein
Negativtest.

**Angriffsszenario**

Mandant B (regulärer Kunde, eigener Org-Admin) ruft auf:

```
GET   /api/v1/feature-gates            → Liste aller plattformweiten Gates
PATCH /api/v1/feature-gates/<gate-id>  { "defaultValue": false, "planOverrides": {} }
```

Die Änderung wirkt auf **alle** Mandanten, weil `feature_gate` global ist und
`GET /api/v1/feature-gates/check` (`withAuth()`, jede Rolle) daraus die
Feature-Verfügbarkeit ableitet. Analog kann derselbe Admin über
`PATCH /api/v1/subscriptions/plans/{id}` die Plan-/Limit-Definitionen aller
Mandanten ändern, über `POST /api/v1/plugins` einen Eintrag in der globalen
Plugin-Registry anlegen, den andere Mandanten über
`GET /api/v1/plugins/marketplace` (`withAuth()`, ohne Rolle) angeboten bekommen,
und über `PATCH /api/v1/data-sovereignty/regions/{id}` die Regionsdefinitionen
verändern, auf denen die Data-Sovereignty-Zusage des Produkts beruht.

Besonders niedrigschwellig ist der Framework-Mapping-Pfad: die Rolle
`risk_manager` (in 710 Guard-Slots vergeben, also eine Alltagsrolle) genügt, um
über `PATCH /api/v1/framework-mappings/{id}` die plattformweit geteilte
Control-Mapping-Tabelle zu verändern — `relationship_type` und `confidence`
steuern bei allen Mandanten die Cross-Framework-Gap-Analyse
(`POST /api/v1/framework-mappings/cross-framework-gap`, für jede Rolle offen).
Ein Mandant kann damit die Compliance-Aussage eines anderen Mandanten
verfälschen.

In Kombination mit S02-02 genügt dafür ein beliebiger Nutzer mit einer
Custom-Rolle.

**Severity-Begründung**

Rubrik „Cross-Tenant-Datenzugriff": ein Mandant kann Zustand verändern, der
außerhalb seines Mandanten wirksam wird, ohne dass eine Kontrolle das verhindert
(weder RBAC — die Rolle ist mandantengebunden, aber die Ressource nicht — noch
RLS, die auf diesen Tabellen nicht existiert). Betroffen sind Abrechnungs-,
Feature- und Data-Sovereignty-Konfiguration, also Integritäts- und
Verfügbarkeitswirkung über Mandantengrenzen hinweg.

---

### S02-04 — Middleware-Allowlist deckt die anonymen Fachkanäle nicht ab

**Severity: High**

**Evidenz**

`apps/web/src/middleware.ts:79-100` — die vollständige Public-Allowlist:

```ts
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname === "/api/v1/health" ||
    pathname.startsWith("/api/v1/whistleblowing/intake") ||
    pathname.startsWith("/api/v1/meta")
  ) {
```

`apps/web/src/middleware.ts:107-134` — alles andere ohne Session:

```ts
  if (!req.auth?.user) {
    // API routes get 401 JSON — never redirect to HTML login page
    if (pathname.startsWith("/api/")) {
      return withRequestId(
        new Response(
          JSON.stringify({ …, status: 401, detail: "Authentication required", … }),
```

`apps/web/src/middleware.ts:177` — Geltungsbereich:

```ts
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
```

Die projekteigene Soll-Liste anonymer Endpunkte
(`apps/web/src/__tests__/api/all-mutating-routes-auth-smoke.test.ts:163-249`,
Kommentar: „Source of truth: docs/security/lod-coverage.md") nennt u. a.:

```ts
  "/api/v1/auth/admin-login":            { reason: "Break-glass login endpoint; …" },
  "/api/v1/auth/sso/saml/callback":      { reason: "SSO callback; validated via SAML assertion, not session" },
  "/api/v1/invitations/[token]/accept":  { reason: "Public invite-accept; single-use path token is the credential" },
  "/api/v1/portal/dd/[token]/{evidence,responses,submit}",
  "/api/v1/vendors/dd/submit",
  "/api/v1/portal/report/[orgCode]":     { reason: "Whistleblower intake; anonymity is a legal requirement" },
  "/api/v1/portal/mailbox/[token]",
  "/api/v1/portal/mailbox/[token]/evidence",
```

sowie ausdrücklich die SCIM-Endpunkte
(`…test.ts:321-325`: „the SCIM endpoints (/api/v1/scim/v2/*) … validate their own
Bearer token"). Keiner dieser Pfade beginnt mit einem der fünf Allowlist-Präfixe:
`/api/v1/auth/…` ≠ `/api/auth`, `/api/v1/portal/…`, `/api/v1/scim/…`,
`/api/v1/invitations/…`, `/api/v1/calendar/ical/…`, `/api/v1/branding/css/…`
sind alle nicht enthalten. Auch die zugehörigen UI-Seiten sind nicht
allowlisted (`/admin-login` beginnt nicht mit `/login`; `apps/web/src/app/(portal)/report/[orgCode]/page.tsx`
liegt unter `/report/…`).

Die Aufrufer sind eindeutig unauthentifizierte Kontexte:

- `apps/web/src/app/(auth)/login/page.tsx:38` ruft
  `/api/v1/auth/sso/config?orgId=…` **auf der Login-Seite** auf,
  `:90-91` leitet auf `/api/v1/auth/sso/{saml,oidc}/login` weiter.
- `apps/web/src/app/(auth)/admin-login/page.tsx:24` postet auf
  `/api/v1/auth/admin-login`.
- `apps/web/src/app/(portal)/report/[orgCode]/page.tsx:100,126` und
  `…/report/mailbox/[token]/page.tsx:65,89,111` sind das HinSchG-Meldeportal.
- Ein SCIM-Provisioning-Client des Identity-Providers und ein Kalender-Client
  (`/api/v1/calendar/ical/[token]`) senden per Definition kein Session-Cookie.

**Angriffs-/Fehlerszenario**

Eingabe: Eine hinweisgebende Person ruft ohne Konto
`https://<instanz>/report/<orgCode>` auf.
Wirkung: Die Middleware findet keine Session, der Pfad ist nicht allowlistet →
Redirect auf `/login?callbackUrl=/report/<orgCode>`. Der Meldekanal ist ohne
Benutzerkonto nicht erreichbar. Für `fetch("/api/v1/portal/report/<orgCode>")`
liefert die Middleware 401 `application/problem+json`.

Analog: SAML-IdP postet die Assertion auf
`/api/v1/auth/sso/saml/callback` → 401, bevor der Handler die Assertion sieht;
SSO-Login ist unmöglich. Der Break-Glass-Login, der genau für den Fall gedacht
ist, dass SSO ausfällt oder niemand mehr hineinkommt, ist ebenfalls nur mit
bestehender Session erreichbar — also genau dann nicht, wenn er gebraucht wird.
SCIM-Provisioning und Deprovisioning (Offboarding!) schlagen mit 401 fehl.

**Severity-Begründung**

Der Defekt schließt (fail-closed), erzeugt also keinen unautorisierten Zugriff —
deshalb nicht Critical. Er macht aber einen gesetzlich vorgeschriebenen
Meldekanal (HinSchG §§ 12, 16 — das Produkt wirbt genau damit, siehe
`middleware.ts:72-82`) technisch unbenutzbar, verhindert das automatisierte
Deprovisioning ausgeschiedener Mitarbeiter über SCIM (ein Zugriffskontroll-Risiko
zweiter Ordnung) und beseitigt den einzigen Notfall-Zugang zur Plattform.
Rubrik High („Umgehung von Segregation-of-Duties" bzw. Compliance-Zusage, die
technisch nicht gehalten wird).

**Hinweis zur Abgrenzung:** `/api/v1/whistleblowing/intake/submit` ist
allowlistet und funktioniert als zweiter, paralleler Meldepfad. Es existieren
damit zwei Implementierungen desselben Fachkanals, von denen nur eine erreichbar
ist — die UI verlinkt die nicht erreichbare.

---

### S02-05 — Token-basierte anonyme Endpunkte können ihr Token unter `grc_app` nicht auflösen (RLS-Henne-Ei-Problem)

**Severity: High**

**Evidenz**

Alle anonymen Token-Endpunkte lesen ihre Zugangstabelle über den `db`-Proxy
**ohne** etablierten Request-Kontext — es kann keinen geben, weil die Org erst
_aus_ dem Token folgt.

`apps/web/src/app/api/v1/invitations/[token]/accept/route.ts:16-21`:

```ts
const [inv] = await db
  .select()
  .from(invitation)
  .where(eq(invitation.token, token))
  .limit(1);
```

`packages/auth/src/scim/token-auth.ts:38-48`:

```ts
const [found] = await db
  .select({
    id: scimToken.id,
    orgId: scimToken.orgId,
    isActive: scimToken.isActive,
  })
  .from(scimToken)
  .where(and(eq(scimToken.tokenHash, tokenHash), eq(scimToken.isActive, true)));
```

`apps/web/src/lib/portal-auth.ts:24-26` (Vendor-DD), `…/portal/mailbox/[token]/route.ts:26-28`
(Whistleblower-Postfach), `…/portal/report/[orgCode]/route.ts:24-26`,
`…/branding/css/[orgId]/route.ts:26-29` folgen demselben Muster.

Die Zieltabellen haben FORCE-RLS mit strikter Org-Policy (laufende DB):

```
relname              | rowsecurity | force | owner
---------------------+-------------+-------+------
invitation           | t           | t     | grc
scim_token           | t           | t     | grc
vendor_due_diligence | t           | t     | grc
org_branding         | t           | t     | grc

invitation | invitation_tenant_select | SELECT
   | (org_id = (NULLIF(current_setting('app.current_org_id', true), ''))::uuid)
```

Die Laufzeitrolle ist nachweislich nicht privilegiert:

```
 rolname | rolsuper | rolbypassrls
---------+----------+--------------
 grc     | t        | f
 grc_app | f        | f
```

und `packages/db/src/index.ts:161-162` bindet den Laufzeit-Pool daran:

```ts
const RUNTIME_DATABASE_URL =
  process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL!;
```

**Reproduktion** (rollback-sicher):

```sql
BEGIN;
GRANT SELECT ON invitation TO grc_app;
INSERT INTO invitation (id, org_id, email, role, token, status, expires_at)
VALUES ('33333333-…','aaaaaaaa-0000-0000-0000-000000000001','poc@example.test',
        'viewer','S02POCTOKEN0000000000000000000000000000','pending', now()+interval '7 days');
SET ROLE grc_app;
SELECT count(*) FROM invitation WHERE token='S02POCTOKEN…';          -- ohne Org-Kontext
SELECT set_config('app.current_org_id','aaaaaaaa-…',true);
SELECT count(*) FROM invitation WHERE token='S02POCTOKEN…';          -- mit Org-Kontext
ROLLBACK;
```

Ausgabe:

```
--- grc_app OHNE app.current_org_id (Laufzeit der oeffentlichen Token-Route): ---
 rows_visible
--------------
            0
--- grc_app MIT Org-Kontext: ---
 rows_visible
--------------
            1
```

**Fehlerszenario**

Eingabe: `POST /api/v1/invitations/<gültiges Token>/accept` in einer Produktion
mit gesetztem `APP_DATABASE_URL` (laut `.env.example:17` „Production MUST set
APP_DATABASE_URL").
Wirkung: Die Abfrage liefert 0 Zeilen, der Handler antwortet
`404 {"error":"Invalid invitation token"}`. Ein gültiges Token ist von einem
ungültigen nicht unterscheidbar; Einladungen können nie angenommen werden.
Identisch für SCIM (`401 Unauthorized` auf jedes gültige Bearer-Token),
Vendor-DD-Portal, das anonyme Whistleblower-Postfach (`wb_report`/`wb_case` sind
ebenfalls FORCE-RLS) und `GET /api/v1/branding/css/{orgId}`.

Der `db`-Proxy fällt für diese Routen auf `baseDb` zurück
(`packages/db/src/index.ts:337-365`); der Kommentar dort bestätigt die
Wirkungsrichtung ausdrücklich: „These connections are never pinned to an org
context at session level … RLS returns 0 rows".

**Severity-Begründung**

Wieder fail-closed, kein unautorisierter Zugriff. Aber: der Defekt trifft dieselben
gesetzlich/vertraglich zugesagten Kanäle wie S02-04 und ist von diesem
_unabhängig_ — er bliebe bestehen, wenn man nur die Middleware-Allowlist
reparierte. Zusätzlich betroffen: SCIM-Deprovisioning (Offboarding von
ausgeschiedenen Mitarbeitern läuft nicht) und die Annahme von Einladungen, also
der einzige Weg, überhaupt Nutzer in eine Org zu bekommen, ohne Admin-Konsole.
High.

---

### S02-06 — Audit-Sign-off ohne Rollenprüfung, `signerRole` vom Client bestimmt

**Severity: High**

**Evidenz**

`apps/web/src/app/api/v1/audit-mgmt/audits/[id]/sign-off/route.ts:15-39`:

```ts
const signOffSchema = z.object({
  signoffType: z.enum([
    "fieldwork_complete", "report_draft", "report_approved", "published", "closed",
  ]),
  signerRole: z.enum([
    "admin", "lead_auditor", "auditor", "auditee",
    "qa_reviewer", "compliance_officer", "management",
  ]),
  comments: z.string().max(2000).optional().nullable(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("audit", ctx.orgId, req.method);
  if (m) return m;
```

`withAuth()` ohne Argumente prüft ausschließlich, dass eine Session und ein
Org-Kontext existieren (`apps/web/src/lib/api.ts:203`: `if (roles.length)` — bei
leerer Liste wird der Rollenblock übersprungen). Der beanspruchte `signerRole`
wird nirgends gegen `ctx.session.user.roles` validiert; er wird direkt in die
hash-ketten-verankerte Sign-off-Zeile geschrieben.

**Angriffsszenario**

Ein Nutzer mit der Rolle `viewer` (reines Leserecht) sendet:

```
POST /api/v1/audit-mgmt/audits/<audit-id>/sign-off
{ "signoffType": "report_approved", "signerRole": "management",
  "comments": "Freigegeben." }
```

Ergebnis: eine kryptografisch verkettete Sign-off-Zeile, die behauptet, das
Management habe den Prüfbericht freigegeben. Die Hash-Kette macht den Eintrag
_unveränderlich_, nicht _wahr_ — sie zementiert die Falschaussage. Für einen
externen Prüfer ist dieser Eintrag von einer echten Management-Freigabe nicht
unterscheidbar.

**Severity-Begründung**

Rubrik High: Umgehung von Segregation-of-Duties und der Three-Lines-Zusage;
zugleich eine Beeinträchtigung der Aussagekraft des Audit-Trails (die Rubrik
stuft „Manipulierbarkeit des Audit-Trails" als Critical ein — hier wird der
Trail nicht nachträglich verändert, sondern von vornherein mit unbelegten
Rollenbehauptungen befüllt; deshalb High, mit Übergabe an S03 zur
Adversarial-Prüfung).

---

### S02-07 — Massenexport ohne Rollenprüfung, ohne Mengenbegrenzung, ohne Vier-Augen-Prinzip

**Severity: High**

**Evidenz**

`apps/web/src/app/api/v1/export/bulk/route.ts:7-31`:

```ts
export async function POST(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const body = bulkExportSchema.safeParse(await req.json());
  …
    for (const entityType of body.data.entityTypes) {
      const result = await exportEntities(entityType, "csv", {}, ctx.orgId);
      results.push({ entityType, data: result.data.toString("utf-8"), rowCount: result.rowCount });
    }
```

`withAuth()` ohne Rollen; kein `requireModule` (Matrix: `module = -`); der
Filter-Parameter ist fest `{}` — es wird also jeweils der **vollständige**
Datenbestand der Org exportiert. Es gibt keine Obergrenze für `entityTypes` und
keine Rate-Limitierung (`rateLimit` wird in genau 5 der 1.357 Routendateien
verwendet, diese gehört nicht dazu).

Die Protokollierung ist zudem best-effort und verschluckt Fehler
(`route.ts:37-57`):

```ts
    } catch (logErr) {
      console.error("[export/bulk] Failed to log:", …);
    }
```

d. h. der Export gelingt auch dann, wenn der Eintrag in `data_export_log` nicht
geschrieben werden kann.

**Angriffsszenario**

Ein Nutzer mit der Rolle `viewer` (oder jeder anderen) sendet einen einzigen
POST mit allen unterstützten `entityTypes` und erhält die gesamte
GRC-Datenbasis seiner Organisation als CSV, einschließlich der Entitäten, die der
Handler selbst als personenbezogen kennzeichnet (`containsPersonalData`-Zweig
listet `ropa_entry`, `incident`). Kein Vier-Augen-Prinzip, keine Freigabe, keine
Mengenbegrenzung; bei Fehlschlag der Protokollierung bleibt der Vorgang
unbemerkt.

**Severity-Begründung**

Rubrik High: „DSGVO-Verstoß mit Meldepflicht-Potenzial". Ein Massenexport
personenbezogener Daten durch einen Nutzer mit reinem Leserecht, ohne wirksame
Protokollgarantie, ist der klassische Insider-Exfiltrationspfad; in einem
GRC-Produkt ist die fehlende Kontrolle zugleich ein Widerspruch zur eigenen
Fachdomäne.

---

### S02-08 — Org-Kontext wird als Session-GUC auf eine Pool-Verbindung geschrieben (Kontext-Leck)

**Severity: High**

**Evidenz**

`apps/web/src/app/api/v1/calendar/ical/[token]/route.ts:43-46`:

```ts
// Set RLS context for the aggregation queries
await db.execute(sql`SELECT set_config('app.current_org_id', ${orgId}, false)`);
```

Das dritte Argument `false` bedeutet `is_local = false` → **Session-Level**, nicht
transaktionslokal. Der Aufruf läuft über den `db`-Proxy; da dieser Handler kein
`withAuth` verwendet, existiert kein reservierter Request-Kontext, und der Proxy
löst auf `baseDb` — den **geteilten Basis-Pool** — auf
(`packages/db/src/index.ts:337-365`).

Der Basis-Pool ist im Code ausdrücklich als kontextfrei dokumentiert
(`packages/db/src/index.ts:166-171`):

```ts
// Base pool — used by ALL non-request code paths: the worker's 128 cron files,
// the event-bus / webhook-dispatch, seeds, and any web query that runs OUTSIDE
// an authenticated request (public routes, login). These connections are never
// pinned to an org context at session level (…), so the base pool always stays
// "clean" (app.current_org_id unset → RLS returns 0 rows, never throws).
```

Genau diese Invariante bricht die iCal-Route. Zwei Worker-Cronjobs tun dasselbe:

- `apps/worker/src/crons/calendar-digest.ts:72-74`
- `apps/worker/src/crons/calendar-overdue-check.ts:36-38`

```ts
await db.execute(sql`SELECT set_config('app.current_org_id', ${orgId}, false)`);
```

Beide setzen den GUC in einer Schleife **je Org** und führen die Folgeabfragen
als _separate_ Statements über denselben Pool aus.

**Angriffs-/Fehlerszenario**

1. _Kontext-Leck:_ Ein iCal-Abruf für Org A pinnt `app.current_org_id = A` auf
   eine Basis-Pool-Verbindung. Die Verbindung wandert in den Pool zurück (kein
   `RESET`, kein Scrubbing — der Code kennt Scrubbing nur für den _Request_-Pool,
   `packages/db/src/request-context.ts:239-242`). Jede spätere, eigentlich
   kontextfreie Abfrage auf derselben Verbindung — Login-Bootstrap
   (`withUserReadContext` reserviert aus **genau diesem** Pool,
   `request-context.ts:288`), Event-Bus, Webhook-Dispatch, ein Worker-Job —
   sieht nun Org A. Wo der Code sich darauf verlässt, dass RLS ohne Kontext
   0 Zeilen liefert, liefert sie jetzt Zeilen von Org A. `idle_timeout: 20`
   begrenzt das Fenster auf 20 s Leerlauf, nicht auf die Anfragedauer.
2. _Falschverarbeitung im Cron:_ `postgres-js` garantiert für zwei getrennte
   `db.execute()`-Aufrufe **nicht** dieselbe Verbindung. Der `set_config`-Aufruf
   kann auf Verbindung 1 landen, die nachfolgende Aggregation auf Verbindung 2.
   In `calendar-digest.ts` verarbeitet die Schleife Org für Org — der Job kann
   also Kalendereinträge unter dem Kontext einer _anderen_ Org lesen und die
   daraus erzeugten Benachrichtigungen an die falschen Empfänger schreiben.

**Severity-Begründung**

High. Der Pfad zu einem echten mandantenübergreifenden Lesezugriff ist real, aber
nicht direkt durch einen Angreifer steuerbar (er hängt vom Pool-Scheduling ab) —
deshalb nicht Critical. Er verletzt eine im Code ausdrücklich formulierte
Sicherheitsinvariante und untergräbt die RLS-Absicherung, auf der die gesamte
Mandantentrennung ruht. Übergabe an S01 zur Bestätigung der Auswirkung auf
Tabellenebene.

---

### S02-09 — Kein Rate-Limit und keine Sperre am primären Login; das einzige vorhandene Limit ist über `X-Forwarded-For` umgehbar

**Severity: Medium**

**Evidenz**

Der reguläre Login läuft über den Auth.js-Credentials-Provider
(`packages/auth/src/providers.ts:178-270`) und damit über
`/api/auth/callback/credentials`. Dieser Pfad enthält keinerlei Drosselung:
`authorize()` liest den Nutzer, vergleicht mit `bcrypt.compare` und protokolliert
Fehlversuche in `access_log` — ohne Zähler, ohne Sperre, ohne Verzögerung. Es gibt
keine Spalte für fehlgeschlagene Versuche und keinen Lockout-Mechanismus
(`grep -rn "lockout\|failed_attempts\|locked_until"` über `packages/auth` und
`packages/db/src/schema` → keine Treffer).

Rate-Limiting existiert als Bibliothek (`apps/web/src/lib/rate-limit.ts`), wird
aber in genau **5 von 1.357** Routendateien verwendet:

```
api/v1/ai/suggest-controls/route.ts
api/v1/ai/draft-policy/route.ts
api/v1/ai/explain-gap/route.ts
api/v1/auth/admin-login/route.ts
api/v1/copilot/conversations/[id]/messages/route.ts
```

Die einzige auth-bezogene Nutzung (`admin-login`) ist zudem nach S02-04 gar nicht
erreichbar. Der Schlüssel wird aus einem client-kontrollierten Header gebildet —
`apps/web/src/lib/rate-limit.ts:128-134`:

```ts
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? "unknown";
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
```

Es wird der **erste** (also der vom Client gesetzte, nicht der vom Reverse Proxy
angehängte) Wert genommen, ohne Trusted-Proxy-Konfiguration. Zusätzlich ist der
Limiter ausdrücklich fail-open und ohne Redis nur ein prozesslokaler
In-Memory-Bucket (`rate-limit.ts:19-25, 45-48`), skaliert also nicht über
mehrere Pods.

Dieselbe ungeprüfte Header-Übernahme steht im Zugriffsprotokoll
(`packages/auth/src/providers.ts:144-149`) — protokollierte Login-IPs sind damit
frei fälschbar.

**Angriffsszenario**

Ein Angreifer sendet Passwortversuche gegen `/api/auth/callback/credentials` mit
Leitungsgeschwindigkeit; nichts bremst ihn. Zielkennung ist bekannt
(S02-01: `admin@arctos.dev`). Selbst wenn der Break-Glass-Pfad erreichbar wäre,
genügt ein pro Versuch inkrementierter `X-Forwarded-For: 10.0.0.<n>`, um den
10-Versuche-Bucket zu umgehen. Die Forensik im `access_log` zeigt anschließend
die vom Angreifer gewählten IP-Adressen.

**Severity-Begründung**

Medium: Der Angriff benötigt eine gültige Kennung und schwache Passwörter, ist
aber ohne jede Voraussetzung durchführbar und in Kombination mit S02-01 unmittelbar
erfolgversprechend. Rubrik „Fehlende Härtung mit Angriffsvoraussetzungen".

---

### S02-10 — 91 mutierende Endpunkte ohne jede Rollenprüfung

**Severity: Medium**

**Evidenz**

Aus `S02-routes-matrix.csv`, Filter `verdict = AUTH-NO-ROLE AND method IN
(POST,PUT,PATCH,DELETE)`: 91 Handler. `withAuth()` ohne Argumente überspringt
den Rollenblock vollständig (`apps/web/src/lib/api.ts:203`):

```ts
  if (roles.length) {
```

Damit genügt eine beliebige Rolle in der Org — auch `viewer`. Auszug (vollständig
in der CSV):

| Methode           | Route                                                      | Wirkung                                |
| ----------------- | ---------------------------------------------------------- | -------------------------------------- |
| POST              | `/api/v1/audit-mgmt/audits/[id]/sign-off`                  | siehe S02-06                           |
| POST              | `/api/v1/export/bulk`                                      | siehe S02-07                           |
| POST              | `/api/v1/isms/incidents`                                   | Sicherheitsvorfall anlegen             |
| POST              | `/api/v1/isms/assessments`, PUT/DELETE `…/[id]`            | ISMS-Bewertungen ändern/löschen        |
| POST/PATCH/DELETE | `/api/v1/erm/propagation/relationships[/…]`                | Risiko-Propagationsgraph ändern        |
| POST              | `/api/v1/audit-mgmt/analytics/results/[id]/create-finding` | Prüfungsfeststellung anlegen           |
| POST              | `/api/v1/compliance/simulator/simulations`                 | Regulatorik-Simulation                 |
| POST              | `/api/v1/esg/materiality/[year]/vote`                      | Wesentlichkeitsanalyse abstimmen       |
| PUT/DELETE        | `/api/v1/dashboards/[id]`, `…/widgets/[widgetId]`          | fremde Dashboards ändern/löschen       |
| POST              | `/api/v1/calendar/ical/generate-token`                     | Dauer-Token für Kalender-Feed erzeugen |
| PATCH             | `/api/v1/community/contributions/[id]`                     | fremde Beiträge ändern                 |

**Angriffsszenario**

Ein Nutzer mit der Rolle `viewer` — im Rollenmodell explizit die Nur-Lese-Rolle —
kann ISMS-Assessments löschen (`DELETE /api/v1/isms/assessments/{id}`), den
Risiko-Propagationsgraphen manipulieren und Prüfungsfeststellungen erzeugen. Die
Wirkung bleibt innerhalb der Org (Org-Scoping und RLS greifen), aber die
Rollenschicht ist auf diesen Pfaden wirkungslos.

**Severity-Begründung**

Medium: kein Mandantenübertritt, aber systematische Verletzung des dokumentierten
Rollenmodells auf zustandsverändernden Pfaden; für einzelne der genannten Routen
(Audit-Sign-off, Massenexport) separat als High geführt.

---

### S02-11 — 368 von 985 mutierenden Handlern ohne `requireModule`

**Severity: Medium**

**Evidenz**

Matrix-Auswertung: von 985 mutierenden Handlern rufen 617 `requireModule(...)`
auf, 368 nicht. `requireModule` ist die einzige Stelle, an der Modul-Freischaltung
und der Preview-Schreibschutz durchgesetzt werden
(`packages/auth/src/middleware/module-guard.ts:16-36`):

```ts
export async function requireModule(
  moduleKey: ModuleKey,
  orgId: string,
  method: string = "GET",
): Promise<Response | null> {
  const config = await moduleConfigCache.get(orgId, moduleKey);
  if (
    !config ||
    config.uiStatus === "disabled" ||
    config.uiStatus === "maintenance"
  ) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (config.uiStatus === "preview" && method !== "GET") {
    return Response.json(
      { error: "Module in preview mode — read-only access" },
      { status: 403 },
    );
  }
  return null;
}
```

Beispiele ohne Guard: `POST /api/v1/export/bulk`, alle `/api/v1/dashboards/**`-
Mutationen, `/api/v1/community/contributions/**`, `/api/v1/academy/**`,
`/api/v1/calendar/ical/{generate,revoke}-token`.

**Angriffs-/Fehlerszenario**

Eine Org, für die das Modul in `module_config` auf `disabled` oder `maintenance`
steht, liefert über die UI keinen Zugang — die API akzeptiert Schreibzugriffe auf
den ungeschützten Routen aber weiterhin. Ein Nutzer, der die Route kennt, schreibt
in ein Modul, das für seine Org abgeschaltet ist (bei `maintenance` z. B. während
einer laufenden Datenmigration). Bei `preview`-Status wird der Schreibschutz
umgangen.

**Severity-Begründung**

Medium: Umgehung einer Härtungs-/Lizenzkontrolle mit Datenintegritätsrisiko im
Wartungsfall; kein direkter Datenabfluss.

---

### S02-12 — Keine Funktionstrennung im BPMN-Freigabezyklus

**Severity: Medium**

**Evidenz**

`packages/shared/src/process-approval.ts:63-71`:

```ts
export function canDecideApprovalStep(
  step: Pick<ApprovalStepLike, "assigneeUserId" | "assigneeRole">,
  actor: { userId: string; roles: string[] },
): boolean {
  if (actor.roles.includes("admin")) return true;
  if (step.assigneeUserId && step.assigneeUserId === actor.userId) return true;
  if (step.assigneeRole && actor.roles.includes(step.assigneeRole)) return true;
  return false;
}
```

Es gibt keinen Vergleich gegen den Autor, den Einreicher oder den
`processOwnerId`. Die Kette selbst wird von
`apps/web/src/app/api/v1/processes/[id]/approval-steps/route.ts:109-113` definiert:

```ts
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "process_owner");
```

`process_owner` darf also die Prüfer- und Freigeber-Zuordnung seines eigenen
Prozesses festlegen; eine Prüfung, dass er sich nicht selbst einträgt, existiert
nicht.

Zum Vergleich: Für zwei andere Freigabepfade ist die Kontrolle vorhanden —
`apps/web/src/app/api/v1/risks/[id]/acceptance/route.ts:93-100`
(`validateAcceptanceFourEyes`) und
`apps/web/src/app/api/v1/documents/[id]/status/route.ts:92-108`
(`checkFourEyes`). Der BPMN-Release-Cycle und der Audit-Sign-off (S02-06) haben
sie nicht.

**Angriffsszenario**

Ein `process_owner` modelliert einen Prozess, definiert über
`POST /processes/{id}/approval-steps` eine Kette mit sich selbst als
`assigneeUserId` für Prüfung _und_ Freigabe und entscheidet beide Schritte über
`POST /processes/{id}/approval-steps/{stepId}/decide`. Der Prozess erreicht den
Status „approved" und die Arbeitsversion wird zur freigegebenen Version
befördert (`promoteWorkingVersion`) — ohne dass ein zweiter Mensch beteiligt war.
Ein `admin` kann jeden Schritt jeder Kette entscheiden, auch die von ihm selbst
eingereichten.

**Severity-Begründung**

Medium bis High. Die Rubrik führt „Umgehung von Segregation-of-Duties" unter
High; hier ist die Umgehung jedoch nicht verdeckt (die Kette ist im Audit-Trail
sichtbar, und wer sie definiert hat, ist protokolliert), und in vielen
Organisationen ist die Selbstzuweisung durch den Prozessverantwortlichen eine
bewusste Konfigurationsentscheidung. Einstufung Medium, mit Empfehlung zur
Hochstufung, falls das Produkt eine BPMN-Freigabe als kontrollierte Maßnahme
gegenüber Prüfern bewirbt.

---

### S02-13 — `GET /api/v1/users/[id]/roles` gibt Rollen über alle Organisationen hinweg zurück

**Severity: Medium**

**Evidenz**

`apps/web/src/app/api/v1/users/[id]/roles/route.ts:46-62`:

```ts
const rows = await db
  .select({
    orgId: userOrganizationRole.orgId,
    orgName: organization.name,
    role: userOrganizationRole.role,
    lineOfDefense: userOrganizationRole.lineOfDefense,
    department: userOrganizationRole.department,
    createdAt: userOrganizationRole.createdAt,
  })
  .from(userOrganizationRole)
  .leftJoin(organization, eq(organization.id, userOrganizationRole.orgId))
  .where(
    and(
      eq(userOrganizationRole.userId, userId),
      isNull(userOrganizationRole.deletedAt),
    ),
  );
```

Es fehlt jedes `orgId`-Prädikat. Die Autorisierung darüber
(`route.ts:26-44`) prüft lediglich „Selbstauskunft **oder** `admin` in _meiner_
Org".

**Prüfung der kompensierenden Kontrolle:** `user_organization_role` hat FORCE-RLS
mit `user_organization_role_tenant_select` (`org_id = current_org`) **und**
zusätzlich die Policy `uor_self_read`
(`user_id = NULLIF(current_setting('app.current_user_id',true),'')::uuid`).
Policies sind additiv (OR-verknüpft). Für die **Selbstauskunft** (`userId ===
ctx.userId`) greift `uor_self_read` und liefert die Zeilen **aller** Orgs des
Nutzers — hier ist das gewollt. Für den Admin-Pfad auf einen _fremden_ Nutzer
greift nur die Org-Policy, RLS filtert also auf die aktuelle Org. Die
Informationspreisgabe wird damit unter `grc_app` durch RLS aufgefangen — **nicht
aber**, wenn die Laufzeit auf `DATABASE_URL` (Superuser `grc`) zurückfällt, was
`packages/db/src/index.ts:161-162` und `.env.example:12-14` für Entwicklung und
CI ausdrücklich vorsehen, und was in Produktion eintritt, sobald
`APP_DATABASE_URL` fehlt (es gibt keine Startprüfung darauf).

**Fehlerszenario**

Instanz ohne gesetztes `APP_DATABASE_URL` (die Anwendung startet klaglos und läuft
als Superuser): Ein Org-Admin von Org A ruft
`GET /api/v1/users/<uid>/roles` für einen Nutzer auf, der auch in Org B tätig ist,
und erhält Rollen, Line of Defense, Abteilung **und den Klarnamen von Org B**
(`orgName` aus dem Join).

**Severity-Begründung**

Medium: Der Defekt ist im Code eindeutig (fehlender Org-Filter), wird in der
korrekt konfigurierten Produktion aber durch RLS abgefangen. Er ist damit eine
„Defense-in-Depth"-Lücke, die genau dann zur Mandantenverletzung wird, wenn die
einzige verbleibende Kontrolle (Laufzeitrolle) falsch konfiguriert ist.
Empfehlung: `eq(userOrganizationRole.orgId, ctx.orgId)` ergänzen und den
Fallback auf `DATABASE_URL` in Produktion abschalten.

---

### S02-14 — Rollenmodell dreifach inkonsistent: DB-Enum (9) vs. TypeScript-Union (20) vs. Guards (17)

**Severity: Medium**

**Evidenz**

Laufende DB:

```sql
SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
 WHERE t.typname='user_role' ORDER BY e.enumsortorder;
```

```
admin, risk_manager, control_owner, auditor, dpo, process_owner, viewer,
whistleblowing_officer, vendor_manager          (9 Werte)
```

`packages/shared/src/types/platform.ts:3-26` definiert 20 Werte. Die Differenz
(11 Rollen) ist im Enum nicht vorhanden; 8 davon werden in
`withAuth(...)`-Guards tatsächlich benutzt — 113 Guard-Slots über 79 Routendateien
(`ciso` 29, `esg_manager` 22, `compliance_officer` 18, `esg_contributor` 14,
`ombudsperson` 12, `quality_manager` 11, `contract_manager` 6, `bcm_manager` 1).

Die zuständigen Migrationen existieren, laufen aber nicht durch (BASE-002):
`packages/db/drizzle/0096_additional_system_roles.sql:8-15` und
`packages/db/drizzle/0318_user_role_enum_backfill_and_rbac_retry.sql:35-37`:

```sql
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'compliance_officer';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'ciso';
…
```

`0318` dokumentiert die Ursache selbst („PG forbids reading a value in the same
transaction that adds it") und den Produktionsausfall, den das erzeugt hat.

**Fehlerszenario**

Ein Betreiber will einem Informationssicherheitsbeauftragten die Rolle `ciso`
geben. `POST /api/v1/users/{id}/roles` mit `{"role":"ciso"}` schlägt mit
`22P02`/`invalid input value for enum user_role` fehl, den `withErrorHandler`
als 422 ausgibt. Die 29 Guard-Slots für `ciso` sind damit toter Code: Zugriff auf
diese Endpunkte ist ausschließlich über die jeweils mitgeführte Rolle `admin`
möglich (Prüfung: **keine** Route wird ausschließlich von Nicht-Enum-Rollen
bewacht — die Matrix zeigt für alle 113 Slots mindestens eine zusätzliche
Enum-Rolle). Praktische Folge: Least-Privilege ist nicht umsetzbar, jeder, der
z. B. ISMS-Freigaben braucht, muss `admin` bekommen — was die Wirkung von S02-02
und S02-03 verstärkt.

Zusätzlich seedet `0096:130-140` login-fähige Kennungen (`ciso@arctos.dev`,
`compliance@arctos.dev`, `bcm@arctos.dev`, `contracts@arctos.dev`,
`qm@arctos.dev`, `security@arctos.dev`) mit einem **hartkodierten, für alle
identischen** bcrypt-Hash `$2a$10$xV5GqkGhJ8kXYJ5f1LqQXe…` aus einer Migration
heraus — also unabhängig von `RUN_SEEDS`.

**Severity-Begründung**

Medium: keine unmittelbare Ausnutzbarkeit, aber ein struktureller Defekt des
Rollenmodells mit direkter Sicherheitswirkung (erzwungene Über-Privilegierung)
und Doku-Drift zwischen Code, Schema und Rollenmatrix.

---

### S02-15 — SCIM-Bearer-Token ohne Ablauf, ohne Rotation, mit ungeprüftem Nebeneffekt

**Severity: Medium**

**Evidenz**

`packages/auth/src/scim/token-auth.ts:28-60`:

```ts
export async function validateScimToken(
  authHeader: string | null,
): Promise<ScimAuthContext | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  const tokenHash = hashScimToken(token);
  const [found] = await db
    .select({ id: scimToken.id, orgId: scimToken.orgId, isActive: scimToken.isActive })
    .from(scimToken)
    .where(and(eq(scimToken.tokenHash, tokenHash), eq(scimToken.isActive, true)));
  if (!found) return null;
  await db.execute(
    sql`UPDATE scim_token SET last_used_at = now() WHERE id = ${found.id}`,
  );
```

Die Tabelle hat keine Ablaufspalte (laufende DB):

```
scim_token: id, org_id, token_hash, description, is_active, last_used_at,
            created_by, created_at, revoked_at, revoked_by
```

Es gibt weder `expires_at` noch eine Prüfung von `revoked_at`; das Token gilt
unbefristet, bis jemand `is_active` manuell zurücksetzt. Der Hash ist ein
ungesalzenes SHA-256 (`token-auth.ts:18`) — für ein 48-Byte-Zufallstoken
(`generateScimToken`, `token-auth.ts:65-69`) kryptografisch unkritisch, aber es
existiert keine Rotationsunterstützung (kein zweiter aktiver Hash pro Org).

Der `UPDATE last_used_at` läuft ohne `try/catch`; unter `grc_app` scheitert er
zusätzlich an der FORCE-RLS-Policy (S02-05), sodass die Authentifizierung selbst
bei gefundenem Token noch mit einem 500 abbrechen kann.

**Angriffsszenario**

Ein SCIM-Token gelangt in ein IdP-Konfigurationsbackup, ein Ticket oder ein
Log. Es bleibt bis zum manuellen Widerruf unbegrenzt gültig und berechtigt zu
`POST/PUT/PATCH/DELETE /api/v1/scim/v2/Users` — also zum Anlegen, Ändern und
Deaktivieren beliebiger Nutzer der Org. Eine Rotation ohne Ausfallfenster ist
nicht vorgesehen.

**Severity-Begründung**

Medium: „Fehlende Härtung mit Angriffsvoraussetzungen" (Token-Kompromittierung).
Der Wirkungsradius (Nutzerverwaltung einer Org) ist erheblich.

---

### S02-16 — Session-Konfiguration ohne Rotation, ohne Idle-Timeout, ohne explizite Cookie-Härtung

**Severity: Low**

**Evidenz**

`packages/auth/src/config.ts:12`:

```ts
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 }, // 8h
```

Es gibt keine `cookies`-Sektion, kein `updateAge`, keine Rotation des JWT und
keine serverseitige Sitzungsverwaltung (JWT-Strategie ⇒ kein Widerruf möglich).

**Prüfung der kompensierenden Kontrollen:** Auth.js v5 setzt ohne explizite
Konfiguration `httpOnly: true`, `sameSite: "lax"`, `path: "/"` und `secure: true`,
sobald die URL `https://` ist. `deploy/.env.production.example:9` setzt
`AUTH_URL=https://arctos.ihrefirma.de` und `:22` `AUTH_TRUST_HOST=true`. Die
CSRF-Absicherung für die Auth.js-eigenen Endpunkte ist eingebaut; für die
API-Routen wirkt `SameSite=Lax` als Basis-Schutz gegen Cross-Site-POSTs. Die
Cookie-Flags sind daher **kein** Finding.

Verbleibend: Die Rollen im JWT sind bis zu 8 h alt. `apps/web/src/auth.ts:107-131`
mildert das für den _Server_-Session-Callback (frischer DB-Read je Aufruf, mit
Fallback auf die JWT-Kopie bei DB-Fehler), aber die **Edge-Middleware** liest
ausschließlich die JWT-Kopie (`apps/web/src/middleware.ts:138-143`), unter anderem
für das HinSchG-Isolationsgatter.

**Fehlerszenario**

Ein Nutzer wird als `whistleblowing_officer` entlassen und seine Rolle in der DB
entfernt oder erweitert. Bis zu 8 h lang entscheidet die Middleware weiterhin auf
Basis des alten JWT, ob er in das Whistleblowing-Modul eingesperrt bleibt oder
nicht. Ein Logout invalidiert das Token nicht serverseitig; ein exfiltriertes
Session-Cookie bleibt bis zum Ablauf gültig.

**Severity-Begründung**

Low: Härtungsmangel ohne konkreten Angriffspfad; die tatsächliche
Rollenauswertung in `withAuth` erfolgt über den frisch gelesenen Session-Callback.

---

### S02-17 — Benutzer-Enumeration und Groß-/Kleinschreibung im Credentials-Login

**Severity: Low**

**Evidenz**

`packages/auth/src/providers.ts:196-213`:

```ts
      const [found] = await db
        .select()
        .from(user)
        .where(
          and(
            eq(user.email, email),
            eq(user.isActive, true),
            isNull(user.deletedAt),
          ),
        );

      if (!found?.passwordHash) {
        await logAccessEvent({ …, failureReason: "user_not_found", … });
        return null;
      }
```

Bei unbekannter Kennung wird **ohne** bcrypt-Vergleich abgebrochen; bei bekannter
Kennung folgt `compare()` mit 10–12 Runden (`providers.ts:238`). Die
Antwortzeitdifferenz ist im zweistelligen Millisekundenbereich und damit über das
Netz messbar. Ein Dummy-Vergleich fehlt.

`eq(user.email, email)` vergleicht groß-/kleinschreibungssensitiv. Der
SSO-JIT-Pfad normalisiert dagegen (`apps/web/src/auth.ts:150`:
`(profile.email as string).toLowerCase()`), ebenso `admin-login`
(`route.ts:57`: `eq(user.email, email.toLowerCase())`). Drei Pfade, zwei
Normalisierungsregeln.

**Fehlerszenario**

(a) Ein Angreifer misst Antwortzeiten gegen `/api/auth/callback/credentials` und
trennt existierende von nicht existierenden Kennungen — in Kombination mit dem
fehlenden Rate-Limit (S02-09) beliebig oft.
(b) Ein per SSO angelegter Nutzer `Max.Muster@firma.de` wird als
`max.muster@firma.de` gespeichert und kann sich anschließend nicht mit der
Schreibweise anmelden, die er kennt; umgekehrt kann ein per Admin-Konsole
angelegter Nutzer mit Großbuchstaben durch den SSO-Pfad ein **zweites** Konto
erhalten (E-Mail-Kollision).

**Severity-Begründung**

Low: Härtungsmangel bzw. Konsistenzfehler; kein direkter Zugriffsgewinn.
Empfehlung: einheitlich `lower(email)` mit funktionalem Unique-Index.

---

### S02-18 — Break-Glass-Login prüft die SSO-Bedingung nicht, die er laut Dokumentation prüft

**Severity: Low**

**Evidenz**

`apps/web/src/app/api/v1/auth/admin-login/route.ts:1-9`:

```ts
import { db, user, userOrganizationRole, ssoConfig } from "@grc/db";
…
// POST /api/v1/auth/admin-login — Break-glass admin login
// Only works for admin users when SSO enforcement is active
```

`ssoConfig` wird importiert, im gesamten Handler aber **nie verwendet**
(`grep -c "ssoConfig" apps/web/src/app/api/v1/auth/admin-login/route.ts` → 1
Treffer, der Import). Der Handler prüft ausschließlich Passwort und
Admin-Rollenbesitz und gibt dann `{ id, email, name, isBreakGlass: true }`
zurück.

**Fehlerszenario**

Der Endpunkt ist damit ein zweiter, vollwertiger Passwort-Login-Pfad für
Administratoren — unabhängig davon, ob die Organisation SSO erzwingt. Wo ein
Betreiber `enforceSSO` gesetzt hat, um Passwort-Logins abzuschalten, bleibt für
Admins ein Passwortpfad offen, der nicht durch die IdP-Kontrollen (MFA,
Conditional Access) läuft. Der reguläre Credentials-Provider erlaubt Admins bei
`enforceSSO` ebenfalls den Passwort-Login (`providers.ts:216-235`) — beide Pfade
sind konsistent unsicher, aber die Dokumentation im Header beschreibt eine
Einschränkung, die es nicht gibt.

(Praktisch ist der Endpunkt derzeit ohnehin unerreichbar, siehe S02-04 — der
Befund wird relevant, sobald S02-04 behoben wird.)

**Severity-Begründung**

Low: Doku-Drift mit Fehlbedienungsrisiko; die eigentliche Schwäche
(Passwort-Pfad trotz `enforceSSO` für Admins) ist eine bewusste
Design-Entscheidung im Credentials-Provider.

---

### S02-19 — `/api/health` ist nicht in der Middleware-Allowlist

**Severity: Low**

**Evidenz**

`apps/web/src/app/api/health/route.ts:6` exportiert einen vollwertigen
Health-Handler mit DB-Prüfung. Die Middleware-Allowlist kennt nur
`pathname === "/api/v1/health"` (`middleware.ts:82`) — der Vergleich ist exakt,
`/api/health` fällt nicht darunter und liefert 401.

**Fehlerszenario**

Ein Betreiber, der die naheliegende Route `/api/health` in Kubernetes-Probe,
Uptime-Monitor oder Loadbalancer einträgt, bekommt dauerhaft 401 und damit einen
permanent „ungesunden" Dienst bzw. einen blinden Monitor. Die Docker-Compose-
Healthchecks referenzieren die Route nicht (`grep` über `Dockerfile`,
`docker-compose*.yml`, `docker/`, `deploy/` → keine Treffer), es existieren also
zwei Health-Endpunkte, von denen einer nie antwortet.

**Severity-Begründung**

Low: Doku-/Konventionsdrift mit Fehlbedienungsrisiko im Betrieb.

---

### S02-20 — Portal-Token-Prüfung mit schwachen Nebenbedingungen

**Severity: Low**

**Evidenz**

`apps/web/src/lib/portal-auth.ts:20-30, 61-64`:

```ts
if (!token || token.length < 32) {
  return Response.json({ error: "Invalid token" }, { status: 401 });
}
const foundSession = await db.query.ddSession.findFirst({
  where: eq(ddSession.accessToken, token),
});
```

```ts
      ipAddressLog: sql`array_append(ip_address_log, ${require("crypto").createHash("sha256").update(ip).digest("hex")})`,
```

- Das Token wird **im Klartext** in `dd_session.access_token` gespeichert und
  direkt verglichen (im Gegensatz zu SCIM, wo gehasht wird). Wer Lesezugriff auf
  die Tabelle erlangt, kann sich als beliebiger externer Lieferant ausgeben.
- `require("crypto")` in einem ESM-Modul (`apps/web` ist ESM) — funktioniert nur,
  weil Next/webpack das transpiliert; in einem reinen ESM-Kontext ein
  Laufzeitfehler.
- Die IP stammt ungeprüft aus `x-forwarded-for` (`portal-auth.ts:52-55`), das
  „GDPR: hash IP" versprochene Pseudonym ist ein ungesalzenes SHA-256 über eine
  IPv4-Adresse — mit 2^32 Kandidaten trivial umkehrbar, also kein wirksames
  Pseudonymisierungsverfahren.
- `wb_anonymous_mailbox` hat als einzige der Portal-Tabellen **keine** RLS
  (`relrowsecurity=f`) — hier funktioniert die Token-Auflösung, aber ohne
  Mandanten-Netz.

**Fehlerszenario**

Ein Datenbank-Leseleck (Backup, Read-Replica, S01-Befund) genügt, um alle aktiven
Lieferantenportal-Token im Klartext zu erhalten und im Namen fremder Lieferanten
Due-Diligence-Antworten und Nachweise einzureichen. Die als DSGVO-Maßnahme
deklarierte IP-Pseudonymisierung ist per Rainbow-Table umkehrbar.

**Severity-Begründung**

Low: setzt einen vorgelagerten Lesezugriff voraus; die Pseudonymisierungslücke
wird an S07 übergeben.

---

### S02-23 — SAML-Signaturprüfung verifiziert den Digest nicht: Assertion frei manipulierbar

**Severity: Critical**

**Evidenz**

`packages/auth/src/saml/response-validator.ts:91-127` — die vollständige
Signaturprüfung:

```ts
export function validateSAMLSignature(
  responseXml: string,
  idpCertPem: string,
): boolean {
  // Extract the SignatureValue and SignedInfo from the response
  const signatureValue = extractTag(responseXml, "SignatureValue");
  if (!signatureValue) return false;

  const signedInfoMatch = responseXml.match(
    /<(?:ds:)?SignedInfo[^>]*>[\s\S]*?<\/(?:ds:)?SignedInfo>/i,
  );
  if (!signedInfoMatch) return false;
  …
  try {
    const verifier = createVerify(`RSA-${algorithm}`);
    verifier.update(signedInfoMatch[0]);
    const cleanSig = signatureValue.replace(/\s+/g, "");
    return verifier.verify(pemCert, cleanSig, "base64");
  } catch {
    return false;
  }
}
```

XML-DSig ist zweistufig: `<SignedInfo>` enthält eine `<Reference>` mit einem
`<DigestValue>` über das _signierte Element_ (die Assertion), und `<SignedInfo>`
selbst ist durch `<SignatureValue>` signiert. Diese Implementierung prüft
ausschließlich die **zweite** Stufe. Es gibt im gesamten Modul keine
Digest-Berechnung über die Assertion und keinen Abgleich mit `DigestValue`:

```
grep -n "DigestValue\|Reference\|canonical\|c14n" packages/auth/src/saml/response-validator.ts
→ keine Treffer
```

Die verbrauchten Attribute werden anschließend per Regex aus **demselben,
ungebundenen** XML gezogen (`response-validator.ts:196-215`, `extractSAMLAttributes`)
und im Callback direkt zur Nutzeridentifikation und Rollenzuweisung verwendet
(`apps/web/src/app/api/v1/auth/sso/saml/callback/route.ts:60-100`):

```ts
    const signatureValid = validateSAMLSignature(responseXml, config.samlCertificate);
    if (!signatureValid) { … return Response.json({ error: "Invalid SAML signature" }, { status: 401 }); }
    …
    const attrs = extractSAMLAttributes(responseXml, attrMapping);
    const email = attrs.email.toLowerCase();
```

Weitere Mängel derselben Funktion:

- Keine Kanonisierung (c14n) vor der Verifikation — es werden die rohen Bytes
  des `SignedInfo`-Fundstücks verifiziert.
- `extractTag`/`extractAttr` liefern jeweils den **ersten** Treffer im gesamten
  Dokument (`response-validator.ts:36-49`) — die Grundvoraussetzung für XML
  Signature Wrapping.
- SHA-1 wird akzeptiert (`response-validator.ts:112`).
- `validateSAMLAssertion` (`:140-188`) prüft `NotOnOrAfter`, `Audience` und
  `NotBefore` jeweils nur, **wenn das Element vorhanden ist** (`if (notOnOrAfter)`,
  `if (audience && …)`): eine Assertion ohne `<Conditions>` läuft nie ab und hat
  keine Audience-Bindung.
- Der Replay-Schutz ist eine prozesslokale `Map` (`:10`, Kommentar: „In
  production, this should be backed by Redis") — bei mehr als einer Web-Instanz
  wirkungslos.

**Angriffsszenario**

Voraussetzung: eine Organisation nutzt SAML-SSO; der Angreifer ist ein
regulärer, gering privilegierter Nutzer dieser Organisation (oder kommt
anderweitig an _eine_ gültige, vom IdP signierte SAML-Response — z. B. seine
eigene aus dem Browser-Netzwerkprotokoll).

1. Angreifer meldet sich normal per SSO an und fängt seine eigene
   `SAMLResponse` (Base64) im POST an die ACS-URL ab.
2. Er dekodiert sie und ersetzt im `<Assertion>`-Teil `NameID`/das
   E-Mail-Attribut durch `admin@<opfer-org>` und das `memberOf`-Attribut durch
   die Gruppe, die per `groupRoleMapping` auf `admin` abgebildet wird. Der
   gesamte `<Signature>`-Block inklusive `<SignedInfo>` und `<SignatureValue>`
   bleibt **unverändert**.
3. Er kodiert erneut und postet auf `/api/v1/auth/sso/saml/callback` mit dem
   ursprünglichen `RelayState`.
4. `validateSAMLSignature` verifiziert `SignatureValue` über das unveränderte
   `SignedInfo` → **true**. Der veränderte Assertion-Inhalt wird nie gegen
   `DigestValue` geprüft.
5. `extractSAMLAttributes` liefert die manipulierten Werte; der Callback führt
   JIT-Provisioning bzw. Update durch und weist über
   `resolveRole`/`groupRoleMappingToEntries` die Rolle `admin` zu.

Ergebnis: vollständige Übernahme eines beliebigen Kontos der Organisation
inklusive Rollen-Eskalation. Die Variante über eine zusätzlich eingeschobene,
unsignierte Assertion (XSW) funktioniert wegen des Erst-Treffer-Verhaltens von
`extractTag` genauso.

**Severity-Begründung**

Rubrik Critical: „Authentifizierungs-Bypass". Die einzige kryptografische
Kontrolle des SSO-Pfads prüft nicht, was sie zu prüfen vorgibt; der Kommentar in
Zeile 2 („Validates SAML responses: signature, audience, expiry, replay
protection") beschreibt eine Sicherheitseigenschaft, die die Implementierung
nicht hat.

**Abgrenzung:** Der Endpunkt ist derzeit durch S02-04 unerreichbar (401 an der
Middleware). Das ist eine zufällige, keine beabsichtigte Schutzwirkung — sie
entfällt mit der Behebung von S02-04. Die Findings müssen daher gemeinsam
remediiert werden: **S02-04 darf nicht vor S02-23 behoben werden.**

**Empfehlung:** Eigenimplementierung ersetzen (`xml-crypto` mit
`ExclusiveCanonicalization`, Reference-Digest-Prüfung und expliziter Bindung des
verifizierten Elements an die weiterverarbeitete Assertion) oder `@node-saml/node-saml`
verwenden. Assertions ohne `<Conditions>`/`<AudienceRestriction>` verwerfen,
SHA-1 ablehnen, Replay-Cache nach Redis.

---

### S02-24 — OIDC-ID-Token wird ohne Signaturprüfung akzeptiert

**Severity: Medium**

**Evidenz**

`packages/auth/src/oidc/id-token-validator.ts:69-72` (Kommentar der Funktion):

```ts
 * Note: Full cryptographic signature verification against JWKS requires
 * crypto.subtle or a JWT library. This implementation validates claims
 * and structure. For production, pair with jose or similar.
```

`:77-115` — die Funktion prüft `iss`, `aud`, `exp`, `iat`, `nonce` und ruft
`decodeJwt` (`:32`), also reines Base64-Dekodieren. Die vorhandene
JWKS-Abholung `fetchJwks` (`:45`) wird von `validateIdToken` **nicht** aufgerufen;
`alg` wird nirgends geprüft. Der Callback verwendet die Funktion als einzige
Token-Validierung (`apps/web/src/app/api/v1/auth/sso/oidc/callback/route.ts:129-133`).

**Prüfung der kompensierenden Kontrolle**

Das ID-Token stammt aus dem Back-Channel-Code-Austausch mit PKCE
(`packages/auth/src/oidc/token-exchange.ts:20-42`: POST an `tokenEndpoint` über
TLS, mit `code_verifier` und optionalem `client_secret`); der `state`-Parameter
wird gegen ein Cookie geprüft (`callback/route.ts:50-70`). Ein Angreifer kann
daher nicht ohne Weiteres ein eigenes Token einschleusen — die fehlende
Signaturprüfung ist damit **kein direkter Bypass**, aber die letzte
Verteidigungslinie fehlt: bei einem kompromittierten oder falsch konfigurierten
Token-Endpunkt, einem MITM auf der Back-Channel-Verbindung oder einem
IdP-Wechsel ohne Zertifikatsprüfung wird ein beliebiges JWT akzeptiert.

**Severity-Begründung**

Medium: „Fehlende Härtung mit Angriffsvoraussetzungen". Die Herabstufung
gegenüber S02-23 ist ausdrücklich der Back-Channel-Kontrolle geschuldet;
entfällt diese (z. B. Implicit/Hybrid-Flow), wird der Befund Critical.

---

### S02-21 — Auth-Smoke-Test deckt nur mutierende Routen ab

**Severity: Info**

`apps/web/src/__tests__/api/all-mutating-routes-auth-smoke.test.ts:359-363`:

```ts
const methods = MUTATING_METHODS.filter((m) => typeof mod[m] === "function");
if (methods.length === 0) {
  ctx.skip(); // read-only route — covered by all-routes-smoke
  return;
}
```

Der Schwestertest `all-routes-smoke.test.ts` prüft laut Kopfkommentar nur, dass
Handler eine `Response` zurückgeben, nicht dass sie 401 liefern. Damit sind
1.035 GET-Handler — darunter die 618 ohne Rollenprüfung — **nicht** gegen
fehlende Autorisierung getestet. Es existiert außerdem kein Test, der
mandantenübergreifenden Zugriff über eine Route explizit als verboten verifiziert
(Übergabe an S11).

Positiv festzuhalten: Der Test _existiert_, ist automatisch entdeckend
(kein manuell gepflegtes Routenverzeichnis) und erzwingt für jede Ausnahme einen
schriftlich begründeten Allowlist-Eintrag. Er ist die Grundlage, auf der die
Bewertung in Abschnitt 2.2 überhaupt möglich war.

---

### S02-22 — Discovery-, Alias- und 405-Stub-Routen ohne eigene Autorisierung

**Severity: Info**

26 Handler (`/api/v1/{compliance,marketplace,rcsa,reports,identity,programmes}`,
`/api/v1/isms/nis2`, `/api/v1/bcms/crisis/dashboard`, die 36 `alias308`-Handler,
die 405-Stubs) führen keine eigene Auth-Prüfung durch. Sie sind **kein Finding**,
weil sie ausschließlich statische Endpunkt-Listen, 308-Weiterleitungen oder
405-Antworten liefern und zusätzlich hinter der globalen Middleware liegen.
Festgehalten als Kontext, damit ein späterer Middleware-Umbau (S02-04) nicht
versehentlich Pfade freischaltet, die dann ohne zweite Kontrolle dastehen: die
Discovery-Payloads verraten die vollständige Endpunkt-Topologie der Plattform.

---

## 5. Übergaben an andere Streams

| Befund                                                                                               | Stream   | Grund                                                        |
| ---------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------ |
| S02-08 (Kontext-Leck über Basis-Pool)                                                                | S01      | tabellenweise Wirkung auf RLS                                |
| `packages/db/src/seed-control.ts:16` (`SET app.bypass_rls = 'true'` auf Session-Ebene, ohne `LOCAL`) | S01      | dieselbe Pool-Poisoning-Klasse, betrifft die RLS-Bypass-GUC  |
| `user`-Tabelle ohne RLS (`relrowsecurity=f`)                                                         | S01      | Basis für IDOR-Bewertung auf `/api/v1/users/**`              |
| S02-06 (Sign-off mit selbstdeklarierter Rolle)                                                       | S03      | Aussagekraft der Hash-Kette                                  |
| S02-07, S02-20 (IP-Pseudonymisierung)                                                                | S07      | DSGVO-Bewertung                                              |
| S02-14 (Enum-Migrationen 0096/0318 laufen nicht)                                                     | S09      | Teil der 43 dauerhaft fehlschlagenden Migrationen (BASE-002) |
| S02-09 (Rate-Limit fail-open, In-Memory ohne Redis)                                                  | S10      | Betriebs-/Resilienzbewertung                                 |
| S02-21 (fehlende negative Sicherheitstests)                                                          | S11      | Testqualität                                                 |
| S02-01 (`admin123`, `RUN_SEEDS=true` im Prod-Template)                                               | S08, S13 | Secrets/Deployment                                           |
| S02-23 (Regex-XML-Parsing der SAML-Response, `extractTag` Erst-Treffer)                              | S04      | XML-Verarbeitung, XSW/XXE-Bewertung                          |
| S02-14 (hartkodierter bcrypt-Hash für 6 Kennungen in Migration `0096:130-140`)                       | S08      | Secret in der Git-Historie                                   |

**Remediation-Reihenfolge (verbindlich):** S02-23 muss vor S02-04 behoben werden.
Die Middleware-Allowlist um `/api/v1/auth/sso/saml/callback` zu erweitern, bevor
die Signaturprüfung korrekt ist, macht aus einem unerreichbaren Endpunkt einen
erreichbaren Authentifizierungs-Bypass.

---

## 6. Artefakte

| Datei                                         | Inhalt                                          |
| --------------------------------------------- | ----------------------------------------------- |
| `/work/audit/evidence/S02-routes-matrix.csv`  | 2.021 Zeilen, eine je exportiertem HTTP-Handler |
| `/work/audit/evidence/S02-classify-routes.py` | Klassifikationsskript (reproduzierbar)          |
