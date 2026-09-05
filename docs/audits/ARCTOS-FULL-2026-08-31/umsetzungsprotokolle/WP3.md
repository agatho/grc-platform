# WP3 — Authentifizierung, Autorisierung, SSO · Umsetzungsprotokoll

**Audit-ID:** ARCTOS-FULL-2026-08-31 · **Paket:** WP3 (Welle 2)
**Branch:** `audit/full-2026-08-31` · **Migrationen:** 0410–0414 (reserviert), genutzt: 0410, 0411, 0412
**Umfang:** 28 Findings — `S02-01` … `S02-24`, `S12-09`, `S12-14`, `S12-17`, `S12-18`

---

## 0. Endgültige Rollenliste (S02-14) — für WP7 und WP8

**Quelle der Wahrheit:** `packages/shared/src/types/platform.ts` → `USER_ROLES`
(Konstanten-Array; `UserRole` leitet sich daraus ab, `isUserRole()` ist die
Laufzeitprüfung). Migration `0410_user_role_enum_single_source.sql` spiegelt die
Liste idempotent in das DB-Enum `user_role`. Der Test
`packages/shared/tests/role-model-consistency.test.ts` vergleicht TS-Liste,
Migration und die tatsächliche `withAuth(...)`-Verwendung im Routenbaum.

**20 Rollen, in Enum-Reihenfolge:**

|   # | Rolle                    | Anmerkung                                                          |
| --: | ------------------------ | ------------------------------------------------------------------ |
|   1 | `admin`                  | Organisations-Administrator (**nicht** Plattform-Admin, s. S02-03) |
|   2 | `risk_manager`           |                                                                    |
|   3 | `control_owner`          |                                                                    |
|   4 | `auditor`                |                                                                    |
|   5 | `dpo`                    |                                                                    |
|   6 | `process_owner`          |                                                                    |
|   7 | `viewer`                 | **einzige reine Leserolle** (`READ_ONLY_ROLES`)                    |
|   8 | `whistleblowing_officer` | HinSchG-isoliert                                                   |
|   9 | `compliance_officer`     |                                                                    |
|  10 | `ciso`                   |                                                                    |
|  11 | `bcm_manager`            |                                                                    |
|  12 | `contract_manager`       |                                                                    |
|  13 | `quality_manager`        | **war toter Code → S06-12 aufgelöst**                              |
|  14 | `security_analyst`       |                                                                    |
|  15 | `department_head`        |                                                                    |
|  16 | `external_auditor`       |                                                                    |
|  17 | `esg_manager`            |                                                                    |
|  18 | `esg_contributor`        |                                                                    |
|  19 | `ombudsperson`           | HinSchG-isoliert; **fehlte im Enum → S07-22 aufgelöst**            |
|  20 | `vendor_manager`         |                                                                    |

**Für WP7 (S06-12):** `quality_manager` ist ab 0410 zuweisbar; der Guard-Slot
ist kein toter Code mehr. **Für WP8 (S07-22):** `ombudsperson` existiert im Enum
und in der TS-Union; das HinSchG-Isolationsgatter (`middleware.ts` + neu auch
`withAuth`) prüft darauf.

Die 113 vom Audit gemeldeten „nicht zuweisbaren Guard-Slots" sind damit
zuweisbar. Zusatz: `POST /api/v1/users/:id/roles` validiert den Wert jetzt gegen
`isUserRole()` und liefert 422 statt eines 22P02-Datenbankfehlers.

---

## 1. Findings — Änderung, Nachweis, Status

Reihenfolge wie umgesetzt (die verbindliche interne Reihenfolge S02-23/-24 vor
S02-04/S12-09 vor S02-05 ist eingehalten).

### S02-23 · Critical · SAML-Signaturprüfung ohne Digest-Verifikation

**Status: geschlossen**

- `packages/auth/src/saml/response-validator.ts` vollständig ersetzt.
  Vorher: `createVerify(...).update(signedInfoMatch[0])` — es wurde
  ausschließlich `SignatureValue` über den per Regex gefundenen
  `SignedInfo`-Block geprüft; `DigestValue` wurde nie berechnet, es gab keine
  Kanonisierung, SHA-1 war erlaubt, und die Attribute wurden danach aus dem
  **ungebundenen** Original-XML gezogen.
- Neu: echte XML-DSig-Core-Validierung über `xml-crypto` 6.1.2 +
  `@xmldom/xmldom` 0.9.8 (als Abhängigkeit von `@grc/auth` aufgenommen):
  1. Reference-Digest wird über das kanonisierte, signierte Element neu
     berechnet und mit `DigestValue` verglichen;
  2. `SignedInfo` wird exc-c14n-kanonisiert und gegen das **konfigurierte**
     IdP-Zertifikat verifiziert — `getCertFromKeyInfo: () => null` schaltet die
     Vorrangregel von `xml-crypto` ab, sonst würde das vom Angreifer
     mitgelieferte `<KeyInfo>`-Zertifikat gewinnen;
  3. Algorithmus-Allowlist: RSA/ECDSA-SHA256/384/512; SHA-1 und HMAC abgelehnt;
  4. Signatur muss `<Response>` **oder** die (genau eine) `<Assertion>` decken,
     als direktes Kind; `Reference`-URI muss auf die ID dieses Elements zeigen
     und die `enveloped-signature`-Transformation enthalten;
  5. **Bindung:** Weiterverarbeitet wird ausschließlich
     `getSignedReferences()[0]` — genau die Bytes, deren Digest verifiziert
     wurde.
- Zusätzlich gehärtet: `<Conditions>/NotOnOrAfter` ist **Pflicht** (vorher
  `if (notOnOrAfter)` → eine Assertion ohne `<Conditions>` lief nie ab),
  `AudienceRestriction` ist Pflicht sobald eine Audience erwartet wird
  (vorher stiller Durchlauf bei fehlendem `<Audience>`), Assertion-ID ist
  Pflicht (vorher `if (assertionId)` → kein Replay-Schutz ohne ID),
  `samlp:Status` muss `Success` sein, `EncryptedAssertion` wird abgelehnt,
  mehr als eine `<Assertion>` wird abgelehnt (XSW).
- Replay-Schutz jetzt **instanzübergreifend**: Tabelle
  `saml_assertion_replay` + `auth_consume_saml_assertion()` (Migrationen 0411 /
  0412). Der prozesslokale `Map`-Cache bleibt als schneller Vorfilter.
- `apps/web/src/app/api/v1/auth/sso/saml/callback/route.ts` nutzt
  `verifySamlResponse()` und arbeitet ab da nur noch auf
  `verified.assertionXml`.

**Nachweis:** `packages/auth/tests/saml-signature.test.ts` (11 Tests) —
signiert Responses mit einem echten RSA-Schlüssel und weist nach:
manipulierte NameID → abgelehnt, eskalierte Gruppe → abgelehnt, eingeschobene
zweite Assertion (XSW) → abgelehnt, fremder Schlüssel → abgelehnt, SHA-1 →
abgelehnt, unsigniert → abgelehnt, fehlende `Conditions`/`Audience`/ID →
abgelehnt, Nicht-Success-Status → abgelehnt, ehrliche Response → akzeptiert und
korrekt gebunden.

### S02-24 · Medium · OIDC-ID-Token ohne Signaturprüfung

**Status: geschlossen**

- `packages/auth/src/oidc/id-token-validator.ts`: `validateIdToken()` ist jetzt
  `async` und verifiziert kryptografisch gegen `jwks_uri` aus dem
  Discovery-Dokument (`jose` 6.2.10, `createRemoteJWKSet` mit Cache/Cooldown;
  für Tests auch ein lokal übergebenes `jwks`).
  Vorher wurde der Payload nur base64-dekodiert; die im selben Modul
  vorhandene `fetchJwks` wurde nie aufgerufen und `alg` nie geprüft.
- Algorithmus-Allowlist `ALLOWED_ID_TOKEN_ALGORITHMS` (RS/PS/ES/EdDSA);
  `alg: none` und **alle** `HS*` werden abgelehnt (Key-Confusion).
- Ohne `jwksUri`/`jwks` wird **fail-closed** abgelehnt statt ungeprüft
  akzeptiert.
- Die reinen Claim-Regeln bleiben als `validateIdTokenClaims()` erhalten
  (nonce-Pflicht wenn erwartet, `azp` bei mehreren Audiences, `sub`-Pflicht) —
  ausdrücklich mit dem Hinweis, dass sie allein keine Authentifizierung sind.
- `apps/web/src/app/api/v1/auth/sso/oidc/callback/route.ts` ruft `await
validateIdToken(..., { jwksUri: discovery.jwks_uri })`.

**Nachweis:** `packages/auth/tests/oidc-signature.test.ts` (7 Tests) — fremder
Schlüssel → abgelehnt, nachträglich editierter Payload → abgelehnt, `alg:none`
→ abgelehnt, HMAC → abgelehnt, fehlende JWKS-Quelle → abgelehnt, falscher
Issuer/Nonce → abgelehnt, korrekt signiertes Token → akzeptiert.

### S02-04 / S12-09 · High · Middleware-Allowlist deckt die anonymen Fachkanäle nicht ab

**Status: geschlossen** (erst **nach** S02-23/S02-24 geöffnet)

- Die Allowlist ist aus `apps/web/src/middleware.ts` nach
  `packages/auth/src/rbac.ts` gezogen (edge-sicher, ohne DB-Import) — eine
  Allowlist, die man nicht unit-testen kann, ist genau die Kontrolle, die
  unbemerkt driftet.
- Struktur: `PUBLIC_EXACT_PATHS` (exakte Pfade), `PUBLIC_PREFIXES`
  (Präfix **mit Trennzeichen**), `PUBLIC_PATTERNS` (verankerte Regexe für
  dynamische Segmente). **Jeder Eintrag trägt eine schriftliche Begründung**;
  ein Test erzwingt das.
- Neu erreichbar: `/api/v1/auth/sso/{saml,oidc}/**`, `/api/v1/auth/sso/config`,
  `/api/v1/auth/admin-login` (+ `/admin-login`), `/api/v1/portal/**`, `/report`,
  `/portal`, `/api/v1/vendors/dd/submit`, `/api/v1/scim/v2/**`,
  `/api/v1/invitations/<token>/accept`, `/api/v1/calendar/ical/<token>`,
  `/api/v1/branding/css/<orgId>`, `/api/health` (S02-19).
- Bewusst **nicht** geöffnet (obwohl im selben Teilbaum):
  `/api/v1/auth/switch-org`, `/api/v1/calendar/ical/{generate,revoke}-token`,
  `/api/v1/invitations` (Liste/Anlage). Dafür die verankerten Regexe statt
  Präfixe.

### S12-18 · Low · `startsWith()` auf zu kurzen Präfixen

**Status: geschlossen** — `isPublicExactOrUnder()` verlangt Gleichheit oder ein
Trennzeichen. `/api/v1/whistleblowing/intake-codes` fällt damit nicht mehr unter
die `intake`-Ausnahme; dasselbe für `/api/v1/meta` und `/login`.
**Nachweis:** `apps/web/src/__tests__/middleware-public-paths.test.ts` (37 Tests),
inkl. der hypothetischen künftigen Geschwister `intake-status`, `meta-admin`,
`login-as`.

### S02-05 · High · Token-Endpunkte können ihr Token unter `grc_app` nicht auflösen

**Status: geschlossen** (applikationsseitig, ohne Änderung an RLS-Policies)

- Migration `0412_anonymous_token_resolution.sql`: eng begrenzte
  `SECURITY DEFINER`-Funktionen mit `SET search_path = pg_catalog, public`,
  `REVOKE ALL … FROM PUBLIC` + gezieltem `GRANT EXECUTE` an `grc_app`:
  `auth_resolve_invitation_token`, `auth_resolve_scim_token`,
  `auth_touch_scim_token`, `auth_resolve_dd_session_token`,
  `auth_resolve_wb_mailbox_token`, `auth_resolve_org_by_code`,
  `auth_resolve_ical_token`, `auth_consume_saml_assertion`,
  `auth_check_login_lock`, `auth_register_login_failure`,
  `auth_register_login_success`, `auth_is_platform_admin`.
  Jede gibt **nur** die Felder zurück, die zur Ermittlung des Org-Kontexts
  nötig sind — nie den ganzen Datensatz, nie eine Liste.
- `packages/auth/src/anonymous-token.ts` kapselt die Aufrufe typisiert und
  liefert `withAnonymousTokenContext()` (Delegation an `withOrgReadContext`).
- Danach läuft **jede** weitere Abfrage des Handlers wieder unter voller RLS:
  Invite-Annahme, SCIM, Vendor-DD-Portal (alle vier Routen), iCal-Feed,
  Branding-CSS, HinSchG-Meldeportal (GET + POST), SAML- und OIDC-Callback
  (SSO-Config-Read **und** JIT-Provisioning).
- **Reproduktion des Fixes** (gegen `wp3_test`, Klon von `wp2_base`):
  ```
  SET ROLE grc_app;
  SELECT count(*) FROM invitation WHERE token='WP3POCTOKEN…';                 -- 0
  SELECT count(*) FROM auth_resolve_invitation_token('WP3POCTOKEN…');         -- 1
  ```

### S02-02 / S12-14 · Critical · Custom-Role-Fallback hebt jede Rollenprüfung auf

**Status: geschlossen**

- `checkCustomRoleAccess()` (modul- und aktionsblind) ist **ersatzlos entfernt**.
- Der Fallback in `withAuth()` ist jetzt modul- **und** aktionsbewusst:
  - er greift nur, wenn die Route über die Registry einem **Fachmodul**
    zugeordnet ist; `platform`-Routen (`/users`, `/organizations`, `/admin`,
    `/auth`, Abrechnung …) sind ausgeschlossen — dort gibt es keine
    Custom-Rollen-Semantik;
  - er verlangt genau die Aktion, die die Anfrage braucht: `admin`-only-Guard →
    Modul-Aktion `admin`, mutierende Methode → `write`, sonst `read`;
  - ohne ermittelbaren Routenpfad greift er **gar nicht** (fail closed).
- Damit der zentrale Prüfpunkt den Pfad kennt, stempelt die Middleware ihn als
  Request-Header `x-arctos-path` / `x-arctos-method` (clientseitig gesetzte
  Werte werden überschrieben, sind also nicht spoofbar).
- Defence in depth auf der PoC-Route: `POST /api/v1/users/:id/roles` lehnt
  Selbstzuweisung ab (403) und validiert die Rolle gegen `isUserRole()` (422).

**Nachweis:** `apps/web/src/__tests__/api/s02-02-privilege-escalation.test.ts`
(7 Tests) fährt exakt den Auditpfad: `viewer` + Custom-Rolle `academy:read` →
`withAuth("admin")` auf `POST /users/:id/roles` → **403**. Ergänzend:
`with-auth.test.ts` — der Test, der den Defekt als Sollverhalten festschrieb
(„succeeds via custom-role fallback"), ist durch den Gegentest ersetzt; der
Austausch ist im Test kommentiert.

### S02-01 · Critical · Default-Admin `admin@arctos.dev` / `admin123`

**Status: geschlossen**

- `packages/db/src/seed.ts`:
  - `assertSeedAllowed()` bricht bei `NODE_ENV=production` ab, sofern nicht
    `ALLOW_PRODUCTION_SEED=true` gesetzt ist (vorher: **kein** Guard,
    `grep NODE_ENV|production|ALLOW_SEED` → 0 Treffer);
  - kein hartkodiertes Passwort mehr — entweder `SEED_ADMIN_PASSWORD` /
    `SEED_DEMO_PASSWORD` (≥12 Zeichen) oder ein Zufallspasswort, das **einmal**
    ausgegeben wird. Das betrifft auch das zweite hartkodierte Passwort
    `arctos2026!` der vier Demo-Konten;
  - jedes geseedete Konto bekommt `must_change_password = true`.
- `deploy/setup.sh`: Der Schritt `npm run db:seed` und die Zeile
  `Login: admin@arctos.dev / admin123` sind entfernt. Stattdessen
  `npm run db:create-admin -- --email <…>` und ein expliziter Hinweis, dass
  Bestandssysteme das Altkonto deaktivieren müssen.
- Neu: `packages/db/src/create-admin.ts` (`npm run db:create-admin`) legt genau
  einen Administrator mit Zufallspasswort und Erstpasswortzwang an; optional
  `--platform-admin` (der einzige unterstützte Weg, S02-03 zu vergeben).
- Migration 0411: `user.must_change_password`, `user.password_changed_at`.
  Der Credentials-Provider gibt `mustChangePassword` in die Session.

### S02-03 · Critical · Plattformweite Tabellen nur mit Mandanten-Rolle geschützt

**Status: geschlossen**

- Migration 0411: Tabelle `platform_admin` (`user_id` PK, `granted_at`,
  `granted_by`, `reason`, `revoked_at`), RLS + FORCE mit **nur** einer
  SELECT-Policy (Selbstauskunft). Es gibt **keine** INSERT/UPDATE/DELETE-Policy
  für `grc_app` und explizit nur `GRANT SELECT` — die Anwendung kann die Frage
  stellen, aber die Antwort nie erzeugen. Vergabe ist eine Betreiberhandlung
  (dokumentiert in `deploy/setup.sh`, unterstützt von `db:create-admin
--platform-admin`).
- `withAuth()` verlangt für Schreibzugriffe auf
  `/feature-gates`, `/subscriptions/plans`, `/plugins`,
  `/data-sovereignty/regions`, `/framework-mappings`, `/template-packs`,
  `/catalogs` einen Plattform-Admin (`requiresPlatformAdmin` +
  `auth_is_platform_admin`). Lesen bleibt für authentifizierte Nutzer offen.
- Zusätzlich lokal in den 11 betroffenen Routendateien:
  `const platformCheck = await requirePlatformAdmin(ctx);`
- `isPlatformAdmin()` schlägt bei DB-Fehlern **fail closed** aus (deny), damit
  eine nicht eingespielte Migration nicht mehr gewährt als vorher.

### S02-06 · High · Audit-Sign-off ohne Rollenprüfung, `signerRole` client-bestimmt

**Status: geschlossen**

- `…/audit-mgmt/audits/[id]/sign-off/route.ts`: `withAuth()` → expliziter
  Rollenguard; zusätzlich bindet `SIGNER_ROLE_REQUIREMENTS` jede beanspruchte
  Signaturrolle an mindestens eine Plattformrolle, die der Unterzeichner **in
  derselben Organisation** tatsächlich hält (z. B. `management` verlangt
  `admin` oder `department_head`). Sonst 403.
- Der bisherige Zustand — ein `viewer` erzeugt eine hash-ketten-verankerte
  Zeile „Management hat den Prüfbericht freigegeben" — ist damit nicht mehr
  möglich.
- Der bestehende Test `audit-rbac-matrix.test.ts` schrieb
  `expectedRoles: []` fest; er ist mit Begründung auf die neue Rollenliste
  aktualisiert.

### S02-07 · High · Massenexport ohne Rolle, Limit und Vier-Augen

**Status: Mechanismus umgesetzt, Einbau an WP8 übergeben** (Dateihoheit)

- `packages/auth/src/middleware/bulk-export-guard.ts`: reine
  Entscheidungsfunktion `decideBulkExport()` — Rollenpflicht
  (`admin`/`dpo`/`compliance_officer`), Obergrenze für `entityTypes` (5),
  Zeilenobergrenze (50.000), Vier-Augen-Pflicht sobald personenbezogene
  Entitäten enthalten sind. Getestet in
  `packages/auth/tests/bulk-export-guard.test.ts` (5 Tests).
- Der Rollenboden greift **zusätzlich schon jetzt** zentral:
  `MUTATING_ROLE_REGISTRY` bildet `/export/bulk` auf
  `["admin","dpo","compliance_officer"]` ab, `withAuth()` setzt das durch, auch
  ohne Änderung an der Routendatei.
- Offen bei WP8: der Einbau in `apps/web/src/app/api/v1/export/bulk/route.ts`
  (Aufruf von `decideBulkExport`, Approval-Auflösung, harte Protokollpflicht
  statt best-effort `catch`). Siehe Abschnitt 3.

### S02-08 · High · Org-Kontext als Session-GUC auf Pool-Verbindung

**Status: geschlossen** (für die WP3-Fundstelle)

- `…/calendar/ical/[token]/route.ts` neu geschrieben: kein
  `set_config('app.current_org_id', …, false)` auf dem Basis-Pool mehr. Der
  Token wird über `auth_resolve_ical_token` aufgelöst, die Aggregation läuft in
  `runWithRequestContext`, das eine **eigene** Verbindung reserviert, die GUCs
  darauf setzt und sie danach freigibt.
- Die beiden Worker-Fundstellen derselben Klasse
  (`calendar-digest.ts`, `calendar-overdue-check.ts`) gehören WP9 — übergeben,
  siehe Abschnitt 3.

### S02-09 · Medium · Kein Rate-Limit/Lockout am Login, XFF-Spoofing

**Status: geschlossen** (Lockout); Rate-Limit-Bibliothek an WP9 übergeben

- Migration 0411: `user.failed_login_attempts`, `last_failed_login_at`,
  `locked_until`. Migration 0412: `auth_check_login_lock`,
  `auth_register_login_failure`, `auth_register_login_success` (SECURITY
  DEFINER, weil der Login ohne Org-Kontext läuft und `user` FORCE-RLS hat).
- `packages/auth/src/providers.ts`: Sperre wird **vor** jeder Passwortarbeit
  geprüft; 10 Fehlversuche → 15 Minuten Sperre; Erfolg setzt den Zähler zurück.
  Bewusst **konto**-basiert, nicht IP-basiert: die IP stammt aus
  `X-Forwarded-For` und ist client-wählbar — genau die im Bericht beschriebene
  Umgehung.
- Derselbe Lockout gilt für den Break-Glass-Pfad
  (`/api/v1/auth/admin-login`), zusätzlich zum dortigen IP-Limit.
- **Nachweis:** `packages/auth/tests/login-lockout.test.ts` (7 Tests), inkl.
  „die Sperre liest keinen Header" und „ein DB-Fehler sperrt nicht alle aus".

### S02-10 · Medium · 91 mutierende Endpunkte ohne Rollenprüfung

**Status: geschlossen**

- `apps/web/src/lib/module-guard.ts` (neu):
  `MUTATING_ROLE_REGISTRY` (fachlich enge Listen für die im Bericht namentlich
  genannten Pfade) + `DEFAULT_MUTATING_ROLES` (alle Rollen **außer**
  `READ_ONLY_ROLES = ["viewer"]`).
- `withAuth()` wendet die Registry an, wenn **keine** expliziten Rollen
  übergeben wurden und die Methode mutierend ist. Explizite Argumente haben
  immer Vorrang.
- Begründung für die zentrale statt der 91-fach lokalen Lösung: eine Kontrolle,
  die in jeder neuen Routendatei erneut von Hand gesetzt werden muss, ist genau
  die Kontrolle, die wieder vergessen wird — der Befund selbst ist der Beleg.
  Die Registry ist im Test gegen den **realen Routenbaum** abgeglichen, eine
  neue Route ohne Eintrag lässt den Test rot werden.

### S02-11 · Medium · 368 von 985 mutierenden Handlern ohne `requireModule`

**Status: geschlossen**

- `ROUTE_MODULE_REGISTRY` (168 Präfixe, längster gewinnt) bildet jeden
  `/api/v1`-Pfad auf einen `ModuleKey` **oder** `"platform"` ab. Die
  Modulzuordnung ist aus der tatsächlich beobachteten `requireModule(...)`-
  Verwendung der bereits abgesicherten 617 Handler abgeleitet
  (`S02-routes-matrix.csv`), damit zentrale und lokale Prüfung nie
  widersprüchliche Schlüssel verwenden.
- `withAuth()` ruft `requireModule(scope, orgId, method)` zentral auf, wenn der
  Scope kein `platform` ist. Routen mit eigenem Aufruf behalten ihn (der Cache
  macht die Doppelprüfung praktisch kostenlos).
- `"platform"` ist eine **bewusste, dokumentierte** Kategorie für Routen ohne
  lizenzierbares Fachmodul (Nutzer-, Organisations-, Auth-, Abrechnungs- und
  Betriebsverwaltung). Von den 331 mutierenden Handlern in WP3-Hoheit ohne
  Guard bekommen 139 einen echten Modulguard, 192 sind Plattformrouten.
- **Nachweis:** `apps/web/src/__tests__/api/route-role-matrix.test.ts` — „every
  mutating route resolves to a module scope" über den gesamten Routenbaum.

### S02-12 · Medium · Keine Funktionstrennung im BPMN-Freigabezyklus

**Status: geschlossen**

- `packages/shared/src/process-approval.ts`: `canDecideApprovalStep()` nimmt
  einen optionalen `ApprovalSoDContext` (`submittedBy`, `chainCreatedBy`,
  `processOwnerId`, `versionCreatedBy`). Vier-Augen wird **zuerst** geprüft und
  überstimmt jede Rolle, auch `admin` — die Selbstfreigabe des Admins entfällt,
  der Vertretungsweg bleibt.
- `…/processes/[id]/approval-steps/[stepId]/decide/route.ts` lädt die
  Herkunftsfelder (Kettenersteller, Prozesseigner, Versionsautor) und übergibt
  sie.
- `…/processes/[id]/approval-steps/route.ts` lehnt eine Kette, in der sich der
  Definierende selbst als Prüfer/Freigeber einträgt, bereits bei der Anlage mit
  422 ab — eine Kette, die erst beim Entscheiden scheitert, wäre eine Falle
  statt einer Kontrolle.

### S02-13 · Medium · `GET /users/[id]/roles` ohne Org-Filter

**Status: geschlossen** — `eq(userOrganizationRole.orgId, ctx.orgId)` wird für
den Admin-Pfad ergänzt; die Selbstauskunft behält bewusst die Sicht über alle
eigenen Organisationen (das ist die Datenbasis des Nutzers selbst und von
`uor_self_read` gedeckt).

### S02-14 · Medium · Rollenmodell dreifach inkonsistent

**Status: geschlossen** — siehe Abschnitt 0.
**Nachweis:** `packages/shared/tests/role-model-consistency.test.ts` (6 Tests).

### S02-15 · Medium · SCIM-Bearer-Token ohne Ablauf und Rotation

**Status: geschlossen**

- Migration 0411: `scim_token.expires_at`, `rotated_from_id`, `rotated_at`;
  Bestandstoken bekommen `now() + 90 Tage` statt „unbefristet".
- `packages/auth/src/scim/token-auth.ts` prüft `is_active`, **`revoked_at`**
  (wurde nie gelesen) und `expires_at`. `last_used_at` läuft über
  `auth_touch_scim_token` in `try/catch` — der nackte UPDATE konnte die
  Authentifizierung **nach** erfolgreicher Tokenprüfung mit 500 abbrechen.
- `POST /api/v1/admin/scim/tokens` setzt `expires_at` (90 Tage) und akzeptiert
  `rotatesTokenId` für eine Rotation ohne Ausfallfenster; die Liste gibt
  `expiresAt` aus.
- `generateScimToken()` nutzt jetzt einen ESM-Import statt `require("crypto")`.

### S02-16 · Low · Session ohne Rotation/Idle-Timeout

**Status: geschlossen** — `packages/auth/src/config.ts`:
`maxAge` 8 h → 2 h **absolut**, plus `updateAge: 15 min` (rollierende
Erneuerung, solange die Sitzung aktiv ist). Ein untätiger Nutzer wird nach 2 h
abgemeldet, ein aktiver nicht. Die regelmäßige Neuausstellung ist außerdem der
Mechanismus, der die frisch gelesenen Rollen in die JWT-Kopie bringt, die die
Middleware sieht (S12-17). Ergänzend: `withAuth` lehnt deaktivierte Konten ab
(siehe S12-17), was den fehlenden Widerruf der JWT-Strategie kompensiert.

### S02-17 · Low · Benutzer-Enumeration über Antwortzeit, uneinheitliche E-Mail-Normalisierung

**Status: geschlossen** — `equaliseTiming()` führt auf dem Miss-Pfad denselben
bcrypt-Vergleich gegen einen Dummy-Hash aus; `normaliseEmail()` ist die eine
Regel für alle drei Login-Pfade, und der Credentials-Provider vergleicht
`lower(email)`.
**Offen (WP1/WP10):** ein funktionaler Unique-Index `lower(email)` auf `user` —
siehe Abschnitt 3.

### S02-18 · Low · Break-Glass-Login prüft die SSO-Bedingung nicht

**Status: geschlossen** — `…/auth/admin-login/route.ts` verwendet den bisher nur
importierten `ssoConfig` jetzt tatsächlich: ohne aktive SSO-Erzwingung in
mindestens einer Org des Kontos wird der Break-Glass-Pfad mit 403 abgelehnt und
auf den regulären Login verwiesen.

### S02-19 · Low · `/api/health` nicht in der Middleware-Allowlist

**Status: geschlossen** — beide Health-Routen stehen exakt in
`PUBLIC_EXACT_PATHS`; ein Test deckt beide ab.

### S02-20 · Low · Portal-Token im Klartext, umkehrbare IP-„Pseudonymisierung"

**Status: geschlossen**

- Migration 0411: `dd_session.access_token_hash`, `user.ical_token_hash` (+
  Unique-Indizes, Backfill über `pgcrypto`). Beide Token werden ab sofort per
  SHA-256-Hash aufgelöst; die Klartextspalten bleiben ein Rotationsfenster lang
  bestehen, damit ausgegebene Links weiterlaufen (Löschung → Abschnitt 3).
- `apps/web/src/lib/portal-auth.ts`: `require("crypto")` im ESM-Modul entfernt;
  Hash-Vergleich zusätzlich in konstanter Zeit; **IP-Pseudonymisierung ist jetzt
  HMAC-SHA-256 unter einem Serverschlüssel mit Tagesrotation.** Ohne
  konfigurierten Schlüssel wird **nichts** gespeichert statt etwas, das nur
  geschützt aussieht.
- Der bestehende Test schrieb die naive SHA-256 als Soll fest; er ist ersetzt
  und prüft jetzt ausdrücklich, dass weder die IP noch ihr naiver SHA-256 im
  Datensatz landet.
- `wb_anonymous_mailbox` ohne RLS: an WP2/WP8 übergeben (Abschnitt 3).

### S02-21 · Info · Auth-Smoke-Test deckt nur mutierende Routen ab

**Status: geschlossen (als Test)** — `route-role-matrix.test.ts` weist für
**jeden** lesenden Handler statisch ein Authentifizierungsprimitiv nach; die
sieben bewusst anonymen Leseendpunkte stehen mit schriftlicher Begründung in
einer Ausnahmeliste, die derselben Disziplin folgt wie die Middleware-Allowlist.

### S02-22 · Info · Discovery-/Alias-/405-Stub-Routen ohne eigene Autorisierung

**Status: geschlossen (als Kontext + Test)** — die Middleware-Allowlist schaltet
keine dieser Routen frei (Test), und ein zusätzlicher Test stellt sicher, dass
kein `alias308`-Ziel aus der Anfrage interpoliert wird (Open Redirect).

### S12-17 · Medium · HinSchG-Gatter auf bis zu 8 h alten JWT-Rollen; keine Session-Invalidierung

**Status: geschlossen**

- Die HinSchG-Prädikate (`HINSCHG_ISOLATED_ROLES`, `isHinSchgIsolated`,
  `isHinSchgAllowedPath`) liegen jetzt edge-sicher in `packages/auth/src/rbac.ts`
  und werden **zweimal** ausgewertet: in der Middleware gegen die JWT-Kopie
  (deckt UI-Pfade und Discovery ab) und in `withAuth` gegen die **frisch aus der
  DB gelesenen** Rollen (deckt jede API-Autorisierung ab).
- `fetchFreshRoles()` in `apps/web/src/auth.ts` joint auf `user` und filtert
  `is_active = true AND deleted_at IS NULL`; kann kein lebender Nutzer gefunden
  werden, liefert es `disabled: true`, der Session-Callback leert Rollen und
  Org-Kontext, und `withAuth` antwortet 401. Ein deaktivierter Nutzer verliert
  seine Sitzung damit beim nächsten Request statt nach bis zu 8 Stunden.
- Zusammen mit S02-16 (2 h absolut, 15 min rollierend) schrumpft das Zeitfenster
  für veraltete Rollen in der Middleware von 8 h auf ≤15 min.

---

## 2. Abnahmekriterien

| Kriterium                                                       | Nachweis                                                                                  | Stand                           |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------- |
| Rollenmatrix-Test über alle mutierenden Routen                  | `apps/web/src/__tests__/api/route-role-matrix.test.ts` (9 Tests)                          | grün                            |
| SAML-Negativtest (manipulierte Assertion bei gültiger Signatur) | `packages/auth/tests/saml-signature.test.ts` (11 Tests)                                   | grün                            |
| OIDC-Negativtest (ungültige Signatur)                           | `packages/auth/tests/oidc-signature.test.ts` (7 Tests)                                    | grün                            |
| Reproduktion S02-02, schlägt nach dem Fix fehl                  | `apps/web/src/__tests__/api/s02-02-privilege-escalation.test.ts` (7 Tests)                | grün                            |
| Login-Lockout-Test                                              | `packages/auth/tests/login-lockout.test.ts` (7 Tests)                                     | grün                            |
| Middleware-Allowlist                                            | `apps/web/src/__tests__/middleware-public-paths.test.ts` (37 Tests)                       | grün                            |
| Rollenmodell-Konsistenz                                         | `packages/shared/tests/role-model-consistency.test.ts` (6 Tests)                          | grün                            |
| Massenexport-Guard                                              | `packages/auth/tests/bulk-export-guard.test.ts` (5 Tests)                                 | grün                            |
| Migrationen 0410–0412 gegen `wp2_base`-Klon                     | `psql -v ON_ERROR_STOP=1`, Exit 0                                                         | grün                            |
| `packages/auth` Suite                                           | 12 Dateien / 196 Tests                                                                    | grün                            |
| `packages/shared` Suite                                         | 80 Dateien / 1.923 Tests                                                                  | grün                            |
| `apps/web` Suite                                                | siehe Abschnitt 4                                                                         | grün bis auf paketfremde Fehler |
| `tsc --noEmit -p apps/web/tsconfig.json`                        | 1 verbleibender Fehler, in `health/schema-drift/route.ts` (WP1, `git blame` → `f6eafc23`) | fehlerfrei in allen WP3-Dateien |

---

## 3. Bedarf an andere Pakete

### WP2 — Mandantentrennung und RLS

1. **Policy-Alternative zu Migration 0412 (S02-05).** WP3 löst das
   RLS-Henne-Ei-Problem applikationsseitig über `SECURITY DEFINER`-Funktionen,
   weil die Policies WP2 gehören. Falls WP2 es policy-seitig lösen will, wäre je
   Tabelle eine SELECT-Policy nötig, die auf einen gesetzten Token-GUC prüft,
   z. B.
   `token = NULLIF(current_setting('app.presented_token', true), '')`.
   In dem Fall können die Resolver-Funktionen entfallen. **Solange es die
   Policies nicht gibt, sind sie der einzige Weg, unter `grc_app` an die Zeile
   zu kommen.**
2. **Neue Tabellen brauchen eine WP2-Bewertung:**
   `platform_admin` (RLS + FORCE, nur Selbstauskunfts-SELECT, kein
   INSERT/UPDATE/DELETE für `grc_app` — Absicht) und `saml_assertion_replay`
   (RLS + FORCE mit Tenant-Policy `org_id = current_org`).
3. **`wb_anonymous_mailbox` hat als einzige Portal-Tabelle keine RLS**
   (`relrowsecurity=f`, S02-20). Die Token-Auflösung funktioniert dort, aber
   ohne Mandantennetz. Die Tabelle hat kein eigenes `org_id`; die Org hängt am
   `wb_report` — eine Parent-Policy wie bei den anderen Kindtabellen wäre die
   passende Form.
4. **`user` ohne funktionalen Unique-Index auf `lower(email)`** (S02-17). WP3
   normalisiert applikationsseitig; der Index gehört zum Schema.
5. **`apps/web/src/lib/api.ts`:** WP2 hat parallel den S01-21-Fix eingebaut.
   Achtung: `vitest` 4 wirft beim Lesen eines im `vi.mock`-Factory **nicht**
   definierten Named Exports. WP3 hat den Zugriff auf `reserveRequestContext` /
   `requestDbStorage` deshalb in ein eigenes `try/catch` gelegt — sonst
   bekommen sämtliche bestehenden Unit-Tests, die `@grc/db` mit einem
   `db`-Stub mocken, 503 statt des dokumentierten „skip context setup".

### WP1 — Datenbank, Migrationen, Schema-Reproduzierbarkeit

1. **`apps/web/src/app/api/v1/health/schema-drift/route.ts:48-50` bricht den
   Typecheck.** Der einzige verbleibende Fehler von
   `npx tsc --noEmit -p apps/web/tsconfig.json`:
   ```
   error TS2344: Type 'T' does not satisfy the constraint 'Record<string, unknown>'.
   ```
   `git blame` weist die Zeile dem WP1-Commit `f6eafc23` zu. Die Datei steht in
   der Dateihoheit von WP1, deshalb hat WP3 sie nicht angefasst. Fix ist eine
   Zeile:
   ```ts
   const rows = async <T extends Record<string, unknown>>(query: string): Promise<T[]> => {
   ```
2. **Drizzle-Schema-Ergänzungen aus WP3** (für die Schema-Drift-Prüfung
   relevant): `packages/db/src/schema/platform.ts` (`user`: `ical_token_hash`,
   `failed_login_attempts`, `last_failed_login_at`, `locked_until`,
   `must_change_password`, `password_changed_at`; neue Tabellen
   `platform_admin`, `saml_assertion_replay`),
   `packages/db/src/schema/identity.ts` (`scim_token`: `expires_at`,
   `rotated_from_id`, `rotated_at`),
   `packages/db/src/schema/supplier-portal.ts` (`dd_session.access_token_hash`).
   Alle korrespondieren mit den Migrationen 0411/0412; der Drift-Endpunkt
   sollte sie nach dem WP1-Fix als deckungsgleich melden.

### WP9 — Worker, Cron, Rate Limiting

1. **`apps/web/src/lib/rate-limit.ts` (S02-09, S10-05).** WP3 hat den
   Login-Lockout konto-basiert umgesetzt und die Bibliothek **nicht** angefasst.
   Offen bleiben dort: `getClientIp()` nimmt ungeprüft den **ersten**
   `X-Forwarded-For`-Wert ohne Trusted-Proxy-Konfiguration (frei fälschbar), der
   Limiter ist ausdrücklich fail-open und ohne Redis prozesslokal. Empfehlung:
   Trusted-Proxy-Hop-Zählung (`TRUSTED_PROXY_HOPS`), Redis-Backend, und für
   Auth-Pfade fail-closed statt fail-open.
2. **Dieselbe Pool-Poisoning-Klasse wie S02-08 in zwei Cronjobs:**
   `apps/worker/src/crons/calendar-digest.ts:72-74` und
   `apps/worker/src/crons/calendar-overdue-check.ts:36-38` setzen
   `set_config('app.current_org_id', …, false)` **je Org in einer Schleife** auf
   dem geteilten Basis-Pool. `postgres-js` garantiert für zwei getrennte
   `db.execute()` nicht dieselbe Verbindung — die Folgeabfrage kann unter dem
   Kontext einer **anderen** Org laufen. Muster für den Fix:
   `withOrgReadContext(orgId, …)` bzw. `runWithRequestContext`, wie in
   `apps/web/src/app/api/v1/calendar/ical/[token]/route.ts` vorgeführt.
3. **`packages/db/src/seed-control.ts:16`** setzt `SET app.bypass_rls = 'true'`
   auf Session-Ebene ohne `LOCAL` (aus S02 an S01 übergeben, hier nur erinnert).

### WP8 — Datenschutz, DSGVO, HinSchG

1. **`apps/web/src/app/api/v1/export/bulk/route.ts` (S02-07).** Einzubauen:
   ```ts
   import { decideBulkExport } from "@grc/auth";
   const decision = decideBulkExport(
     { entityTypes: body.data.entityTypes, approvalId: body.data.approvalId },
     ctx.roles ?? [],
     await approvalIsValid(body.data.approvalId, ctx), // zweiter Mensch
   );
   if (!decision.allowed) return problem.forbidden(decision.detail);
   ```
   Zusätzlich: die Protokollierung in `data_export_log` darf **nicht** mehr im
   `catch` verschluckt werden — schlägt sie fehl, muss der Export scheitern
   (heute gelingt der Export auch ohne Nachweis, der klassische
   Insider-Exfiltrationspfad). Und `exportEntities(..., {}, ...)` exportiert mit
   festem Leerfilter den vollständigen Bestand; `decision.maxRows` gehört
   durchgereicht.
2. **`apps/web/src/app/api/v1/portal/mailbox/**` (S02-05).** Die Route löst ihr
   Token weiterhin kontextfrei auf und liefert unter `grc_app` 0 Zeilen. Der
   Resolver liegt bereit:
   `resolveWbMailboxToken(token) → { id, reportId, orgId, expiresAt }`
   (`@grc/auth/anonymous-token`, Migration 0412). Danach den Rest des Handlers
   in `withOrgReadContext(orgId, …)` bzw. `runWithRequestContext` legen — Muster
   siehe `portal/dd/[token]/route.ts`.
3. **`wb_anonymous_mailbox.token` steht im Klartext** in der Datenbank (wie
   `dd_session.access_token` vor S02-20). Empfehlung: analog auf
   `token_hash` umstellen; `hashOpaqueToken()` steht bereit.

### WP10 — Lieferkette, CI/CD, Betrieb

1. **`deploy/.env.production.example:48` `RUN_SEEDS=true`** und
   **`deploy/.env.sample:47`** (S02-01). Der Seed verweigert in Produktion
   inzwischen selbst, aber das Template soll `RUN_SEEDS=false` sagen.
2. **`deploy/create-tenant.sh:267`**, **`deploy/README.md:24`**,
   **`deploy/docker-compose.yml:9`**, **`deploy/setup-hetzner.sh:164-170`**
   geben weiterhin `admin@arctos.dev / admin123` (bzw. die Demo-Konten) als
   Login aus. Ersetzen durch den `db:create-admin`-Ablauf aus
   `deploy/setup.sh`.
3. **`SECURITY.md:34`** behauptet, die Kennung werde „only seeded into demo
   tenants". Nach dem Fix stimmt das — der Satz sollte trotzdem auf den neuen
   Ablauf (kein Standard-Login) umgestellt werden.
4. **Startup-Assertion auf `APP_DATABASE_URL`** (aus S02-13 / S13-10): ohne die
   Variable läuft die Anwendung klaglos als Superuser `grc`, und genau dann wird
   der fehlende Org-Filter zur Mandantenverletzung. WP3 hat den Filter ergänzt,
   die Startprüfung gehört zu WP10/WP2.

### WP11 — Testfundament

- `apps/web/src/__tests__/api/all-mutating-routes-auth-smoke.test.ts` bleibt die
  Soll-Dokumentation anonymer Endpunkte. Ihre Allowlist und die neue
  Middleware-Allowlist (`PUBLIC_PATH_TABLE` in `@grc/auth`) sollten
  gegeneinander geprüft werden — heute sind es zwei getrennte Listen.

### WP12 — Oberfläche

- `apps/web/src/app/(auth)/login/page.tsx` und `(auth)/admin-login/page.tsx`
  funktionieren jetzt erstmals (S12-09), zeigen aber weiterhin keinen
  Erstpasswort-Dialog. Die Session trägt neu `mustChangePassword`
  (S02-01); ein Zwangs-Redirect auf eine Passwortänderungsseite fehlt noch.
- Der Break-Glass-Pfad antwortet neu mit 403 und der Begründung
  „nur bei aktiver SSO-Erzwingung" (S02-18) — die UI sollte diese Meldung
  anzeigen statt der generischen `breakGlassError`.

---

## 4. Bekannte Fremdfehler zum Zeitpunkt des Abschlusses

Welle 2 läuft parallel im selben Arbeitsverzeichnis. Folgende Fehler stammen
**nicht** aus WP3 und sind zum Zeitpunkt der WP3-Abnahme im Baum:

- `tsc --noEmit -p apps/web/tsconfig.json`: **genau ein** verbleibender Fehler,
  `apps/web/src/app/api/v1/health/schema-drift/route.ts(49,37)` — WP1-Datei,
  WP1-Commit (`git blame` → `f6eafc23`), Ein-Zeilen-Fix in Abschnitt 3.
  Die zwischenzeitlich vorhandenen Fehler in `isms/**`, `risks/export` und
  `packages/db/src/rls-audit.ts` (parallele `parseQueryParams`/Zod-Umstellung
  `#S04-09`, WP2) sind von den jeweiligen Paketen inzwischen behoben.
- `apps/web` Vitest: alle 93 Dateien / 4.692 Tests grün (526 Skips
  vorbestehend, S11-02). Der zwischenzeitliche Fehler in
  `export-engine-pdf.test.ts` (`sql.join is not a function`) ist von WP5
  behoben.

Diese sind an die jeweiligen Pakete zu melden; WP3 hat sie bewusst nicht
angefasst (Dateihoheit).

---

## 5. Restrisiko

1. **Der Modul-/Rollenguard hängt an einem Middleware-Header.** `withAuth()`
   liest `x-arctos-path`/`x-arctos-method`. Die Middleware überschreibt beide
   und deckt über ihren Matcher jeden Pfad ab; fehlt der Header trotzdem
   (künftige Runtime ohne Middleware, direkter Handler-Aufruf), fällt der
   Custom-Rollen-Fallback **aus** und der strengste Rollenboden greift — die
   Ausfallrichtung ist restriktiv, aber ein Pfad ohne Middleware würde auch den
   Modulguard verlieren.
2. **Plattform-Admin ist bewusst nur am DB-Prompt vergebbar.** Das schließt
   S02-03, verlagert aber einen Betriebsschritt auf den Menschen. Wer die
   Migration 0411 nicht einspielt, bekommt bei jedem Schreibzugriff auf die
   globalen Tabellen 403 (`isPlatformAdmin` schlägt fail-closed aus) — korrekt,
   aber als Betriebsereignis sichtbar zu machen.
3. **SAML-Zertifikatsverwaltung bleibt offen.** Die Signaturprüfung ist jetzt
   korrekt, prüft aber weder Ablauf noch Kette des konfigurierten
   IdP-Zertifikats — ein abgelaufenes Zertifikat verifiziert weiterhin.
   Rotation und Gültigkeitsprüfung sind ein eigener Betriebsvorgang.
4. **Die Klartext-Tokenspalten leben weiter.** `dd_session.access_token` und
   `user.ical_token` bleiben ein Rotationsfenster lang bestehen, damit
   ausgegebene Links nicht brechen. Bis zum `DROP COLUMN` ist das Leseleck aus
   S02-20 nur halb geschlossen — der Schritt gehört in eine Folgemigration
   (Nummernkreis WP3: 0413/0414 sind frei).
5. **Zwei Findings sind mechanisch fertig, aber nicht eingebaut**: S02-07
   (Massenexport, Einbau bei WP8) und die Mailbox-Route (S02-05, WP8). Beide
   sind bis zum Einbau von WP8 nur zur Hälfte wirksam — der zentrale Rollenboden
   greift, die Vier-Augen-Prüfung nicht.
