# Welle 1a — Betrieb und Zugriff

**Plan:** `docs/UMSETZUNGSPLAN-OFFENE-PUNKTE.md` §3 · **Register:** `docs/OFFENE-PUNKTE-REGISTER.md`
**Stand vorher:** `43e6ab8f` · **Branch:** `audit/full-2026-08-31` · **Datum:** 2026-09-02

---

## 1. Was dieser Strang war und was er geworden ist

Der Plan führte elf Punkte, davon einen als „der einzige unmittelbar
deploy-relevante" (OP-090). Die Erwartung war: zwei Zeilen in einer
Compose-Datei, eine Policy, eine Route, ein paar Wächter.

**Drei der elf waren im Code längst erledigt und nur im Register nicht
nachgezogen** — und ausgerechnet an diesen dreien saß der eigentliche Defekt
eine Ebene höher:

| Punkt      | Register sagt                               | Der Code sagt                                                         | Was wirklich offen war                                                        |
| ---------- | ------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **OP-090** | Compose/CI nicht auf `grc_worker`           | Compose steht seit `08607f36`/`f11c5895` auf `grc_worker`             | Das CI-Tor prüfte die Umstellung nie und **läuft grün gegen den Rückfall**.   |
| **OP-091** | `GRC_APP_PASSWORD` ohne `:?`                | `docker-compose.production.yml:227` hat `:?`                          | `deploy/docker-compose.yml` hatte vier nackte `${…}` in DB-URLs.              |
| **OP-052** | vier Tabellen fehlen, Endpunkt 503          | gegen eine frisch migrierte Datenbank: **0 fehlend, `healthy: true`** | Die Messung stammte aus einer Container-DB, die 65 Tabellen zurücklag (O-10). |
| **OP-084** | 115 Routen ohne `withErrorHandler`          | alle 115 sind gewickelt                                               | Die Ratsche wurde nie nachgezogen — sie war **seit Tagen rot**.               |
| **OP-142** | „Dauerschutz ist allein der RLS-Systemtest" | `audit-rls-coverage.mjs` erkennt die S01-07-Form                      | Der Workflow, der ihn ausführen soll, **kann nicht laufen**.                  |

Das ist kein Zufall, sondern ein Muster: **an vier von elf Stellen war nicht
die Sache kaputt, sondern der Wächter über die Sache.** Ein Tor, das den
Rückfall nicht sieht; eine Ratsche, deren Baseline nicht nachgezogen wurde;
ein Workflow ohne Abhängigkeiten und ohne Datenbank; eine Regex, die an der
Normalisierung von PostgreSQL vorbeigreift. Der Rest dieses Protokolls
behandelt beides — den Punkt und seinen Wächter.

Die Reihenfolge unten ist die der Aufgabenstellung, nicht die der Entdeckung.

---

## 2. OP-090 — Worker als Superuser: das Tor, das den Rückfall nicht sieht

**Befund im Register.** „`docker-compose.production.yml` und `ci.yml` noch
nicht auf `grc_worker` umgestellt (S01-09, Status **teilweise**). Bis dahin muss
der Worker `ARCTOS_ALLOW_PRIVILEGED_DB=true` setzen — RLS ist für ihn
wirkungslos. Einziger unmittelbar deploy-relevanter Punkt aus WP2."

**Reproduktion — die Compose-Hälfte trifft nicht mehr zu.**

```
$ grep -n "DATABASE_URL" docker-compose.production.yml | grep -v APP_
209:      DATABASE_URL: postgresql://grc:${DB_PASSWORD:?…}@postgres:5432/grc_platform      # web, nur Entrypoint/Migrationen
423:      DATABASE_URL: postgresql://grc_worker:${GRC_WORKER_PASSWORD:?…}@postgres:5432/…  # worker
540:      DATABASE_URL: postgresql://grc_worker:${GRC_WORKER_PASSWORD:?…}@postgres:5432/…  # ops-metrics
```

Beide Worker-artigen Dienste fahren als `grc_worker`; die Begründung steht seit
`08607f36` im Kommentar darüber (WP9/S01-09). `.github/workflows/ci.yml:339`
setzt `WORKER_DATABASE_URL` ebenfalls auf `grc_worker`. Der Register-Eintrag
gibt WP2s Übergabetext wieder, der zum Zeitpunkt des Registers schon überholt
war.

**Was tatsächlich offen war.** Der CI-Schritt, der genau diese Regression
verhindern soll (`#SEC-F05`, `ci.yml:1090`), prüfte drei Dinge — und keines
davon war die Rolle des Workers. Er schloss mit

```
F-05 OK: web=grc_app (RLS enforced), worker=grc (privileged, cross-org).
```

Diese Zeile war zum Prüfzeitpunkt bereits falsch. Gemessen, indem der Block
wörtlich extrahiert und gegen eine manipulierte Fassung laufen gelassen wurde,
in der die Worker-Zeile wieder auf den **Superuser** zeigt:

```
$ sed 's#postgresql://grc_worker:${GRC_WORKER_PASSWORD:?…}#postgresql://grc:${DB_PASSWORD}#' \
      docker-compose.production.yml > regressed.yml
$ bash gate-alt.sh regressed.yml
APP_DATABASE_URL=grc_app declarations found: 1 (expected >= 1, web)
F-05 OK: web=grc_app (RLS enforced), worker=grc (privileged, cross-org).
EXIT=0
```

Der Wächter läuft grün gegen genau die Regression, gegen die er steht. Er
konnte sie nie sehen: er wusste nur, dass der Worker **kein**
`APP_DATABASE_URL` setzen darf — und das gilt vor wie nach der Umstellung.

**Entscheidung.** Den Inline-Block ersetzen statt flicken, und als eigenständiges
Skript statt als YAML-Block. Begründung: ein Wächter, den man nicht lokal
ausführen kann, wird nicht gegengeprüft — genau das ist hier passiert.

**Änderung.** Neu: `scripts/check-compose-db-roles.mjs`. Es prüft beide
Compose-Dateien gegen sechs Regeln:

1. der Web-Dienst deklariert `APP_DATABASE_URL` auf `grc_app`;
2. kein Dienst richtet `APP_DATABASE_URL` auf `grc` oder `grc_worker`
   (beide umgehen RLS) — `APP_DATABASE_URL` **ist** der RLS-Nachweis;
3. `worker` und `ops-metrics` verbinden über `DATABASE_URL` als `grc_worker`;
4. sie deklarieren kein `APP_DATABASE_URL`;
5. der Superuser `grc` steht nur in vier namentlich begründeten Ausnahmen
   (`web` für die Entrypoint-Migrationen, `postgres`, `create-admin`,
   `provision-roles`);
6. OP-091, siehe unten.

Der Wächter bricht auch ab, wenn er einen erwarteten Dienst **nicht** findet —
ein Prüfer, der bei fehlender Eingabe grün meldet, ist der Fehler aus Welle 0.
`ci.yml` ruft ihn jetzt statt des Inline-Blocks; `scripts/check-gate-inputs.mjs`
kennt beide Compose-Dateien als Tor-Eingabe.

**Gegenprobe** (vier künstliche Brüche, jeder einzeln zurückgenommen):

| Probe                                            | Ergebnis                                                                         |
| ------------------------------------------------ | -------------------------------------------------------------------------------- |
| Worker-`DATABASE_URL` zurück auf Superuser `grc` | ✗ „worker: DATABASE_URL verbindet als 'grc' statt 'grc_worker' (S01-09)"         |
| `GRC_APP_PASSWORD:?` → `GRC_APP_PASSWORD:-`      | ✗ „liefert ein DB-Passwort ohne :?-Pflichtprüfung"                               |
| `APP_DATABASE_URL` aus dem Web-Dienst entfernt   | ✗ „web: APP_DATABASE_URL fehlt … RLS in Produktion wirkungslos"                  |
| `APP_DATABASE_URL` am Worker ergänzt             | ✗ „worker: deklariert APP_DATABASE_URL … täte still nichts"                      |
| echter Stand                                     | ✓ web=grc_app, worker=grc_worker, ops-metrics=grc_worker (beide Compose-Dateien) |

---

## 3. OP-091 — `:?`-Pflichtprüfung: die zweite Compose-Datei

**Befund im Register.** „`GRC_APP_PASSWORD` ohne `:?`-Pflichtprüfung in
`docker-compose.production.yml:212`; ein leeres Passwort startet still."

**Reproduktion.** In der Produktionsdatei trifft das nicht mehr zu — Zeile 227
trägt `${GRC_APP_PASSWORD:?Set GRC_APP_PASSWORD in .env — …}`, und die
Vorgängerform steht nur noch im Kommentar darüber (WP10/S08-17). Der neue
Wächter meldet die Datei sauber.

**Was offen war:** `deploy/docker-compose.yml` — die zweite, für die
Hetzner-Einrichtung benutzte Compose-Datei. Vier DB-URLs mit nacktem `${…}`:

```
160: DATABASE_URL:     postgresql://grc:${DB_PASSWORD}@…            (web)
162: APP_DATABASE_URL: postgresql://grc_app:${GRC_APP_PASSWORD}@…   (web)
235: DATABASE_URL:     postgresql://grc_worker:${GRC_WORKER_PASSWORD}@…  (worker)
285: DATABASE_URL:     postgresql://grc:${DB_PASSWORD}@…            (create-admin)
```

Das **trägt heute**, weil dieselben Variablen weiter oben in derselben Datei
`:?`-erzwungen deklariert sind (`postgres.POSTGRES_PASSWORD:88`,
`provision-roles.GRC_*_PASSWORD:132/133`) und Compose die ganze Datei
interpoliert. Es trägt aber **nur, solange beide Dienste dort stehen**. Fällt
einer weg oder wandert in ein Profil, entsteht an diesen vier Stellen lautlos
ein syntaktisch gültiger URL mit leerem Passwort. Ein Dienst, dessen
Sicherheitszusage von der Anwesenheit eines anderen Dienstes abhängt, sagt sie
nicht selbst zu.

**Änderung.** Die vier Stellen tragen `:?` an der Verwendungsstelle. Regel 6 des
neuen Wächters erzwingt das für **jede** Variable, die in einer
`postgresql://`-URL ein Passwort liefert, in beiden Dateien.

**Gegenprobe.** Siehe Tabelle in §2, Zeile 2.

---

## 4. OP-083 — die kontextlose Disjunktion auf `user`

Der aufwendigste Punkt dieses Strangs, und der mit der größten Wirkung.

**Befund.** Die `user`-Policy aus Migration 0392 trägt drei Disjunktionen:

```
sichtbar, wenn  (a) es die eigene Zeile ist        (app.current_user_id)
            ODER (b) Mitgliedschaft in der aktuellen Org
            ODER (c) die Verbindung trägt GAR KEINEN Kontext
```

(c) steht dort, weil der Anmeldepfad `user` per E-Mail lesen muss, bevor eine
Identität feststeht. WP2 hat den Rest ausdrücklich als offene Lücke benannt und
den sauberen Weg an WP3 übergeben (S02-05).

**Reproduktion.** Frisch migrierte Datenbank (419 Migrationen), Rolle `grc_app`:

```
$ psql -U grc_app -c 'SELECT count(*) FROM "user"'                    # ohne jeden Kontext
 36
$ psql -U grc_app -c 'SELECT email, left(password_hash,12) FROM "user"'
 a@konzern.test        | (null)
 auditor@meridian.test | $2b$10$YObru
 b@fremd.test          | (null)
 bcm@arctos.dev        | $2a$10$xV5Gq
 …                                          ← Nutzer ALLER Mandanten, mit Hashes
$ psql -U grc_app -c "SELECT set_config('app.current_org_id','<Konzern>',false);
                      SELECT count(*) FROM \"user\""
 1
```

Der Basis-Pool ist genau die Verbindungsklasse, auf der Login, `admin-login`
und die SCIM-Endpunkte arbeiten. Es ist die einzige Policy im Schema, deren
Wirkung davon abhängt, ob der Aufrufer vergessen hat, einen Kontext zu setzen.

**Der Fund daneben: SCIM ist unter `grc_app` tot.** Die SCIM-Endpunkte lesen
`user` **und** `user_organization_role`. Letztere hat keine kontextlose
Disjunktion. Gemessen:

```
$ psql -U grc_app -c 'SELECT count(DISTINCT u.id) FROM "user" u
                        JOIN user_organization_role uor ON uor.user_id=u.id
                       WHERE uor.org_id = <Konzern> AND uor.deleted_at IS NULL'
 0                                    ← ohne Kontext (so läuft SCIM heute)
 1                                    ← mit gesetztem app.current_org_id
```

SCIM listet unter der Produktionsrolle also **nie einen Nutzer** — das
Deprovisioning Ausgeschiedener, der eigentliche Zweck der Schnittstelle, lief
ins Leere. Gleichzeitig sah derselbe Pfad über (c) das Nutzerverzeichnis aller
Mandanten. Beide Hälften desselben fehlenden Kontexts.

**Entscheidung.** Den von WP2 benannten Weg gehen: die kontextlosen Pfade auf
`SECURITY DEFINER`-Kapseln umstellen (Muster `app_current_org_scope()` aus
0396, `auth_*` aus 0412), **danach** (c) entfernen. Zwei Migrationen, weil die
Kapseln vorhanden sein müssen, bevor die Policy fällt — sonst gäbe es
dazwischen einen Stand, in dem sich niemand mehr anmelden kann.

**Änderung.**

`packages/db/drizzle/0455_auth_user_lookup_secdef.sql` legt drei Kapseln an:

| Funktion                                       | Wofür                                                                                                                   |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `auth_lookup_user_by_email(text)`              | Anmeldeabfrage. Eine Adresse rein, höchstens **eine** Zeile raus, nur die Anmeldefelder. Kein `LIKE`, keine Listenform. |
| `auth_sso_touch_login(uuid, text)`             | SSO-JIT-Buchführung (`last_login_at`, `sso_provider_id`, `is_active`) an genau einer benannten Zeile.                   |
| `auth_sso_provision_user(text,text,text,text)` | SSO-Neuanlage. Der `INSERT` selbst dürfte durchgehen; sein `RETURNING` wird gegen die SELECT-Policy ausgewertet.        |

Alle drei: fixierter `search_path`, `REVOKE ALL … FROM PUBLIC`,
`GRANT EXECUTE … TO grc_app` (S01-13-Muster). `password_hash` verlässt die
Kapsel bewusst — der bcrypt-Vergleich mit Timing-Angleichung gehört in die
Anwendung; ihn in der Datenbank zu führen hieße, das Klartextpasswort über die
Verbindung zu schicken und in `pg_stat_activity` sichtbar zu machen.

Umgestellte Aufrufer:

| Pfad                                              | Vorher                                          | Nachher                                                       |
| ------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------- |
| `providers.ts` credentials-`authorize`            | `db.select().from(user)` über Basis-Pool        | `lookupUserByEmail()` → Kapsel                                |
| `providers.ts` `jitProvisionSsoUser`              | Select + `UPDATE "user"` + `INSERT … RETURNING` | drei Kapseln                                                  |
| `api/v1/auth/admin-login`                         | `db.select().from(user)`                        | `lookupUserByEmail()`                                         |
| `api/v1/scim/v2/**` — **10 Handler in 4 Dateien** | Basis-Pool                                      | `runWithRequestContext({ orgId: authCtx.orgId, userId: "" })` |

`userId: ""` ist die etablierte Form für maschinelle Kontexte (`portal/*`,
`wb-Mailbox`): SCIM handelt als Dienst, nicht als Person, und der Audit-Trigger
schreibt entsprechend keinen Akteur statt einen erfundenen.

Unverändert, weil bereits im Kontext: `apps/web/src/auth.ts` `fetchFreshRoles`
(`withUserReadContext`), die SSO-Callbacks und `invitations/[token]/accept`
(`withOrgReadContext`), Login-Lockout und Token-Auflöser (SECURITY DEFINER aus
0411/0412), Seeds und Migrationen (Superuser `grc`), Worker (`grc_worker`,
BYPASSRLS). Vollständigkeit geprüft mit:

```
$ for f in $(grep -rl 'from(user)|FROM "user"|UPDATE "user"|insert(user)' \
             apps/web/src/app/api --include=route.ts); do
    grep -q withAuth "$f" || echo "$f  →  $(grep -o 'runWithRequestContext|withOrgReadContext|withUserReadContext' "$f" | sort -u)"
  done
oidc/callback     → withOrgReadContext
saml/callback     → withOrgReadContext
scim/v2/Users     → runWithRequestContext
scim/v2/Users/[id]→ runWithRequestContext
invitations/accept→ withOrgReadContext
```

`packages/db/drizzle/0456_user_policy_drop_contextless.sql` entfernt danach (c)
aus `user_tenant_select` und `user_tenant_update`. `INSERT` bleibt permissiv
(eine `user`-Zeile ohne Mitgliedschaft ist kein Mandantendatum), `DELETE` war
schon vorher strikt org-gebunden.

**Nachweis nach der Änderung**, dieselbe Datenbank, dieselbe Rolle:

```
ohne Kontext:                       0    (vorher 36)
mit Org-Kontext Konzern:            1
mit User-Kontext (Selbstsicht):     1
Anmeldekapsel ohne Kontext:         a@konzern.test
```

Die Ausfallrichtung ist damit umgedreht: wer künftig vergisst, einen Kontext zu
setzen, sieht **nichts** statt **alles**.

**Der Wächter über den Wächter.** Die Endzustandsprüfung in 0456 suchte im
ersten Entwurf nach `'%IS NULL AND%'`. PostgreSQL normalisiert beim Speichern
aber um — aus `A IS NULL AND B IS NULL` wird `((A) IS NULL) AND ((B) IS NULL)`.
Gemessen gegen die wiederhergestellte alte Policy:

```
erster Entwurf  ('IS NULL AND')            → 0 Treffer   ← hätte grün gemeldet
Endfassung (GUC-NULLIF gegen NULL, Regex)  → 1 Treffer   ← korrekt
```

Beide Fassungen stehen im Migrationskommentar; die Endfassung greift die
Signatur „das Ergebnis eines GUC-`NULLIF` wird mit NULL verglichen" und
überlebt jede Umklammerung.

**Gegenprobe.** Neuer Test `packages/db/tests/rls/user-table-contextless.test.ts`
(9 Fälle: kontextlose Sicht, kontextloser Hash-Zugriff, Kapsel liefert die
Zeile, Kapsel ist kein Verzeichnis, Org-Sicht, Selbstsicht, Policy-Form,
Rechtevergabe, und die Vorbedingung „die Verbindung ist unprivilegiert" —
bewusst als **Fehlschlag** statt als Skip, weil ein übersprungener
Isolationstest sich im Bericht wie ein bestandener liest).

Mit wiederhergestellter alter Policy: **3 fehlgeschlagen / 6 bestanden.**
Nach erneutem Einspielen von 0456: **9 bestanden.**

---

## 5. OP-084 — 115 Routen auf dem Basis-Pool: die Ratsche war rot

**Befund im Register.** „115 Routen ohne `withErrorHandler` nutzen den
kontextlosen Basis-Pool."

**Reproduktion.**

```
$ node scripts/check-route-rls-context.mjs ; echo "EXIT=$?"
✗ 1 NEW route(s) …
    + v1/calendar/ical/[token]/route.ts
✗ 115 baseline route(s) no longer offend — tighten the ratchet
    - v1/access-log/route.ts
    …
EXIT=1
```

Zwei Befunde in einem Lauf, und beide sind nicht das, was das Register sagt.

**(a) Die 115 sind gewickelt.** Nachgezählt, nicht angenommen:

```
$ while read -r f; do
    grep -qE 'withErrorHandler|with(Read|Audit|OrgRead|UserRead)Context|runWithRequestContext' \
      "apps/web/src/app/api/$f" && n=$((n+1)) || echo "UNGEWICKELT: $f"
  done < scripts/route-rls-context-baseline.txt
gewickelt=115  fehlend=0
```

Alle 115 tragen dieselbe Kommentarzeile aus der E2E-Triage vom 2026-09-02
(„withErrorHandler opens the requestDbStorage.run() frame"). Die Baseline wurde
damals nicht nachgezogen — **das Tor stand seither in jedem CI-Lauf auf Exit 1.**
Eine Ratsche, die auch das Gegenteil eines Befunds meldet („Eintrag verletzt
nicht mehr, bitte nachziehen"), wird dadurch zum Dauerrot und damit ignoriert.

**(b) Der eine „neue" Befund ist ein Fehlalarm — aus zwei Gründen.**
`v1/calendar/ical/[token]/route.ts` benutzt `runWithRequestContext`, den
**expliziten** Kontextrahmen aus `packages/db/src/request-context.ts`. Der
Wächter kannte ihn nicht. Und er las die Datei **roh**: der Kopfkommentar der
Route erklärt, dass sie „uses no `withAuth`" und wie das frühere
`db.execute(...)` aussah — beide Muster trafen, keines davon ist Code.

Das ist der schlechtere der beiden Fehler. Ein Wächter, der Kommentare mitliest,
bestraft die **Dokumentation eines behobenen Defekts** wie den Defekt selbst;
ein Autor lernt daraus, den Grund nicht aufzuschreiben.

**Änderung.** `scripts/check-route-rls-context.mjs`:

- `runWithRequestContext` in die Liste der Kontextrahmen aufgenommen;
- ein Zeichenscanner `stripCommentsAndStrings()` entfernt Zeilen- und
  Blockkommentare sowie `'`/`"`-Zeichenketten vor dem Mustern. Template-Literale
  bleiben stehen — `db.execute(sql\`…\`)` steht **im** Code und soll treffen;
- die Baseline nimmt jetzt `#`-Kommentarzeilen an und steht auf **0 Einträgen**,
  mit einem Kopftext, der sagt, dass die 0 eine Messung ist.

**Gegenprobe.**

| Probe                                                       | Ergebnis                          |
| ----------------------------------------------------------- | --------------------------------- |
| Sonde: neue Route mit `withAuth` + `db.select`, ohne Rahmen | ✗ „+ v1/\_\_op084_probe/route.ts" |
| dieselbe Sonde, aber in `runWithRequestContext` gewickelt   | ✓ grün                            |
| Sonde entfernt                                              | ✓ 0 Einträge, 0 neu               |

Der Wächter fällt jetzt bei der **ersten** neuen ungewickelten Route um, nicht
erst bei der 116.

---

## 6. OP-085 — Session-Invalidierung beim Rollenentzug

**Befund.** WP2/S01-22: „nach Entzug einer Mitgliedschaft behält das JWT die
Rolle bis zum nächsten Refresh, und RLS kennt nur den GUC, nicht die
Mitgliedschaft."

**Reproduktion — was seither geschah und was nicht.** S12-17 hat
`fetchFreshRoles` eingeführt: der `session`-Callback liest die Rollen bei jedem
`auth()`-Aufruf frisch aus der Datenbank, `withAuth` entscheidet also bereits
auf dem aktuellen Stand. Für den API-Verkehr ist der Entzug sofort wirksam.

Zwei Hälften fehlten:

1. **Die JWT-Kopie wurde nicht aufgefrischt.** `apps/web/src/auth.ts` lud die
   Rollen ausschließlich bei `trigger === "update"` nach, also nur nach einem
   ausdrücklichen `session.update()` im Client. Der rollierende Refresh
   (`updateAge`, 15 min) ruft den `jwt`-Callback **ohne** Trigger auf und lief
   in `return token`. Die Edge-Middleware — die ihr HinSchG-Gatter (S12-17) und
   ihre Modulsicht darauf stützt — entschied also auf einer bis zu **zwei
   Stunden** alten Rollenliste.

   Der Kommentar in `packages/auth/src/config.ts` behauptete das Gegenteil:
   „`updateAge` also re-issues the token regularly, **which is what makes the
   freshly read roles … propagate into the JWT copy the middleware sees**."
   Der Kommentar beschrieb ein Verhalten, das der Code nicht hatte — in einem
   GRC-Produkt der schwerere Mangel, weil ein Prüfer sich darauf verlässt.

2. **Eine ausgestellte Sitzung ließ sich überhaupt nicht beenden.** Ein
   entzogener Zugang blieb eine gültige Anmeldung, bis das _Konto_ deaktiviert
   wurde — was etwas anderes ist und andere Folgen hat.

**Entscheidung.** Eine Epoche je Nutzer statt einer Denylist. Die JWT-Strategie
hat keinen serverseitigen Sitzungsspeicher; eine Denylist müsste jede
ausgestellte Kennung führen. Ein Zeitstempel je Nutzer invalidiert alles Ältere
auf einen Schlag — genau die Semantik von „Rechte entzogen, bitte neu anmelden"
— und ist nach Ablauf der maximalen Sitzungsdauer (2 h) von selbst wirkungslos.

**Änderung.**

- `0457_session_invalidation_on_role_change.sql`: Spalte
  `user.sessions_valid_from` und die Kapsel
  `auth_invalidate_user_sessions(user, actor)`.
- `apps/web/src/auth.ts`: `fetchFreshRoles` liest die Epoche mit (kein
  zusätzlicher Rundlauf — die `user`-Zeile wird für den Liveness-Check ohnehin
  gejoint); der `session`-Callback vergleicht sie mit `token.iat` und setzt
  `disabled`. Der `jwt`-Callback frischt die Rollen jetzt zeitgesteuert nach
  (`ROLE_REFRESH_INTERVAL_MS = 60 s`) statt nur bei `session.update()`.
- `apps/web/src/lib/session-invalidation.ts`: eine Stelle, ein Kommentar.
  Aufgerufen von `POST` und `DELETE` unter `api/v1/users/[id]/roles/**` — die
  Vergabe ebenso wie der Entzug, denn eine neue Rolle wirkt sonst zwar im
  API-Pfad sofort, aber die Oberfläche zeigt das neue Modul nicht und der
  Nutzer meldet einen Fehler, den es nicht gibt.
- `packages/auth/src/config.ts`: der falsche Kommentar ist ersetzt und benennt,
  was er vorher behauptet hat.

**Warum eine Kapsel und kein `UPDATE` in der Route.** Der Administrator ist ein
anderer Nutzer als der Betroffene, und `user_tenant_update` erlaubt ihm die
fremde Zeile nur über die Mitgliedschaft. Beim Entzug der **letzten** Rolle
wäre das genau der Fall, für den der Fix gebaut ist. Die Kapsel prüft die
gemeinsame Organisation selbst und berücksichtigt dabei auch bereits beendete
Mitgliedschaften; über die Mandantengrenze hinweg wirft sie.

Die Ausfallrichtung ist bewusst **nicht** fatal: wenn die Route dort ankommt,
ist die Rollenänderung gebucht und auditiert. Schlägt die Invalidierung fehl,
ist der Zugriff trotzdem entzogen (der `session`-Callback liest frisch) — nur
die Middleware-Kopie lebt bis zu einer Minute länger.

**Gegenprobe.** Neuer Test `packages/db/tests/rls/session-invalidation.test.ts`,
6 Fälle, darunter der Kernfall „lässt sich auch nach dem Entzug der letzten
Rolle noch setzen" und „über die Mandantengrenze hinweg nicht".

```
Funktion umbenannt (= nicht vorhanden):   Tests  5 failed | 1 passed (6)
zurückbenannt:                            Tests  6 passed (6)
```

**Nebenbeobachtung, gemessen und nicht behoben.** Das
Mitgliedschaftsprädikat der `user`-Policy filtert
`user_organization_role.deleted_at` **nicht**:

```sql
EXISTS (SELECT 1 FROM user_organization_role r
         WHERE r.user_id = "user".id AND r.org_id = <org-GUC>)
```

Eine beendete Mitgliedschaft macht den Nutzer für die Organisation also weiter
sichtbar **und** änderbar. Für `SELECT` ist das vertretbar (die Organisation
muss die Namen früherer Akteure in ihren Audit-Einträgen auflösen können), für
`UPDATE` fragwürdig. Das ist eine eigene Entscheidung mit Folgen für die
Oberfläche und gehört nicht in diese Welle — sie steht in §12 als Weitergabe.
Die Kapsel hängt nicht daran: wird das Prädikat verschärft, bleibt sie richtig.

---

## 7. OP-086 — `includeDescendants`: der Befund trifft nicht mehr zu, die Änderung bleibt richtig

**Befund.** WP2/S01-26: die rekursive CTE über `organization` in
`api/v1/audit-log/route.ts:48-60` liefert unter RLS genau eine ID, weil die
`organization`-Policy bewusst nur die eigene Zeile zeigt. Der Parameter nimmt
eine 403 vor, verlangt eine Rollenprüfung und ändert danach nichts.

**Reproduktion — der Befund reproduziert nicht.** Drei Organisationen
(Konzern → Tochter → Enkel), Kontext = Konzern, Rolle `grc_app`:

```
ALT: rekursive CTE über organization  →  3
NEU: app_current_org_scope()          →  3
```

Ursache: Migration **0440** (E2E-Triage C-04, für den Organisationswechsler)
hat eine zweite, permissive SELECT-Policy `organization_membership_select`
ergänzt, deren zweite Disjunktion `id IN (SELECT app_current_org_scope())`
lautet. Die CTE funktioniert seither **zufällig**.

**Warum die Änderung trotzdem gemacht wurde.** Die Route hängt damit an einer
Policy, die aus einem ganz anderen Grund existiert. Gemessen, indem
`organization_membership_select` auf ihre Mitgliedschaftshälfte reduziert
wurde — also auf den Stand vor 0440:

```
ALT: rekursive CTE                    →  1
NEU: app_current_org_scope()          →  3
```

Wer die Policy des Organisationswechslers künftig verschärft, bricht damit
lautlos die Nachfahren-Sicht des Audit-Logs. Zwei Wahrheiten über dieselbe
Menge, berechnet an zwei Stellen.

**Änderung.** Die CTE ist durch
`SELECT id FROM public.app_current_org_scope() AS id` ersetzt — genau die
Menge, die auch die SELECT-Policy von `audit_log` auswertet (0396). Route und
Datenbank rechnen nicht mehr zwei Wahrheiten aus. Der ungenutzte
`organization`-Import ist entfernt.

**Gegenprobe.** Neuer Test
`packages/db/tests/rls/audit-log-descendant-scope.test.ts`, 4 Fälle — er misst
die **Wirkung**, nicht die Schreibweise: ein Elternteil sieht die Audit-Zeilen
von Tochter und Enkel, eine Tochter sieht ihre Mutter **nicht**, ein
unverwandter Mandant bleibt in beide Richtungen unsichtbar. Der bestehende
`audit-log-list-rbac.test.ts` (3 Fälle, Rollenprüfung für `includeDescendants`)
bleibt grün.

---

## 8. OP-096 — SAML: Ablauf und Kette des IdP-Zertifikats

**Befund.** WP3 §5.3: „Die Signaturprüfung ist jetzt korrekt, prüft aber weder
Ablauf noch Kette des konfigurierten IdP-Zertifikats — ein abgelaufenes
Zertifikat verifiziert weiterhin."

**Reproduktion.** `verifySamlResponse` (`packages/auth/src/saml/response-validator.ts:199`)
tat mit dem Zertifikat genau eines:

```ts
try {
  new X509Certificate(pem); // Struktur — sonst nichts
} catch { … }
```

`validFrom`/`validTo` wurden nie gelesen. Ein Zertifikat, das vor drei Jahren
abgelaufen ist, parst einwandfrei; die Anmeldung lief unbegrenzt weiter. In
einem GRC-Produkt ist das der teure Fall: die Rotationsfrist steht in jeder
Kundenrichtlinie, und niemand hätte bemerkt, dass sie folgenlos ist.

**Zur Kette — bewusst nicht geprüft, und das ist keine Restlücke.**
`sso_config.saml_certificate` ist ein **gepinnter Vertrauensanker**, kein Blatt
einer Kette. Der Betreiber trägt genau das eine Zertifikat ein, mit dem dieser
IdP signieren darf; deshalb ignoriert der Verifizierer auch das in `<KeyInfo>`
mitgelieferte (S02-23). Eine Kettenprüfung braucht einen Wurzelspeicher, und
mit ihm wäre **jedes** von einer öffentlichen CA signierte Zertifikat
akzeptabel — das wäre schwächer als das Pinning, nicht stärker. IdP-Zertifikate
sind überdies in der Praxis selbstsigniert (Entra ID, Okta, Keycloak liefern
selbstsignierte Signierzertifikate aus); eine Kette existiert dort nicht.
**Der Befund ist an dieser Stelle falsch eingeschätzt, und der Code gewinnt.**

**Änderung.** Geprüft wird stattdessen, was beim Pinning tatsächlich
schiefgehen kann:

- `inspectIdpCertificate(pem, now)` — liest Betreff, Aussteller,
  Gültigkeitsfenster, `daysUntilExpiry`, `expired`, `notYetValid`,
  `expiresSoon` (30-Tage-Vorwarnfenster), `selfSigned`, `certificateCount`.
- `assertIdpCertificateUsable(pem, now)` — fail-closed: wirft bei Ablauf, bei
  Vorlauf und bei RSA-Schlüsseln unter 2048 Bit. Die Meldung nennt das Datum
  und das zu ändernde Feld; eine Anmeldung, die ohne Grund scheitert, ist im
  Ticketverlauf teurer als der Ausfall selbst.
- `verifySamlResponse` ruft sie auf. Der neue Parameter `opts.now` macht die
  Uhr injizierbar.
- `GET /api/v1/admin/sso` gibt den Zertifikatsstatus zurück. Damit ist die
  Rotation ein geplanter Vorgang statt der Tag, an dem sich niemand mehr
  anmelden kann. Bewusst **nicht** im öffentlichen
  `GET /api/v1/auth/sso/config` (Login-Seite).

**Warum die Uhr und kein abgelaufenes Fixture.** Ein eingechecktes abgelaufenes
Zertifikat prüfte genau einmal das Richtige; sein „gültiges" Gegenstück läuft
irgendwann ebenfalls ab, der Test wird rot, und der nächste Leser verlängert das
Zertifikat statt den Befund zu verstehen. (Ein erster Entwurf erzeugte die
Zertifikate im Test mit `openssl req -not_before/-not_after` — die Flags gibt es
erst ab OpenSSL 3.5, die Umgebung hat 3.0.13.)

**Gegenprobe.** Neuer Test `packages/auth/tests/saml-certificate-validity.test.ts`,
7 Fälle. Die Reproduktion signiert eine Response **echt** und prüft beides: zum
Zeitpunkt der Gültigkeit verifiziert sie, nach Ablauf nicht.

```
alter Stand wiederhergestellt (nur `new X509Certificate(pem)`):
    × REPRODUKTION: korrekt signierte Response, Zertifikat abgelaufen -> abgelehnt
    × Zertifikat noch nicht gueltig -> abgelehnt
    × die Meldung nennt das Ablaufdatum
    Tests  3 failed | 4 passed (7)
zurückgenommen:                              Tests  7 passed (7)
```

---

## 9. OP-099 — die erste Rollenzeile ohne `ORDER BY`

**Befund.** `…/comments/[commentId]/resolve/route.ts:19-36` nimmt die erste
Rollenzeile ohne `ORDER BY`; ein Nutzer mit `viewer` **und** `admin` bekommt je
nach Heap-Reihenfolge eine 403.

**Reproduktion — der Befund stimmt, das Beispiel nicht.** Der Ausführungsplan
ist heute ein Index-Only-Scan über `uor_user_org_role_active_uniq
(user_id, org_id, role)`. `role` ist ein Enum, und der B-Baum sortiert nach der
**Deklarationsreihenfolge**, nicht alphabetisch:

```
enumsortorder | enumlabel
            1 | admin
            4 | auditor
            6 | process_owner
            7 | viewer
```

`admin` steht an Position 1 — der Fall `viewer` + `admin` geht heute also gut
aus. Der Defekt trifft jede Kombination, in der die _schwächere_ Rolle vorn
steht. Gemessen mit `process_owner` + `auditor`:

```
$ SELECT role FROM user_organization_role
   WHERE user_id=… AND org_id=… AND deleted_at IS NULL LIMIT 1;
 auditor            ← die Route liest genau diese Zeile → 403
```

Der Nutzer hält `process_owner`, die Route verweigert. Und weil der Plan von
der Statistik abhängt, ist auch der `admin`-Fall nicht garantiert — bei einem
Seq Scan entscheidet die Heap-Reihenfolge.

**Der zweite Fundort.** Dieselbe Einzelabfrage steht in
`…/processes/[id]/status/route.ts:74` und entscheidet dort über den
**Statuswechsel**: `const role = userRole?.role ?? "viewer"` geht in
`validateStatusTransition`. Ein Nutzer mit `process_owner` und `auditor` wird
als `auditor` bewertet.

(Zwei weitere Treffer desselben Musters sind **kein** Defekt:
`…/comments/[commentId]/route.ts:19` und `admin/roles/[id]/route.ts:19` filtern
explizit auf den gesuchten Rollenwert — das ist eine Existenzprüfung.)

**Änderung.**

- `resolve/route.ts`: `withAuth("admin", "process_owner")`. `requireRole` prüft
  gegen **alle** Rollen des Nutzers in der Organisation (`roles.some`), liest sie
  frisch aus der Datenbank und ist die Stelle, an der jede andere Route dieselbe
  Frage stellt. Damit verschwindet zugleich der zweite Mangel der Einzelabfrage:
  sie lief **vor** dem zentralen Rollenboden und konnte nicht von den
  Custom-Rollen (S02-02) profitieren.
- `status/route.ts`: eine Mitgliedschaft ist keine Rangfolge — der Nutzer hat
  alle seine Rollen gleichzeitig. Der Übergang ist erlaubt, sobald **irgendeine**
  davon ihn erlaubt (`ctx.roles`, dieselbe Quelle, gegen die `withAuth` schon
  geprüft hat).

---

## 10. OP-139 + OP-052 — die drei Auth.js-Tabellen und der Drift-Endpunkt

**OP-052, Befund.** „`f-17-schema-drift`: vier fehlende Tabellen (`account`,
`session`, `verification_token`, `audit_anchor_seal`), Drift-Endpunkt antwortet
503."

**Reproduktion — trifft nicht mehr zu.** Gegen eine von Null migrierte
Datenbank (424 Migrationen, 613 Tabellen):

```
$ DATABASE_URL=…/welle1a_fresh npx tsx tests/schema-drift-report.ts --fail-on-drift
Drizzle tables: 591   DB tables: 605
missing tables: 0
extra tables  : 14 (informational)
column drift  : 0 (thereof 0 only-in-DB columns)
RLS drift     : 0
duplicate defs: 0
EXIT=0
```

`healthy: true`, der Endpunkt antwortet 200. `audit_anchor_seal` existiert seit
Migration `0403`; die drei Auth.js-Tabellen seit jeher.

Woher die vier Meldungen kamen, ist ebenfalls messbar. Dieselbe Prüfung gegen
die Container-Datenbank `grc_platform`:

```
Drizzle tables: 591   DB tables: 528
missing tables: 65
column drift  : 169
RLS drift     : 3   (access_log, audit_anchor, audit_log)
```

Das ist O-10 aus `VERIFIKATION.md` („`grc_platform` im Container ist nicht auf
Branch-Stand"). Die E2E-Triage hat gegen einen älteren Stand derselben Datenbank
gemessen. **OP-052 ist auf Branch-Stand gegenstandslos**; was bleibt, ist die
Toleranz `≤ 5` im E2E-Spec — siehe §12.

**OP-139, Entscheidung: dokumentieren statt entfernen.** Das Register lässt
beides zu. Geprüft und verworfen wurde das Entfernen:

- Ein `DROP TABLE` wäre nach ADR-023 `Breaking: yes` und verlangte einen
  Vorab-Backup-Schritt — für drei **leere** Tabellen, deren Sperre nichts kostet.
- Die Deklaration **ist** der Vertrag mit Auth.js. Wird später auf den
  DB-Adapter umgestellt, lässt der Adapter die Tabellen sonst neu entstehen —
  ohne RLS, ohne Policy, ohne dass jemand hinsieht. Genau das verhindert der
  heutige Zustand: der Adapter schlägt sofort und laut fehl
  (`permission denied`).
- Der Grund, aus dem OP-139 überhaupt aufgeschrieben wurde, war nicht das
  Vorhandensein der Tabellen, sondern dass ihr Zustand **nur in einem
  Migrationskommentar behauptet** war. Zwei Restdefekt-Berichte mussten sie als
  Sonderfall von Hand ausnehmen.

**Änderung.** Aus der Behauptung wird eine Prüfung, in beide Richtungen:
`packages/db/tests/rls/authjs-adapter-tables.test.ts` misst RLS, `FORCE`,
Policy-Anzahl (`0`), Rechte von `grc_app` (keine) und Zeilenzahl (`0`) — und
durchsucht mit `git grep` den Quellbaum nach Referenzen. Der Schema-Kommentar in
`packages/db/src/schema/platform.ts` trägt die Entscheidung und ihre Begründung.

Ein Treffer der Quellsuche ist ausgenommen und begründet:
`apps/worker/tests/helpers/db-exports.ts` ist eine automatisch erzeugte
Namensliste **aller** `@grc/db`-Exporte und erfüllt nur vitests
Mock-Export-Prüfung.

**Gegenprobe.**

| Probe                                    | Ergebnis              |
| ---------------------------------------- | --------------------- |
| `CREATE POLICY op139_probe ON session …` | ✗ 1 failed / 3 passed |
| `GRANT SELECT ON account TO grc_app`     | ✗ 1 failed / 3 passed |
| beides zurückgenommen                    | ✓ 4 passed            |

---

## 11. OP-142 — `0394` als Einmal-Scan: der wiederkehrende Scan existiert, sein Workflow nicht

**Befund im Register.** „`0394` ist ein Einmal-Scan — eine spätere
FOR-ALL-Migration mit `org_id IS NULL` brächte S01-07 lautlos zurück.
Dauerschutz ist heute allein der RLS-Systemtest."

**Reproduktion — die zweite Hälfte des Befunds stimmt nicht.**
`scripts/audit-rls-coverage.mjs` erkennt die Form seit WP2:

```js
if (writeCmd && expr.includes("org_id IS NULL"))
  slot.defects.push(`${p.policyname}: org_id IS NULL writable (S01-07)`);
```

Gemessen, indem die Regression künstlich angelegt wurde:

```
$ psql -c "CREATE POLICY op142_regression ON regulatory_source FOR ALL
             USING (org_id IS NULL OR org_id = <org-GUC>)"
$ node scripts/audit-rls-coverage.mjs
→ … 615 Objekte, 1 Lücke(n).
    WEAK_POLICY regulatory_source
$ grep ^regulatory_source, docs/security/rls-coverage-report.csv
regulatory_source,TENANT,true,true,9,true,WEAK_POLICY,"op142_regression: org_id IS NULL writable (S01-07)"
$ psql -c "DROP POLICY op142_regression ON regulatory_source"
→ … 615 Objekte, 0 Lücke(n).
```

Der Schritt „RLS coverage — zero gaps against the freshly migrated DB" in
`ci.yml:279` wertet `status != OK && != PLATFORM_EXEMPT` aus und fängt
`WEAK_POLICY` mit. **Der wiederkehrende Scan existiert.**

**Was tatsächlich offen war: der Workflow, der ihn tragen soll, kann nicht
laufen.** `.github/workflows/schema-drift.yml`, Job `static-schema-audit`:

- er rief `node scripts/audit-rls-coverage.mjs` **ohne vorheriges `npm ci``**.
Gemessen in einem Verzeichnis ohne `node_modules`:
`Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'postgres'`;
- er hatte **keinen `services:`-Block**. Das Skript fällt ohne `DATABASE_URL`
  auf `localhost:5432/grc_platform` zurück. Gemessen gegen einen toten Port:
  `Error: connect ECONNREFUSED`;
- selbst mit beidem hätte er die Rolle `grc_app` gebraucht — das Skript fragt
  `has_table_privilege('grc_app', …)`.

Der Folgeschritt „Fail if RLS_MISSING count increased" las danach die
**eingecheckte** CSV — also einen Stand, den dieser Lauf nie gemessen hatte —
und verglich ihn mit der Baseline `1`, während dort seit WP2 eine `0` steht. Und
er zählte nur `RLS_MISSING`, also „Tabelle ohne RLS": eine von sechs
Befundarten, und ausgerechnet **nicht** die, die S01-07 zurückbrächte — eine
FOR-ALL-Policy mit `org_id IS NULL` lässt RLS eingeschaltet und eine Policy
stehen.

**Entscheidung und Änderung.** Die beiden Jobs des Workflows sind zu einem
zusammengelegt (`schema-and-rls`): die RLS-Abdeckung braucht genau dieselbe
Vorbereitung wie der Schemavergleich — Abhängigkeiten, leere Datenbank,
vollständige Migrationssequenz —, und getrennt hätte der RLS-Teil sie ein zweites
Mal aufbauen müssen. Der Job führt jetzt aus: `npm ci` → Extensions →
`migrate-all` → `schema-drift-report --fail-on-drift` →
`provision-grc-app.sh` → `audit-rls-coverage.mjs` → Torschritt.

Der Torschritt zählt **jeden** Status außer `OK` und `PLATFORM_EXEMPT` und gibt
bei Bruch die Defekttexte aus, damit die Fehlermeldung sagt, was zu tun ist.
Die Gegenprobe steht im Kommentar über dem Schritt.

**Nachweis der ganzen Kette lokal**, gegen eine von Null migrierte Datenbank:

```
migrate-all                    → 613 tables, 424/424 migrations applied
schema-drift-report --fail…    → 0 missing, 0 column drift, 0 RLS drift, EXIT=0
provision-grc-app.sh           → grc_app + grc_worker bereit
audit-rls-coverage.mjs         → 615 Objekte, 0 Lücke(n)
Torschritt (awk über die CSV)  → RLS-Luecken: 0
```

---

## 12. Nicht eingeplant, vorgelegt: OP-095 und OP-097

### OP-095 — Migration 0411 einspielen (Betreiberschritt)

**Sachlage.** Plattform-Adminrechte sind bewusst nur am DB-Prompt vergebbar.
`platform_admin` (Migration `0411`) hat für die Laufzeitrolle `grc_app`
**keine** INSERT/UPDATE/DELETE-Policy — die Anwendung kann die Frage stellen,
aber die Antwort nie vergeben. `isPlatformAdmin` schlägt fail-closed aus: fehlt
die Migration, antwortet **jeder** Schreibzugriff auf die globalen Tabellen
(`feature_gate`, `subscription_plan`, `plugin`, `data_region`,
`framework_mapping`) mit 403 — korrekt, aber als Betriebsereignis unsichtbar.

**Was der Eigentümer tun muss.**

1. Prüfen, ob 0411 und 0412 eingespielt sind:

   ```sql
   SELECT filename, status FROM _arctos_migrations
    WHERE filename LIKE '0411%' OR filename LIKE '0412%';
   SELECT to_regclass('public.platform_admin'),
          to_regprocedure('public.auth_is_platform_admin(uuid)');
   ```

   Beide Zeilen `applied`, beide `to_reg*` nicht NULL → nichts zu tun.
   Sonst: `cd packages/db && DATABASE_URL=… npx tsx src/migrate-all.ts`.

2. Den ersten Plattform-Administrator vergeben — **am DB-Prompt, als
   Superuser**, nicht über die Anwendung:

   ```sql
   INSERT INTO platform_admin (user_id, reason)
   SELECT id, 'Inbetriebnahme <Datum>, freigegeben von <Name>'
     FROM "user" WHERE email = 'admin@ihre-domain.de';
   ```

3. Gegenprobe aus der Anwendung: ein Schreibzugriff auf eine der fünf globalen
   Tabellen (z. B. `PUT /api/v1/admin/feature-gates/:id`) muss danach 200 statt
   403 liefern.

**Wann.** Vor der ersten Konfiguration plattformweiter Einstellungen, also im
Rahmen der Inbetriebnahme. Kein Zeitkriterium — nur eine Handlung, die kein
Automatismus ersetzen darf.

### OP-097 — Rotationsfenster für `dd_session.access_token` und `user.ical_token`

**Sachlage.** Beide Klartextspalten leben neben ihren Hash-Spalten weiter, damit
ausgegebene Links nicht brechen. Der Nachweis, dass sie existieren:

```
$ psql -d welle1a_fresh -c "SELECT table_name||'.'||column_name FROM information_schema.columns
    WHERE (table_name='user' AND column_name IN ('ical_token','ical_token_hash'))
       OR (table_name='dd_session' AND column_name IN ('access_token','access_token_hash'))"
 dd_session.access_token
 dd_session.access_token_hash
 user.ical_token
 user.ical_token_hash
```

**Korrektur an der Einschätzung des Registers.** Das Register nennt als Kriterium
„ausgegebene Links müssen ablaufen, bevor `DROP COLUMN` folgen darf". Das ist
richtig, aber unvollständig: **die Anwendung schreibt den Klartext weiter.**
`api/v1/calendar/ical/generate-token/route.ts:26` setzt bei **jedem** neu
ausgestellten Token `icalToken: token` neben `icalTokenHash`; dasselbe Muster in
`api/v1/vendors/[id]/dd/invite/route.ts:86`. Ein Rotationsfenster, in dem
weiterhin Klartext entsteht, läuft nie ab.

**Was der Eigentümer tun muss — drei Schritte, in dieser Reihenfolge:**

1. **Schreiben einstellen.** Die beiden Zuweisungen entfernen (nicht die
   Hash-Zuweisung). Ab hier entsteht kein neuer Klartext. Die Auflösung läuft
   schon heute ausschließlich über den Hash
   (`auth_resolve_ical_token`, `auth_resolve_dd_session_token`, Migration 0412),
   der Schritt ist also für sich genommen funktionsneutral.
2. **Fenster ablaufen lassen.** Erst ab Schritt 1 beginnt es. Seine Länge ist
   eine Entscheidung des Eigentümers und sollte an der längsten in Umlauf
   befindlichen Einladung ausgerichtet sein — für die DD-Portale typischerweise
   die Bearbeitungsfrist, für iCal-Feeds die Kalender-Abonnementdauer. Messbar:

   ```sql
   SELECT count(*) FILTER (WHERE ical_token IS NOT NULL) AS klartext_offen,
          min(ical_token_created_at)                     AS aeltester
     FROM "user";
   ```

   Ist `klartext_offen` gesunken, weil die Betroffenen ihr Token neu ausgestellt
   haben, kann Schritt 3 früher folgen.

3. **`DROP COLUMN`** in einer Migration mit `Breaking: yes` und
   `deploy/db-backup.sh --pre-breaking` davor. **Die Nummern `0458` und `0459`
   sind dafür reserviert und in dieser Welle bewusst frei gelassen** (0455–0457
   sind vergeben).

**Wann.** Frühestens nach Ablauf des in Schritt 2 gewählten Fensters. Schritt 1
kann sofort erfolgen und sollte es auch — er ist die einzige Handlung, die das
Fenster überhaupt beginnen lässt.

---

## 13. Abnahme

Alle Kommandos aus `/work/repo` ausgeführt. Datenbanken: `welle1a_verify`
(schrittweise gewachsen, für die Gegenproben) und `welle1a_fresh` (von Null
migriert, für die Abnahme).

| Kommando                                                                               | Ergebnis                                                                 |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `npx tsx packages/db/src/migrate-all.ts` (leere DB)                                    | ✓ 613 Tabellen, **424/424** Migrationen, kein Fehlschlag                 |
| `npx tsx packages/db/tests/schema-drift-report.ts --fail-on-drift`                     | ✓ 0 fehlende Tabellen, 0 Spalten-Drift, 0 RLS-Drift, EXIT=0              |
| `bash deploy/provision-grc-app.sh welle1a_fresh`                                       | ✓ `grc_app` + `grc_worker` (BYPASSRLS, NOSUPERUSER)                      |
| `node scripts/audit-rls-coverage.mjs` (gegen welle1a_fresh)                            | ✓ 615 Objekte, **0 Lücken**                                              |
| `npx vitest run --config vitest.rls.config.ts` (packages/db, APP_DATABASE_URL=grc_app) | ✓ **15 Dateien, 165 Tests** (vorher 11/142; +4 Dateien, +23 Tests)       |
| `npx vitest run` (packages/auth)                                                       | ✓ **14 Dateien, 232 Tests** (+1 Datei, +7 Tests)                         |
| `npx vitest run src/__tests__/api/audit-log-list-rbac.test.ts` (apps/web)              | ✓ 3 Tests                                                                |
| `node scripts/check-route-rls-context.mjs`                                             | ✓ 0 Einträge in der Baseline, 0 neu (**vorher EXIT=1**)                  |
| `node scripts/check-compose-db-roles.mjs`                                              | ✓ web=grc_app, worker=grc_worker, ops-metrics=grc_worker (beide Dateien) |
| `node scripts/check-gate-inputs.mjs`                                                   | ✓ 7 Tor-Eingaben vorhanden, verfolgt, nicht ignoriert                    |
| `node scripts/lint-ratchet.mjs`                                                        | ✓ **306 / Baseline 306** — keine Regression                              |
| `npx prettier --check` (alle in diesem Strang berührten Dateien)                       | ✓                                                                        |
| `npx tsc --noEmit -p packages/auth/tsconfig.json`                                      | ✓ fehlerfrei                                                             |
| `npx tsc --noEmit -p packages/db/tsconfig.json`                                        | ✓ fehlerfrei                                                             |
| `npx tsc --noEmit -p apps/web/tsconfig.json`                                           | 10 Fehler, **keiner in einer Datei dieses Strangs** — siehe Hinweis      |

**Hinweis zum `apps/web`-Typecheck.** Der Lauf dauert in dieser Umgebung rund
zwanzig Minuten und meldet 10 Fehler. Alle zehn stammen aus parallel laufender
Arbeit anderer Stränge im selben Arbeitsbaum:

| Ort                                       | Anzahl | Strang                                    |
| ----------------------------------------- | -----: | ----------------------------------------- |
| `app/(dashboard)/risks/kris/page.tsx`     |      2 | 1c (`Cannot find name 'json'`)            |
| `packages/bpmn/src/editor/**` (7 Dateien) |      8 | Welle 2 (`ElementRegistryLike`-Zuweisung) |

Gefiltert nach den 22 in diesem Strang geänderten Dateien: **null Fehler.**
Ein Zwischenstand hatte einen eigenen gemeldet
(`api/v1/processes/[id]/status/route.ts`, `{ valid: boolean; error?: string }`
statt eines Objektliterals mit `undefined`-Feld); er ist behoben.

### Neue Migrationen

| Datei                                          | Zweck                                                               | Punkt  |
| ---------------------------------------------- | ------------------------------------------------------------------- | ------ |
| `0455_auth_user_lookup_secdef.sql`             | drei SECURITY-DEFINER-Kapseln für den kontextlosen Anmeldepfad      | OP-083 |
| `0456_user_policy_drop_contextless.sql`        | kontextlose Disjunktion aus `user_tenant_select`/`_update` entfernt | OP-083 |
| `0457_session_invalidation_on_role_change.sql` | `user.sessions_valid_from` + `auth_invalidate_user_sessions()`      | OP-085 |

Alle drei tragen den ADR-023-Metadatenkopf, sind idempotent und prüfen ihren
eigenen Endzustand mit `RAISE EXCEPTION`. Von den reservierten Nummern
**0455–0464** sind 0455–0457 vergeben; **0458/0459 sind für OP-097 Schritt 3
reserviert** (siehe §12), 0460–0464 bleiben frei.

### Neue Tests

| Datei                                                      | Fälle | Punkt  |
| ---------------------------------------------------------- | ----: | ------ |
| `packages/db/tests/rls/user-table-contextless.test.ts`     |     9 | OP-083 |
| `packages/db/tests/rls/session-invalidation.test.ts`       |     6 | OP-085 |
| `packages/db/tests/rls/audit-log-descendant-scope.test.ts` |     4 | OP-086 |
| `packages/db/tests/rls/authjs-adapter-tables.test.ts`      |     4 | OP-139 |
| `packages/auth/tests/saml-certificate-validity.test.ts`    |     7 | OP-096 |

Jeder dieser Tests wurde künstlich gebrochen, rot gesehen und zurückgenommen —
die Ergebnisse stehen jeweils im zugehörigen Abschnitt.

### Dateihoheit

Berührt wurden: `docker-compose.production.yml` (nicht geändert, nur geprüft),
`deploy/docker-compose.yml`, `.github/workflows/{ci,schema-drift}.yml`,
`packages/auth/src/{providers,config,types,saml/index,saml/response-validator}.ts`,
`packages/auth/tests/`, `apps/web/src/auth.ts`,
`apps/web/src/app/api/v1/**` (10 Dateien), `apps/web/src/lib/session-invalidation.ts`
(neu), `packages/db/drizzle/` (3 neu), `packages/db/src/schema/platform.ts`,
`packages/db/tests/rls/` (4 neu).

**Außerhalb der zugewiesenen Hoheit, unvermeidbar:** drei Dateien unter
`scripts/` — `check-route-rls-context.mjs` (der Wächter von OP-084),
`check-compose-db-roles.mjs` (neu, der Wächter von OP-090/091) und
`check-gate-inputs.mjs` (zwei Zeilen Registrierung). `scripts/` steht weder auf
der Zuweisungs- noch auf der Verbotsliste; die Punkte sind ohne ihre Wächter
nicht lösbar. Beim Zusammenführen sind genau diese drei auf Konflikte zu prüfen.

**Nicht angefasst:** `apps/web/src/middleware.ts`, `apps/web/src/lib/api.ts`,
`packages/auth/src/rbac.ts` (alle drei sind parallel in Arbeit),
`apps/web/src/components/**`, `apps/web/src/app/(dashboard)/**`,
`packages/{bpmn,reporting,shared}/**`, `apps/worker/src/crons/**`,
`packages/db/src/seed-all.ts`, `tests/e2e/**`.

---

## 14. Was an die folgenden Wellen weitergeht

**An Welle 1b (Datenpfade und Integrität)**

1. **OP-052, Restposten.** `tests/e2e/regression/f-17-schema-drift.spec.ts:30`
   toleriert `missingInDb ≤ 5`. Gegen Branch-Stand ist der Wert **0** und der
   Endpunkt antwortet 200. Eine Toleranz von 5 auf einer gemessenen 0 macht
   den Test blind für genau die Klasse, für die er existiert — er würde vier
   fehlende Tabellen grün melden. Die Datei liegt in `tests/e2e/**` und damit
   außerhalb der Hoheit dieses Strangs. Empfehlung: `toBe(0)` plus `status`
   auf 200, mit einem Kommentar, der auf die Container-DB-Verwechslung (O-10)
   verweist.
2. **Der neue Torschritt in `schema-drift.yml`** baut die Datenbank selbst auf
   und provisioniert `grc_app`/`grc_worker`. Wer dort weitere Prüfungen
   ergänzt, hat beides bereits.

**An Welle 1c (Oberfläche)**

3. **`GET /api/v1/admin/sso` liefert jetzt ein zusätzliches Feld `certificate`**
   (`{ subject, issuer, selfSigned, validFrom, validTo, daysUntilExpiry,
expired, notYetValid, expiresSoon, certificateCount }` oder `null` bei reinem
   OIDC-Betrieb, oder `{ error }` bei unlesbarem Feld). Die SSO-Einstellungsseite
   sollte `expiresSoon` und `expired` sichtbar machen — das ist der ganze Zweck
   von OP-096, und ohne die Anzeige bleibt die Rotation eine Überraschung.
4. **`…/processes/[id]/comments/[commentId]/resolve` antwortet bei fehlender
   Berechtigung jetzt `application/problem+json`** (zentraler Rollenboden) statt
   `{ error: "Only admin or process_owner …" }`. Wer die Meldung im Frontend
   ausliest, muss auf `detail` umstellen.
5. **`app/(dashboard)/risks/kris/page.tsx`** hat im `tsc`-Lauf dieser Welle zwei
   Fehler geworfen (`Cannot find name 'json'`, `Parameter 'k' implicitly any`).
   Die Datei gehört 1c; hier nur als Beobachtung, nicht angefasst.

**An Welle 4 (Test- und Codequalität)**

6. **Das Mitgliedschaftsprädikat der `user`-Policy filtert `deleted_at` nicht**
   (§6, Nebenbeobachtung). Eine beendete Mitgliedschaft macht den Nutzer für die
   Organisation weiter sichtbar **und** änderbar. Für `SELECT` vertretbar, für
   `UPDATE` fragwürdig. Eigene Entscheidung mit Folgen für die Oberfläche.
7. **`checkSsoEnforcement` in `packages/auth/src/providers.ts` liest `sso_config`
   kontextlos** und bekommt unter `grc_app` 0 Zeilen — die SSO-Erzwingung greift
   im Anmeldepfad also nicht. Nicht in diesem Strang behoben, weil sie nicht zu
   den elf Punkten gehört und einen eigenen Nachweis braucht (die Kapsel-Form
   aus 0455 wäre der naheliegende Weg). Der Befund ist neu und nicht im Register.
8. **`packages/auth/src/providers.ts:5` importiert `timingSafeEqual` ungenutzt**
   — Bestandsbefund, Teil der eingefrorenen 249 `no-unused-vars`.

**An den Eigentümer**

9. **OP-095** und **OP-097** — die vollständigen Handlungsanweisungen stehen in
   §12. OP-097 braucht zuerst eine Codeänderung (Klartext nicht mehr schreiben),
   sonst läuft das Rotationsfenster nie ab.

---

## Nachtrag aus der Abnahme (2026-09-02, nach Abschluss der drei Stränge)

Beim Verifizieren der Welle als Ganzes sind zwei Dinge aufgefallen, die sonst
als „erledigt" gegolten hätten, ohne es zu sein. Beide sind behoben; sie stehen
hier, weil sie zeigen, was eine Abnahme über die Stränge hinweg leistet, die
kein einzelner Strang leisten kann.

**(1) `packages/auth` wuchs um 299 Zeilen ohne Test.** Die
Zweigabdeckung fiel von 52,31 % auf 50,65 % und riss die Coverage-Ratsche. Der
untestete Teil war ausgerechnet `lookupUserByEmail` — die Kapsel, die
Migration 0455/0456 überhaupt möglich gemacht hat und die im Anmeldepfad
entscheidet, was aus einer Zeile wird, die nicht so aussieht wie erwartet.

12 Tests in `packages/auth/tests/login-user-lookup.test.ts`: beide
Ergebnisformen des Treibers, keine Zeile → `null`, und vor allem die
Abbildungen, bei denen ein `!!`-Vergleich ein Loch wäre. `is_active` als `"f"`
ist in JavaScript truthy — ein deaktiviertes Konto hätte als aktiv gegolten,
und `credentialsProvider` lässt genau darauf die Anmeldung zu. Dazu der
Nachweis, dass der SQL-Text unverändert bleibt und die Adresse als Wert und
nicht als Text in die Abfrage geht. Zweigabdeckung wieder **52,62 %**.

**(2) Zwei Aufrufstellen aus OP-050 lagen zwischen den Strängen.** Die Liste
`UEBERGABE_1C` im Wächter von Strang 1b nannte sie mit dem Zusatz „MUSS leer
werden": `process-controls-tab.tsx` und `process-review-config.tsx` fragten
`limit=200` von `paginate()`-Routen, bekamen 422 und zeigten das als leere
Liste — der eine als „diese Organisation hat keine Kontrollen" im
Auswahldialog, der andere als „es gibt niemanden, den man als Prüfer eintragen
könnte". Beide sind umgestellt und sagen im Fehlerfall, dass etwas
fehlgeschlagen ist; die Liste ist leer.

Beide Fälle sind derselbe Mechanismus: **eine Übergabe zwischen Strängen ist
erst erledigt, wenn jemand sie annimmt.** Dass die Wächter aus 1b sie
namentlich geführt haben, ist der Grund, aus dem sie beim Verifizieren
aufgefallen sind statt in einem Klon von jemand anderem.
