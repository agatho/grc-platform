# S12 — Frontend-Sicherheit und Next.js-Grenzen

**Audit-ID:** ARCTOS-FULL-2026-08-31
**Stream:** S12
**Prüfgegenstand:** `/work/repo` @ `a8d1414f`
**Scope:** `apps/web/src/app/**` (482 Pages), `packages/ui/**`, `apps/web/next.config.ts`, `apps/web/src/middleware.ts`, Server Actions, Caching, Server/Client-Grenze
**Stand:** laufend fortgeschrieben

---

## 1. Zusammenfassung

Der auftragsseitig als „größte blinde Stelle" markierte Bereich — **Next.js Server Actions — existiert in ARCTOS nicht**. Fünf voneinander unabhängige, reproduzierbare Suchen (Direktive, Dateikonvention, React-Hooks, `<form action>`, Lockfile) liefern jeweils **null Treffer**. Die gesamte Schreib-/Leseoberfläche läuft über die 1.357 Route Handler unter `apps/web/src/app/api/**` (Stream S02) sowie über 455 von 482 Pages, die als `"use client"`-Komponenten per `fetch()` gegen diese Routen gehen. Der klassische App-Router-Auditbefund „ungeschützte Server Action" ist hier gegenstandslos — das ist ein **positiver** Befund und wird als S12-01 (Info) mit voller Negativ-Evidenz protokolliert.

Ebenso **negativ** und damit entlastend: **kein einziges `dangerouslySetInnerHTML`** im gesamten Quellbaum, **keine** `innerHTML`/`outerHTML`/`insertAdjacentHTML`/`document.write`-Zuweisung, **keine Markdown-Rendering-Bibliothek** (kein `react-markdown`, `marked`, `markdown-it`, `remark`), **kein `eval`/`new Function`**. Die BPMN-Overlays in `bpmn-editor.tsx`/`bpmn-viewer.tsx` bauen ihre DOM-Knoten ausschließlich über `document.createElement` + `textContent` — nicht über HTML-Strings. Die im Auftrag vermutete XSS-Fläche über Markdown/Rich-Text/BPMN-Labels **besteht nicht**.

Ebenso entlastend beim Caching: **keine einzige** Verwendung von `unstable_cache`, `cache()`, `generateStaticParams`, `revalidatePath`, `revalidateTag`, `force-cache`, `cacheLife`/`cacheTag` oder `"use cache"`. `export const revalidate` kommt an keiner Stelle vor. Das Root-Layout setzt `export const dynamic = "force-dynamic"` und schaltet damit die gesamte Page-Hierarchie auf dynamisches Rendering. Ein mandantenübergreifender Cache-Leak über die Next-Cache-Schichten ist damit **ausgeschlossen** (S12-02, Info). Die einzige explizite `Cache-Control: public`-Antwort ist mandantenspezifisch geschlüsselt (S12-11, Low).

Die real gefundenen Defekte liegen woanders:

- **Die Middleware ist die einzige Autorisierungsschicht für UI-Pfade und sie ist an drei Stellen falsch parametriert.** Ihre Public-Path-Prüfung arbeitet mit `startsWith()` auf Präfixen, die über die gemeinte Route hinausreichen (`/api/v1/whistleblowing/intake` fängt auch `/api/v1/whistleblowing/intake-codes`). Ihre HinSchG-Isolationsprüfung liest Rollen aus dem **JWT**, während jeder API-Handler dieselben Rollen **frisch aus der DB** liest — die gesetzlich begründete Vertraulichkeitskontrolle arbeitet also bis zu 8 Stunden auf veraltetem Rollenstand.
- **Vier serverseitige Codepfade, die bewusst als „öffentlich" gebaut wurden, sind durch dieselbe Middleware vollständig blockiert** — darunter der Break-Glass-Admin-Login, die SSO-Discovery des Login-Formulars und beide SSO-Callbacks. Der Enterprise-SSO-Pfad ist damit im Auslieferungszustand nicht funktionsfähig.
- **Zwei serverseitige Pfade laufen ohne RLS-Kontext** (Trust Center als React Server Component, Branding-CSS-Route ohne `withAuth`) und liefern unter der produktiven `grc_app`-Rolle stillschweigend leere Ergebnisse, unter der Dev-/CI-Superuser-Rolle dagegen vollständige Daten. Dev und Prod verhalten sich unterschiedlich — die Testbarkeit des Verhaltens ist damit aufgehoben.
- **Ein Stored-XSS-Pfad** über `javascript:`-URIs in `programme_step_link.target_url` (Zod-Schema ohne `.url()`, direkt als `href` gerendert).
- **CSP existiert nur in der Reverse-Proxy-Konfiguration** und enthält `'unsafe-inline'` **und** `'unsafe-eval'` im `script-src`. Die Anwendung selbst setzt keinen einzigen Security-Header — jede Deployment-Variante ohne genau diesen Caddyfile läuft ohne CSP, HSTS und Frame-Schutz.
- **Der Produktionsbuild ist auf der spezifizierten Audit-Umgebung nicht durchführbar** (OOM bei 4 GB Heap-Limit, 2 vCPU / 8 GB RAM).

**Findings:** 2 High, 6 Medium, 10 Low, 4 Info (22 gesamt). Ein High (S12-14) liegt im gemeinsamen `withAuth`-Helper und ist als Dedup-Kandidat zu S02 markiert.

---

## 2. Methodik-Protokoll

Die sieben Punkte der S12-Methodik aus `AUDIT_PLAN.md` wurden vollständig abgearbeitet. Alle Suchbefehle sind gegen `/work/repo` @ `a8d1414f` reproduzierbar; `node_modules` ist in jeder Suche ausgeschlossen.

### M1 — Server/Client-Grenze

| Prüfung                                                      | Befehl / Fundstelle                                                                                                                   | Ergebnis                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_`-Inventar im Code                              | `grep -rn "NEXT_PUBLIC_[A-Z_]*" apps packages`                                                                                        | 6 Treffer, 4 Variablen: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_GIT_SHA`, `NEXT_PUBLIC_GIT_BRANCH`, `NEXT_PUBLIC_BUILD_TIME`                                                                                                                                                                                                                    |
| `NEXT_PUBLIC_` in `.env.example`                             | Zeilen 82, 190–192                                                                                                                    | identische 4 Variablen, keine weiteren                                                                                                                                                                                                                                                                                                      |
| Bewertung                                                    | —                                                                                                                                     | **Keine Secrets.** Alle vier sind Deploy-Metadaten bzw. die öffentliche App-URL. Kein API-Key, kein Token, kein DB-String mit `NEXT_PUBLIC_`-Präfix. Siehe S12-03 (Info).                                                                                                                                                                   |
| Server Components mit DB-Zugriff                             | `grep -rln "@grc/db" apps/web/src/app --include="*.tsx"`                                                                              | **genau 1 Datei**: `(portal)/trust/[orgCode]/page.tsx` → S12-05                                                                                                                                                                                                                                                                             |
| Serialisierung vollständiger DB-Objekte an Client Components | Der einzige RSC-DB-Pfad selektiert explizit 3 bzw. 5 Spalten (`page.tsx:36-42`, `:62-71`, `:75-79`) — kein `select()` ohne Projektion | **Kein Overfetching über die RSC-Grenze.**                                                                                                                                                                                                                                                                                                  |
| `passwordHash` in API-Antworten                              | `grep -rn "passwordHash" apps/web/src/app/api`                                                                                        | 2 Treffer, beide in `auth/admin-login/route.ts` (Z. 66, 76) als reine Vergleichsoperation, nie im Response-Body                                                                                                                                                                                                                             |
| Session-/JWT-Inhalt                                          | `packages/auth/src/config.ts:21-56`, `apps/web/src/auth.ts:79-141`                                                                    | JWT/Session tragen `userId`, `email`, `name`, `language`, `roles[]`, `currentOrgId`. Kein `passwordHash`, kein Token, keine internen Felder. `providers.ts:195-197` selektiert zwar die volle User-Zeile (`db.select().from(user)`), gibt aber nur 5 Felder zurück (`:264-270`: `id`, `email`, `name`, `language`, `roles`). **Kein Leak.** |
| Build-Chunk-Scan                                             | siehe S12-16                                                                                                                          | Build OOM-abgebrochen; statisch kompensiert                                                                                                                                                                                                                                                                                                 |

### M2 — Server Actions

Fünf unabhängige Nachweisverfahren, alle mit Null-Ergebnis:

```
grep -rn "use server" --include="*.ts" --include="*.tsx" --include="*.js" \
     --include="*.jsx" --include="*.mjs" apps packages | grep -v node_modules
→ 0

find apps packages -name "actions.ts" -o -name "actions.tsx" -o -name "*.actions.ts" \
  | grep -v node_modules
→ 0

grep -rn "useActionState\|useFormState\|next-safe-action" apps packages | grep -v node_modules
→ 0

grep -rn "<form" apps/web/src packages/ui/src | grep "action"
→ 0

grep -c "next-safe-action" package-lock.json
→ 0
```

Ergebnis-Inventar: `/work/audit/evidence/S12-server-actions.csv` (leer, mit protokollierter Negativ-Evidenz). Bewertung → S12-01.

### M3 — XSS

| Sink                                                                | Befehl                                                                                    | Treffer                                                                                                  |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `dangerouslySetInnerHTML`                                           | `grep -rn "dangerouslySetInnerHTML" apps packages`                                        | **0**                                                                                                    |
| `innerHTML` / `outerHTML` / `insertAdjacentHTML` / `document.write` | `grep -rn "\.innerHTML\|outerHTML\|insertAdjacentHTML\|document.write" apps packages`     | **0**                                                                                                    |
| `eval` / `new Function` / String-`setTimeout`                       | `grep -rn "eval(\|new Function\|setTimeout(\"" apps/web/src packages/ui/src`              | **0**                                                                                                    |
| Markdown-Renderer                                                   | `grep -rn "react-markdown\|marked\|markdown-it\|remark" apps packages`                    | **0** (auch keine Sanitizer: kein `dompurify`, kein `sanitize-html`)                                     |
| BPMN-Overlays                                                       | `bpmn-editor.tsx:296,338,378,417,457`, `bpmn-viewer.tsx:185,226`                          | alle `document.createElement` + `textContent`/`.title`/`.className`/`.style.width`; **kein HTML-String** |
| SVG-Upload → Inline-Auslieferung                                    | `organizations/[id]/branding/logo/route.ts:63-75`, `documents/[id]/download/route.ts:149` | **explizit gehärtet** (SVG-Reject bzw. `application/octet-stream`-Umschaltung) → S12-15 (Info, positiv)  |
| Dynamische `href`                                                   | `grep -rn "href={[a-zA-Z_]" apps/web/src packages/ui/src`                                 | 48 Treffer, einzeln geprüft → **1 ausnutzbar** (S12-06), 1 admin-beschränkt (S12-12)                     |
| `target="_blank"`                                                   | 11 Treffer                                                                                | **alle 11 mit `rel="noopener noreferrer"`** → kein Finding                                               |

### M4 — Security-Header

| Ort                          | Befund                                                                                                                                              |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/next.config.ts`    | **keine `async headers()`-Funktion**, kein Header irgendeiner Art                                                                                   |
| `apps/web/src/middleware.ts` | setzt ausschließlich `x-request-id` (Z. 98, 121, 130, 167, 172)                                                                                     |
| Route-Handler                | genau 2 Treffer für `X-Content-Type-Options` (`documents/[id]/download/route.ts:155`, `documents/[id]/files/[fileId]/download/route.ts:153`)        |
| `deploy/Caddyfile:31-39`     | vollständiger Header-Block: HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `X-XSS-Protection`, **CSP**, `Permissions-Policy` |
| Bewertung                    | Header existieren nur infrastrukturseitig → S12-04 (Medium, CSP-Qualität) und S12-08 (Medium, Header nur im Reverse Proxy)                          |

### M5 — Open Redirect / Link-Sicherheit

| Prüfung                              | Fundstelle                           | Ergebnis                                                                                                          |
| ------------------------------------ | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Middleware-Login-Redirect            | `middleware.ts:127-129`              | setzt `callbackUrl` auf den **eigenen `pathname`** — kein extern beeinflussbarer Wert. Sicher.                    |
| Login-Seite `callbackUrl`-Verwendung | `(auth)/login/page.tsx:20`, `:79`    | **ungeprüft** aus `searchParams` → `router.push()` → **S12-07 (Medium)**                                          |
| SSO-Redirect                         | `(auth)/login/page.tsx:89-93`        | Ziel-Pfad fix konstruiert, nur `orgId`/`callbackUrl` als Query — Weiterverarbeitung in blockierter Route (S12-09) |
| `window.open(<Variable>)`            | `(dashboard)/admin/sso/page.tsx:227` | `json.data.redirectUrl` aus API → **S12-12 (Low)**                                                                |
| `target="_blank"` ohne `rel`         | —                                    | **0 Treffer**                                                                                                     |

### M6 — Client-seitige Autorisierung

Alle client-seitigen Rollen-/Modul-Gates wurden gegen ihr serverseitiges Gegenstück geprüft:

| Client-Gate                                   | Datei:Zeile                                                                        | Serverseitiges Gegenstück                                                                             | Ergebnis                                        |
| --------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `ModuleGate` (`enabled`/`preview`/`disabled`) | `components/module/module-gate.tsx:23`                                             | `requireModule(moduleKey, ctx.orgId, req.method)` in den Route Handlern                               | **gedeckt**                                     |
| `canDelete = isAdmin \|\| isAuthor`           | `components/process/process-comments.tsx:300`                                      | `isAuthorOrAdmin()` in `processes/[id]/comments/[commentId]/route.ts:8-28`, DELETE-Prüfung Z. 160-168 | **gedeckt**                                     |
| `canResolve = isAdmin \|\| isProcessOwner`    | `components/process/process-comments.tsx:299`                                      | Rollenprüfung in `.../resolve/route.ts:19-36`                                                         | **gedeckt** (mit Nebenbefund S12-13)            |
| Sidebar-Item-Filter nach `session.user.roles` | `layout/sidebar.tsx:44-56`, `mobile-sidebar.tsx:24-44`, `modern-sidebar.tsx:31-43` | Zielseiten sind Client Components; alle Daten kommen aus `withAuth(...)`-geschützten Routen           | **gedeckt** (Navigation ist reine UX-Filterung) |
| `isAdmin`-Gate in `admin/modules`             | `(dashboard)/admin/modules/page.tsx:280-281`                                       | Schreibrouten unter `/api/v1/admin/**` mit `withAuth("admin")`                                        | **gedeckt**                                     |

**Kein Finding „nur versteckt statt verweigert".** Ein davon unabhängiger Defekt in der serverseitigen Kette wurde dabei aufgedeckt (`checkCustomRoleAccess`-Fallback) → S12-14, dedupliziert gegen S02.

### M7 — Caching

| Muster                                                                                                                                        | Befehl                                                                                                                                      | Treffer                                                                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `unstable_cache`, `cache()`, `generateStaticParams`, `revalidatePath`, `revalidateTag`, `force-cache`, `cacheLife`, `cacheTag`, `"use cache"` | `grep -rn "unstable_cache\|generateStaticParams\|revalidatePath\|revalidateTag\|force-cache\|cacheLife\|cacheTag\|use cache" apps packages` | **0**                                                                                                                                                                                                            |
| `export const revalidate`                                                                                                                     | `grep -rn "export const revalidate" apps/web/src`                                                                                           | **0**                                                                                                                                                                                                            |
| `export const dynamic`                                                                                                                        | 5 Treffer                                                                                                                                   | `app/layout.tsx:13` (`force-dynamic`, Root → gilt für alle 482 Pages), `api/health/route.ts:4`, `api/v1/health/route.ts:16`, `legal/imprint/page.tsx:14`, `legal/privacy/page.tsx:16` — **alle `force-dynamic`** |
| `Cache-Control`-Header in Route Handlern                                                                                                      | `api/v1/branding/css/[orgId]/route.ts:127`                                                                                                  | **1 Treffer**: `public, max-age=3600` → S12-11                                                                                                                                                                   |

Vollständige Caching-Analyse siehe Abschnitt 4.

---

## 3. Server-Actions-Inventar mit Bewertung

**Inventar: leer.** CSV: `/work/audit/evidence/S12-server-actions.csv`

| Datei | Zeile | Export | Auth | Org-Kontext | Rolle | Bewertung                           |
| ----- | ----- | ------ | ---- | ----------- | ----- | ----------------------------------- |
| —     | —     | —      | —    | —           | —     | _keine Server Action im Repository_ |

### Bewertung und Abgrenzung

ARCTOS nutzt das App-Router-Modell in einer Variante, die den Server-Action-Angriffsvektor konstruktiv ausschließt:

- **455 von 482 Pages** tragen `"use client"` und rufen ausschließlich `fetch()` gegen `/api/v1/**` auf.
- **27 Pages** sind Server Components. Davon greifen **26** auf keinerlei Datenquelle zu (Coming-Soon-Stubs, `ModuleGate`-Wrapper, ein `redirect()`); die 27. ist das Trust Center (S12-05).
- Es existiert **kein** `<form action={serverFn}>`, **kein** `useActionState`/`useFormState`, **kein** `next-safe-action`.

Damit gilt: **die vollständige Autorisierungsfläche der Anwendung liegt in den 1.357 Route Handlern (Stream S02) und in `apps/web/src/middleware.ts` (dieser Stream).** Es gibt keinen dritten, von der Middleware nicht erfassten RPC-Kanal.

**Nebenbefund (Härtung):** Das Paket `server-only` ist nicht in Gebrauch (`grep -rn "server-only" apps packages` → 1 Treffer, und der ist ein Kommentar in `packages/shared/src/index.ts:37`). Ein `import "server-only"` in `packages/db/src/index.ts` und `packages/auth/src/providers.ts` würde einen versehentlichen Import serverseitiger Module in eine Client Component zum **Buildfehler** statt zu einem stillen Bundle-Leak machen. Siehe S12-10.

---

## 4. Caching-Analyse

**Ergebnis: kein mandantenübergreifender Cache-Leak möglich.** Begründung, Fundstelle für Fundstelle:

### 4.1 Next.js Data Cache / Full Route Cache

Der Full Route Cache und die statische Generierung sind global deaktiviert:

`apps/web/src/app/layout.tsx:12-13`

```tsx
// All pages require authentication — skip static generation at build time
export const dynamic = "force-dynamic";
```

`force-dynamic` im **Root-Layout** vererbt sich auf jedes Segment darunter. Alle 482 Pages werden pro Request gerendert; keine Page landet im Full Route Cache, keine `generateStaticParams`-Vorproduktion existiert. Ein Cache-Eintrag, der Org A das Rendering-Ergebnis von Org B liefern könnte, kann damit nicht entstehen.

Der Data Cache ist ebenfalls unbenutzt: keine `fetch(..., { next: { revalidate } })`- und keine `{ cache: "force-cache" }`-Aufrufe; die Datenbeschaffung läuft ausschließlich über `drizzle-orm` (kein `fetch`, damit außerhalb des Next-Data-Caches) bzw. über Client-`fetch()` mit Default-`no-store`-Semantik in Next 16.

### 4.2 React `cache()` / `unstable_cache`

Null Verwendungen. Damit existiert auch keine der typischen Fehlkonfigurationen (Request-Memoization über Request-Grenzen hinweg, `unstable_cache` mit mandantenunabhängigem Key).

### 4.3 Expliziter HTTP-Cache-Header

Genau eine Fundstelle im gesamten Baum:

`apps/web/src/app/api/v1/branding/css/[orgId]/route.ts:124-129`

```ts
return new Response(css, {
  headers: {
    "Content-Type": "text/css",
    "Cache-Control": "public, max-age=3600",
  },
});
```

**Datenbezug:** Ja, mandantenbezogen — der Body enthält die Brand-Farben genau einer Organisation und trägt den `orgId` sogar wörtlich im generierten CSS-Kommentar (`:88`).
**Leak-Bewertung:** **Nein.** Der `orgId` ist Teil des **Pfades** (`/api/v1/branding/css/:orgId`) und damit Teil des Cache-Keys jedes konformen Caches. Zwei Organisationen können nicht auf denselben Key abbilden.
**Restrisiko:** `public` erlaubt Shared Caches, obwohl die Antwort hinter der Auth-Middleware liegt. Der Inhalt sind sechs Hex-Farbwerte; Vertraulichkeitsschaden praktisch null. → S12-11 (Low).

### 4.4 Session-/Auth-Caching

`SessionProvider refetchOnWindowFocus={false} refetchInterval={0}` (`layout.tsx:55`) unterbindet das periodische Nachladen der Session im Client. In Kombination mit S12-17 (JWT-Rollen ohne Ablauf-/Widerrufsprüfung) verlängert das die Wirksamkeit eines veralteten Client-Rollenstands bis zum nächsten harten Reload — allerdings ohne Sicherheitswirkung, weil jede API-Antwort serverseitig frisch autorisiert wird (`apps/web/src/auth.ts:110-113`).

---

## 5. Findings

---

### S12-01 — Keine Server Actions vorhanden; gesamte RPC-Fläche liegt in Route Handlern

**Severity:** Info (positiv)
**Datei:** repository-weit

**Evidenz.** Fünf unabhängige Suchen, alle mit Null-Ergebnis (vollständige Befehle in Abschnitt M2, Ergebnisdatei `/work/audit/evidence/S12-server-actions.csv`):

```
grep -rn "use server" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.mjs" apps packages | grep -v node_modules   →  0
find apps packages -name "actions.ts" -o -name "actions.tsx" -o -name "*.actions.ts" | grep -v node_modules                                        →  0
grep -rn "useActionState\|useFormState\|next-safe-action" apps packages | grep -v node_modules                                                     →  0
grep -rn "<form" apps/web/src packages/ui/src | grep "action"                                                                                     →  0
grep -c "next-safe-action" package-lock.json                                                                                                       →  0
```

Gegenprobe der Architektur: `find apps/web/src/app -name "page.tsx" | wc -l` → 482; davon `grep -rl '"use client"' --include="page.tsx"` → 455. Die verbleibenden 27 Server Components sind (bis auf eine) datenlose Stubs.

**Szenario.** Der andernfalls zu erwartende Angriff — ein Angreifer ruft die Server-Action-ID direkt per `POST` mit `Next-Action`-Header auf und umgeht damit `middleware.ts` vollständig, weil Server Actions über den Page-Pfad und nicht über `/api/**` laufen — ist **nicht durchführbar**, weil kein solcher Endpunkt existiert.

**Bewertung.** Kein Handlungsbedarf. Der Befund ist als **Kontext für S02** relevant: die Routen-Matrix aus S02 deckt damit tatsächlich 100 % der serverseitigen Eintrittspunkte der Web-App ab und muss nicht um eine Server-Action-Dimension ergänzt werden.

**Empfehlung (präventiv).** ESLint-Regel `no-restricted-syntax` gegen die `"use server"`-Direktive, damit die Architekturentscheidung nicht unbemerkt aufgeweicht wird. Andernfalls entsteht mit dem ersten eingeführten Server Action ein Endpunkt, für den die gesamte etablierte `withAuth`/`requireModule`/`requireRole`-Kette nicht greift.

---

### S12-02 — Kein Next.js-Caching auf mandantenbezogenen Daten

**Severity:** Info (positiv)
**Datei:** `apps/web/src/app/layout.tsx:12-13`

**Evidenz.**

```tsx
// All pages require authentication — skip static generation at build time
export const dynamic = "force-dynamic";
```

`grep -rn "unstable_cache\|generateStaticParams\|revalidatePath\|revalidateTag\|force-cache\|cacheLife\|cacheTag\|use cache" apps packages | grep -v node_modules` → **0 Treffer**.
`grep -rn "export const revalidate" apps/web/src` → **0 Treffer**.

**Szenario.** Der klassische Cross-Tenant-Cache-Leak (Org A ruft `/risks` ab, das Ergebnis landet im Full Route Cache, Org B erhält denselben Cache-Eintrag) setzt statisches oder ISR-Rendering voraus. `force-dynamic` im Root-Layout schließt beides für alle 482 Pages aus.

**Bewertung.** Kein Handlungsbedarf. Detaillierte Fundstellenanalyse in Abschnitt 4.

**Empfehlung (präventiv).** Die Entscheidung hängt an einer einzigen Zeile im Root-Layout ohne Test. Ein Regressionstest oder ein CI-Grep, der `export const revalidate` und `unstable_cache` in `apps/web/src/app/**` verbietet, macht sie überprüfbar.

---

### S12-03 — `NEXT_PUBLIC_`-Variablen enthalten keine Secrets

**Severity:** Info (positiv)
**Dateien:** `.env.example:82,190-192`; `apps/web/src/app/api/v1/meta/build/route.ts:34-38`; `apps/web/src/app/api/v1/calendar/ical/generate-token/route.ts:25`; `apps/worker/src/crons/notification-digest.ts:79`

**Evidenz.** Vollständiges Inventar aller vier ins Client-Bundle inlinierten Variablen:

| Variable                 | Wert (Beispiel)         | Sensibilität                                                     |
| ------------------------ | ----------------------- | ---------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`    | `http://localhost:3000` | öffentliche Basis-URL                                            |
| `NEXT_PUBLIC_GIT_SHA`    | `abcdef123`             | Commit-SHA — bei öffentlichem Repo (BASE-001) ohnehin öffentlich |
| `NEXT_PUBLIC_GIT_BRANCH` | `main`                  | Branch-Name                                                      |
| `NEXT_PUBLIC_BUILD_TIME` | `2026-05-23T12:00:00Z`  | Build-Zeitstempel                                                |

`.env.example:190-192` zeigt die drei Build-Variablen auskommentiert; sie werden laut `apps/web/src/app/api/v1/meta/build/route.ts:30-31` im Dockerfile via `ARG GIT_SHA` gesetzt.

**Bewertung.** Kein Leak. `AUTH_SECRET`, `DATABASE_URL`, `APP_DATABASE_URL`, AI-Provider-Keys und `RESEND_API_KEY` tragen alle **kein** `NEXT_PUBLIC_`-Präfix und werden ausschließlich serverseitig gelesen.

---

### S12-04 — CSP erlaubt `'unsafe-inline'` und `'unsafe-eval'` im `script-src`

**Severity:** Medium
**Datei:** `deploy/Caddyfile:36`

**Evidenz.**

```
Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'self'"
```

**Szenario.** Die CSP ist gegen Script-Injection wirkungslos:

1. `'unsafe-inline'` erlaubt jedes injizierte `<script>…</script>` und jeden `on*=`-Attribut-Handler.
2. `'unsafe-inline'` im `script-src` erlaubt zusätzlich **`javascript:`-URIs** — die Navigation zu einer `javascript:`-URL wird von der CSP genau dann blockiert, wenn `'unsafe-inline'` **nicht** gesetzt ist. Damit ist die CSP ausgerechnet für den in **S12-06** gefundenen konkreten Injection-Pfad wirkungslos: `programme_step_link.target_url = "javascript:fetch('/api/v1/…',{method:'DELETE'})"` wird ausgeführt statt blockiert.
3. `'unsafe-eval'` erlaubt zusätzlich `eval`/`new Function` in jedem Third-Party-Skript.

**Kompensierende Kontrolle geprüft.** Der Anwendungscode enthält weder `dangerouslySetInnerHTML` noch `innerHTML` (M3) — die Wahrscheinlichkeit einer HTML-Injection ist damit gering. Das ändert aber nichts daran, dass die CSP im Ernstfall keinen Schutz bietet und die einzige zweite Verteidigungslinie wäre. Der Befund wird deshalb nicht herabgestuft, aber nicht höher als Medium eingestuft.

**Warum überhaupt `unsafe-eval`?** Weder `next.config.ts` noch der Anwendungscode benötigen es (kein `eval`, kein `new Function`, M3). Der Next-Turbopack-Dev-Server braucht `unsafe-eval`, der Produktionsbuild nicht.

**Severity-Begründung.** Medium: fehlende Härtung mit Angriffsvoraussetzung (es braucht zuerst eine Injection). Nicht High, weil kein direkter Angriffspfad allein aus dieser Zeile folgt.

**Empfehlung.** `'unsafe-eval'` ersatzlos streichen. `'unsafe-inline'` im `script-src` durch Nonces ersetzen (Next 16 unterstützt Nonce-Propagation über die Middleware) — das erfordert allerdings, die CSP in die Anwendung zu ziehen (siehe S12-08). `style-src 'unsafe-inline'` kann wegen Tailwind-4- und `motion/react`-Inline-Styles vorerst bleiben; es ist deutlich weniger kritisch.

---

### S12-05 — Trust Center: Server Component ohne RLS-Kontext, Doku behauptet unauthentifizierten Zugriff, Middleware blockiert ihn

**Severity:** Medium
**Datei:** `apps/web/src/app/(portal)/trust/[orgCode]/page.tsx:1-95`; `apps/web/src/middleware.ts:79-100`; `packages/db/src/index.ts:161-178`

**Evidenz.** Die Datei deklariert sich als öffentlich:

```tsx
/**
 * Trust Center — Public compliance status page.
 *
 * Accessible without login at /trust/{orgCode}
 */
```

und liest direkt aus der Datenbank (Z. 35-42, 61-71, 74-87):

```tsx
const [org] = await db
  .select({
    id: organization.id,
    name: organization.name,
    shortName: organization.shortName,
  })
  .from(organization)
  .where(eq(organization.shortName, orgCode));
```

Die Public-Path-Liste der Middleware (`middleware.ts:79-96`) enthält `/trust` **nicht**:

```ts
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname === "/api/v1/health" ||
    pathname.startsWith("/api/v1/whistleblowing/intake") ||
    pathname.startsWith("/api/v1/meta")
  ) {
```

und der Matcher erfasst `/trust/*` (`middleware.ts:177`: `"/((?!_next/static|_next/image|favicon.ico).*)"`).

**Szenario (zwei sich überlagernde Defekte).**

_Defekt A — die Seite ist nicht öffentlich._ `GET /trust/ACME` ohne Session → `middleware.ts:127-131` → `302 → /login?callbackUrl=/trust/ACME`. Die dokumentierte und im Produkt als Vertriebsmerkmal geführte Funktion („Trust Center" für Kunden und Prüfer) ist im Auslieferungszustand nicht erreichbar.

_Defekt B — auch mit Session liefert die Seite leere Daten._ Als React Server Component läuft die Page **nicht** durch `withAuth()` und damit nicht durch `establishRequestScopedContext()` (`apps/web/src/lib/api.ts:196`). Der `db`-Proxy (`packages/db/src/index.ts:353-366`) findet keinen `requestDbStorage`-Store und fällt auf `baseDb` zurück. Der Basis-Pool trägt laut dem Kommentar in `packages/db/src/index.ts:165-170` **niemals** einen `app.current_org_id`. Die RLS-Policies auf den drei abgefragten Tabellen lauten (`packages/db/drizzle/0315_rls_gap_closure_v4.sql:1430` und `:1466`):

```sql
CREATE POLICY module_config_tenant_select ON module_config FOR SELECT
  USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
CREATE POLICY org_active_catalog_tenant_select ON org_active_catalog FOR SELECT
  USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
```

Ohne gesetzten GUC ergibt `NULLIF(NULL,'')::uuid` → `NULL`, `org_id = NULL` → `NULL` → keine Zeile. Ergebnis unter der produktiven `grc_app`-Rolle: `activeCatalogs = []`, `modules = []`. Die Seite rendert „**0 aktive Frameworks · 0 Sicherheitsmodule aktiviert**" unter einer grünen Kachel mit der Aufschrift „Compliance-Status: Aktiv" (Z. 117-130).

_Defekt C — Dev/CI verhält sich anders als Prod._ `RUNTIME_DATABASE_URL = process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL!` (`packages/db/src/index.ts:161-162`). Ist `APP_DATABASE_URL` nicht gesetzt — laut Kommentar Z. 153-155 der Normalfall in Dev und CI — läuft die Runtime als Superuser `grc`, RLS wird vollständig umgangen, und die Seite liefert **vollständige Daten für jede beliebige `orgCode`**. Genau dieser Unterschied macht den Defekt in jedem Testlauf unsichtbar.

**Kompensierende Kontrollen geprüft.** Keine. Es gibt keinen Test für diese Seite (`find apps/web -name "*trust*"` außerhalb von `app/` → 0), keinen Fallback, keine Fehlermeldung.

**Severity-Begründung.** Medium. Kein Cross-Tenant-Leak in der Produktivkonfiguration (RLS greift ja gerade zu streng), aber: (a) eine beworbene Compliance-Funktion ist nicht funktionsfähig, (b) die Anzeige ist irreführend („Status: Aktiv" bei null Daten) und (c) Dev und Prod divergieren, was den Defekt strukturell untestbar macht. Unter der Dev-Konfiguration (`APP_DATABASE_URL` unset — laut BASE-Setup der Zustand der Audit-Umgebung) wäre derselbe Code ein **unauthentifizierter Cross-Tenant-Read**, sobald `/trust` wie dokumentiert in die Public-Liste aufgenommen wird. Diese Kombination ist der eigentliche Grund für Medium statt Low.

**Empfehlung.** Entweder die Funktion streichen, oder: `/trust` in die Public-Liste der Middleware aufnehmen **und gleichzeitig** die drei Queries in `withOrgReadContext(org.id, …)` kapseln (existiert bereits als Export in `packages/db/src/index.ts:497`), damit die Seite unter RLS deterministisch arbeitet und ausschließlich die als öffentlich klassifizierten Felder liefert. Der zweite Schritt ist Voraussetzung für den ersten — ohne ihn würde die Aufnahme in die Public-Liste unter der Dev-Konfiguration jede Organisation der Installation ohne Login abfragbar machen.

---

### S12-06 — Stored XSS: `javascript:`-URI in `programme_step_link.target_url` wird ungeprüft als `href` gerendert

**Severity:** Medium
**Dateien:** `apps/web/src/app/api/v1/programmes/journeys/[id]/steps/[stepId]/links/route.ts:25`; `apps/web/src/app/(dashboard)/programmes/[id]/steps/[stepId]/page.tsx:1208-1216`

**Evidenz — Eingang (kein Schema-Schutz):**

```ts
const createLinkSchema = z
  .object({
    targetKind: z.enum(PROGRAMME_LINK_KIND_VALUES),
    targetId: z.string().uuid().optional(),
    targetLabel: z.string().min(1).max(300),
    targetUrl: z.string().max(1000).optional(),      // ← Zeile 25: kein .url(), kein Schema-Allowlist
```

Persistiert ohne weitere Prüfung (`route.ts:131`): `targetUrl: parsed.data.targetUrl ?? null,`
Spalte: `packages/db/src/schema/programme.ts:577` — `targetUrl: varchar("target_url", { length: 1000 })`.

**Evidenz — Ausgang (Sink):**

```tsx
                    {l.targetUrl ? (
                      <a
                        href={l.targetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                      >
                        {l.targetLabel}
```

**Szenario (Eingabe → Wirkung).**

1. Ein Nutzer mit `admin`, `risk_manager` oder `control_owner` (`route.ts:97`: `withAuth("admin", "risk_manager", "control_owner")`) sendet:
   ```
   POST /api/v1/programmes/journeys/<jid>/steps/<sid>/links
   { "targetKind": "url", "targetLabel": "ISO 27001 Nachweis",
     "targetUrl": "javascript:fetch('/api/v1/programmes/journeys/<jid>',{method:'DELETE'})" }
   ```
   `z.string().max(1000)` akzeptiert das. Der Wert landet in `programme_step_link.target_url`.
2. Ein anderer Nutzer derselben Organisation — typischerweise der freigebende Programm-Owner oder ein Auditor — öffnet `/programmes/<id>/steps/<sid>` und klickt den als „ISO 27001 Nachweis" beschrifteten Link.
3. React rendert `javascript:`-`href`-Werte: es wird eine Entwicklungswarnung geloggt, das Attribut aber gesetzt. Der Code läuft im Origin der Anwendung, mit dem Session-Cookie des Opfers, unter dessen Rollen. `httpOnly` schützt das Cookie vor dem Auslesen, verhindert aber nicht, dass der Code same-origin-Requests mit dem Cookie absetzt.

**Kompensierende Kontrollen geprüft.**

- _CSP:_ wirkungslos — `script-src` enthält `'unsafe-inline'`, was `javascript:`-URIs ausdrücklich erlaubt (siehe S12-04).
- _`rel="noopener noreferrer"`:_ wirkungslos, betrifft nur `window.opener`.
- _Org-Isolation:_ greift — die Route prüft `assertJourneyAndStep(id, stepId, ctx.orgId)` (`route.ts:104`), der Insert setzt `orgId: ctx.orgId` (`route.ts:126`). Der Angriff ist damit **auf die eigene Organisation begrenzt**. Das ist der Grund für Medium statt High.
- _Rollenbeschränkung:_ greift teilweise — nicht jeder Nutzer kann Links anlegen. `control_owner` ist jedoch eine breit vergebene Rolle der 1st Line.
- _Sanitizer:_ keiner vorhanden (`grep -rn "dompurify\|sanitize-html" apps packages` → 0).

**Severity-Begründung.** Medium: Stored XSS mit Angriffsvoraussetzungen (authentifizierter Nutzer mit einer von drei Rollen, Opfer muss klicken), begrenzt auf einen Mandanten. Erreicht innerhalb des Mandanten Privilegieneskalation (1st-Line-Rolle → Aktionen im Kontext eines Admins), was in einem Produkt mit Segregation-of-Duties-Zusage besonderes Gewicht hat.

**Empfehlung.**

1. `targetUrl: z.string().max(1000).url().refine(u => /^https?:$/.test(new URL(u).protocol)).optional()` — `z.url()` allein lässt `javascript:` in einigen Zod-Versionen durch, die Protokoll-Prüfung ist der eigentliche Schutz.
2. Zusätzlich eine gemeinsame `safeExternalHref()`-Hilfsfunktion in `packages/ui`, die im Rendering-Pfad jeden nicht-`http(s)`-Wert auf `undefined` abbildet — damit sind auch Altbestände in der Datenbank abgedeckt.
3. Bestandsdaten prüfen: `SELECT id, org_id, target_url FROM programme_step_link WHERE target_url !~* '^https?://';`

---

### S12-07 — Open Redirect über `callbackUrl` auf der Login-Seite

**Severity:** Medium
**Datei:** `apps/web/src/app/(auth)/login/page.tsx:20,79`

**Evidenz.**

```tsx
const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
```

```tsx
if (result?.error) {
  setError(t("invalidCredentials"));
} else {
  router.push(callbackUrl);
  router.refresh();
}
```

Zwischen Zeile 20 und Zeile 79 findet **keine** Validierung des Wertes statt — weder ein Präfix-Check auf `/`, noch ein Origin-Vergleich, noch eine Allowlist.

**Szenario (Eingabe → Wirkung).**

1. Angreifer verschickt `https://arctos.kunde.de/login?callbackUrl=https://arctos-kunde.attacker.tld/login`.
2. `/login` ist in der Middleware öffentlich (`middleware.ts:80`), die Seite lädt normal unter der echten, TLS-gesicherten Kundendomäne. Das Opfer sieht die korrekte URL und das korrekte Zertifikat.
3. Das Opfer gibt seine echten Zugangsdaten ein. `signIn("credentials", { redirect: false })` (Z. 66-70) authentifiziert erfolgreich, die Session wird gesetzt.
4. `router.push("https://arctos-kunde.attacker.tld/login")` — der App-Router erkennt die externe Origin und führt eine harte Navigation aus. Das Opfer landet auf einer Nachbildung der Login-Seite, die eine „Sitzung abgelaufen, bitte erneut anmelden"-Meldung zeigt, und gibt die Zugangsdaten ein zweites Mal ein — diesmal beim Angreifer.

Protokollrelativ (`callbackUrl=//attacker.tld`) funktioniert identisch.

**Kompensierende Kontrollen geprüft.**

- Die Middleware selbst setzt `callbackUrl` immer auf den eigenen `pathname` (`middleware.ts:128`) — sie ist **nicht** die Quelle des Problems, aber sie verhindert auch nicht, dass ein Angreifer die URL selbst konstruiert.
- Auth.js besitzt einen `redirect`-Callback mit Origin-Prüfung; er wird hier **nicht durchlaufen**, weil `redirect: false` gesetzt ist und die Navigation manuell über `router.push` erfolgt. Die eingebaute Schutzfunktion des Frameworks ist damit ausgeschaltet.
- Es existiert kein `callbacks.redirect` in `packages/auth/src/config.ts` oder `apps/web/src/auth.ts` (`grep -n "redirect" packages/auth/src/config.ts apps/web/src/auth.ts` → keine Callback-Definition).

**Severity-Begründung.** Medium: klassischer Post-Authentication-Open-Redirect. Kein direkter Datenzugriff, aber ein wirksamer Credential-Phishing-Verstärker, der die Vertrauenswürdigkeit der eigenen Domäne ausnutzt.

**Empfehlung.** Vor der Navigation normalisieren:

```ts
const raw = searchParams.get("callbackUrl") ?? "/dashboard";
const callbackUrl =
  raw.startsWith("/") && !raw.startsWith("//") ? raw : "/dashboard";
```

Dieselbe Normalisierung gehört auf den `callbackUrl`, der in `handleSsoSignIn` (Z. 88-91) an die SSO-Login-Route weitergereicht wird, sowie in den `handleLegacySsoSignIn`-Aufruf (Z. 108).

---

### S12-08 — Sämtliche Security-Header existieren ausschließlich im Reverse Proxy, nicht in der Anwendung

**Severity:** Medium
**Dateien:** `apps/web/next.config.ts` (gesamte Datei); `apps/web/src/middleware.ts:97-99,171-173`; `deploy/Caddyfile:31-39`

**Evidenz.** `next.config.ts` enthält **keine** `async headers()`-Funktion. Der einzige sicherheitsnahe Eintrag ist `poweredByHeader: false`. Die Middleware setzt ausschließlich `x-request-id`:

```ts
const res = NextResponse.next();
res.headers.set("x-request-id", requestId);
return res;
```

Repository-weite Suche nach CSP/HSTS/XFO/Referrer-Policy/Permissions-Policy in `apps/`, `packages/`, `.github/`: **3 Treffer**, davon 2 Kommentare und 1 einzelnes `X-Content-Type-Options: nosniff` auf zwei Download-Routen (`documents/[id]/download/route.ts:155`, `documents/[id]/files/[fileId]/download/route.ts:153`).

Der vollständige Header-Satz existiert nur hier (`deploy/Caddyfile:31-39`):

```
  header {
    Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"
    X-Content-Type-Options "nosniff"
    X-Frame-Options "SAMEORIGIN"
    Referrer-Policy "strict-origin-when-cross-origin"
    ...
```

**Szenario.** Die Härtung hängt vollständig daran, dass genau dieser Caddyfile vor der Anwendung steht. `deploy/setup-hetzner.sh:116-124` installiert ihn für den Ein-Server-Hetzner-Pfad. Damit fallen alle anderen Betriebsarten durch:

- `docker-compose.production.yml` und `deploy/docker-compose.yml` enthalten **keinen** Caddy-, Nginx- oder Traefik-Service (`grep -n "caddy\|nginx\|traefik" docker-compose.production.yml deploy/docker-compose.yml docker-compose.yml` → 0 Treffer). Ein Compose-Deployment exponiert Port 3000 ohne jeden Security-Header.
- Ein Kubernetes-Ingress, ein Cloud-Load-Balancer oder ein kundeneigener Reverse Proxy bringt die Header ebenfalls nicht mit.
- `next start` im Direktbetrieb: keine Header.

Konkrete Wirkung ohne den Caddyfile: kein `X-Frame-Options`/`frame-ancestors` → Clickjacking gegen Freigabe- und Genehmigungs-Dialoge (Risikoakzeptanz, Kontrollwirksamkeitsbestätigung, Dokumentenfreigabe) ist möglich; kein HSTS → SSL-Stripping beim ersten Aufruf; keine CSP → keinerlei Injection-Rückfalllinie.

**Kompensierende Kontrollen geprüft.** Der Caddyfile ist eine echte Kontrolle für den dokumentierten Hetzner-Pfad. Er deckt aber nur eine der drei im Repository mitgelieferten Deployment-Varianten ab — deshalb Herabstufung auf Medium statt High, aber kein Verwerfen.

**Severity-Begründung.** Medium: fehlende Härtung, deren Wirksamkeit von einer nicht erzwungenen Umgebungsvoraussetzung abhängt.

**Empfehlung.** Header in `apps/web/next.config.ts` über `async headers()` setzen (bzw. für die CSP mit Nonce in der Middleware, da Next 16 Nonce-Propagation unterstützt). Der Caddyfile kann sie dann weiterhin überschreiben — die Anwendung ist aber in jeder Betriebsart abgesichert. Bei dieser Gelegenheit `X-XSS-Protection` streichen (in allen aktuellen Browsern wirkungslos bis schädlich) und `frame-ancestors 'self'` als CSP-Direktive ergänzen, die `X-Frame-Options` ablöst.

---

### S12-09 — Vier als „öffentlich" gebaute Auth-Endpunkte werden von der Middleware mit 401 blockiert; Enterprise-SSO und Break-Glass-Zugang sind nicht funktionsfähig

**Severity:** High
**Dateien:** `apps/web/src/middleware.ts:79-132`; `apps/web/src/app/api/v1/auth/sso/config/route.ts:4-5`; `apps/web/src/app/api/v1/auth/admin-login/route.ts:16-17`; `apps/web/src/app/api/v1/auth/sso/saml/callback/route.ts`; `apps/web/src/app/api/v1/auth/sso/oidc/callback/route.ts`; `apps/web/src/app/(auth)/login/page.tsx:37-40`; `apps/web/src/app/(auth)/admin-login/page.tsx:25-30`

**Evidenz.** Die Public-Path-Liste der Middleware lautet vollständig (`middleware.ts:79-96`):

```ts
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname === "/api/v1/health" ||
    pathname.startsWith("/api/v1/whistleblowing/intake") ||
    pathname.startsWith("/api/v1/meta")
  ) {
```

`"/api/v1/auth/..."` beginnt **nicht** mit `"/api/auth"`. Alles unterhalb von `/api/v1/auth/**` fällt daher in den Zweig `middleware.ts:103-125` und erhält für einen anonymen Aufrufer:

```ts
  if (!req.auth?.user) {
    if (pathname.startsWith("/api/")) {
      return withRequestId(new Response(JSON.stringify({ …, "status": 401, "detail": "Authentication required", … }), { status: 401, … }), requestId);
```

Betroffen sind alle vier Routen unter `/api/v1/auth/`, die per Konstruktion vor dem Login aufgerufen werden müssen:

| Route                             | Selbstbeschreibung im Code                                                                             | Aufrufer                                              |
| --------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| `auth/sso/config/route.ts:4`      | `// GET … — Public endpoint to check SSO availability` / `// Used by the login page`                   | `(auth)/login/page.tsx:38` (anonym)                   |
| `auth/admin-login/route.ts:16`    | `// POST … — Break-glass admin login` / `// Only works for admin users when SSO enforcement is active` | `(auth)/admin-login/page.tsx:25` (anonym)             |
| `auth/sso/saml/callback/route.ts` | SAML-Assertion-Consumer                                                                                | Identity Provider (Browser-POST, ohne Session-Cookie) |
| `auth/sso/oidc/callback/route.ts` | OIDC-Redirect-URI                                                                                      | Identity Provider                                     |

Zusätzlich sind `auth/sso/saml/login/route.ts` und `auth/sso/oidc/login/route.ts` blockiert, die von `(auth)/login/page.tsx:89-93` per `window.location.href` angesteuert werden.

**Szenario (Eingabe → Wirkung), drei getrennte Wirkungen.**

_1 — SSO-Erkennung auf der Login-Seite schlägt immer fehl._ `(auth)/login/page.tsx:37-45`:

```tsx
        const res = await fetch(`/api/v1/auth/sso/config?orgId=${checkOrgId}`);
        if (res.ok) { … setSsoInfo(json.sso); }
```

Der anonyme Aufruf erhält 401, `res.ok` ist `false`, `ssoInfo` bleibt `null`. Folge: der SSO-Button erscheint nie (`:120`), und die lokale Passwort-Maske wird immer angezeigt (`:173`: `{(!ssoInfo || !ssoInfo.enforceSSO) && (…)}`). Ein Kunde, der `enforceSSO` in der Admin-Oberfläche aktiviert hat, sieht auf der Login-Seite weiterhin das Passwortformular.

_2 — Der Break-Glass-Zugang ist tot._ `(auth)/admin-login/page.tsx:25-30` ruft `POST /api/v1/auth/admin-login` auf. Anonym → 401 → `!res.ok` → `setError(json.error ?? t("breakGlassError"))` (Z. 33) → Abbruch **vor** dem `signIn()`-Aufruf (Z. 40). Der Notfallzugang, der laut Kommentar genau dann greifen soll, wenn SSO erzwungen ist (also wenn der IdP ausgefallen ist), funktioniert nie. Das ist ein Verfügbarkeitsrisiko für die Administrierbarkeit der Plattform.

_3 — Der gesamte SAML-/OIDC-Flow ist unterbrochen._ Der Identity Provider POSTet die Assertion an `/api/v1/auth/sso/saml/callback`. Dieser Request trägt naturgemäß **kein** ARCTOS-Session-Cookie. Die Middleware antwortet mit 401, bevor der Handler die Assertion überhaupt sieht. Enterprise-SSO — ein zentrales Merkmal eines B2B-GRC-Produkts — ist im Auslieferungszustand nicht in Betrieb zu nehmen.

**Kompensierende Kontrollen geprüft.**

- Für Wirkung 1 existiert ein echter serverseitiger Schutz: `packages/auth/src/providers.ts:220-237` prüft `checkSsoEnforcement(orgIds)` in `authorize()` und weist Nicht-Admins mit `failureReason: "sso_enforced"` ab. Die **Durchsetzung** von `enforceSSO` ist damit korrekt und **nicht** client-seitig. Es bleibt eine Fehlbedienungs-/UX-Wirkung, kein Authentifizierungs-Bypass. Dieser Teilaspekt allein wäre Low.
- Für Wirkung 2 und 3 existiert **keine** kompensierende Kontrolle. Es gibt keinen alternativen Break-Glass-Pfad und keinen zweiten SSO-Callback.

**Severity-Begründung.** High. Zwei sicherheitsrelevante Funktionen — der administrative Notfallzugang und der föderierte Authentifizierungspfad — sind vollständig außer Betrieb, und zwar durch einen einzigen Präfix-Fehler in der zentralen Zugriffskontrollschicht. Der Rubrik-Punkt „nicht reproduzierbares Deployment" trifft sinngemäß: eine Installation, die auf SSO umgestellt wird, ist danach ohne SSO-Login und ohne Break-Glass-Zugang. Nicht Critical, weil kein Angreifer dadurch Zugriff **erlangt** — die Wirkrichtung ist Verweigerung, nicht Gewährung.

**Empfehlung.**

1. Public-Liste um die vier vorauthentifizierten Pfade ergänzen, jeweils exakt und mit Begründung im Code:
   `pathname === "/api/v1/auth/sso/config"`, `pathname === "/api/v1/auth/admin-login"`, `pathname.startsWith("/api/v1/auth/sso/saml/")`, `pathname.startsWith("/api/v1/auth/sso/oidc/")`.
2. Danach für `sso/config` prüfen, ob die Rückgabe (`provider`, `displayName`, `enforceSSO` je `orgId`, `route.ts:34-39`) als unauthentifizierte Information akzeptabel ist. Sie erlaubt eine Aufzählung, welche Organisations-UUIDs SSO nutzen. Da `orgId` eine UUID ist, ist das Enumerationsrisiko gering; ein Rate Limit ist dennoch angeraten.
3. E2E-Test ergänzen, der die vier Pfade **ohne** Session-Cookie aufruft und einen Status ≠ 401 erwartet. Ohne einen solchen Test bleibt jede künftige Änderung an der Public-Liste unbemerkt.

---

### S12-10 — Kein `server-only`-Guard auf den serverseitigen Paketen

**Severity:** Low
**Dateien:** `packages/db/src/index.ts`, `packages/auth/src/providers.ts`, `packages/auth/src/context.ts`

**Evidenz.** `grep -rn "server-only\|client-only" apps packages | grep -v node_modules` liefert **einen** Treffer, und der ist ein Kommentar:

```
packages/shared/src/index.ts:37:// NOTE: `checkResolvedHostIsPublic` (DNS-rebind defense) is server-only
```

Weder `packages/db` noch `packages/auth` importieren das npm-Paket `server-only`; es steht auch in keiner `package.json`.

**Szenario.** `apps/web/next.config.ts:29` listet `@grc/auth`, `@grc/db`, `@grc/shared` und `@grc/ui` unter `transpilePackages` — sie werden also vom Bundler verarbeitet und können grundsätzlich in ein Client-Bundle geraten. Ein `import { db } from "@grc/db"` in einer `"use client"`-Datei führt heute zu einem Bundling-Versuch der postgres-js-Kette. In der Regel bricht der Build daran; er kann aber auch mit einem Shim durchlaufen und dabei serverseitige Konstanten inlinen. Mit `import "server-only"` als erster Zeile in `packages/db/src/index.ts` und `packages/auth/src/providers.ts` wäre der Fall ein **deterministischer, sofortiger Buildfehler mit klarer Meldung**.

**Kompensierende Kontrolle geprüft.** Aktuell existiert kein solcher Fehlimport (`grep -rl "@grc/db" apps/web/src/app --include="*.tsx"` → 1 Datei, und die ist eine Server Component). Der Befund ist rein präventiv.

**Severity-Begründung.** Low: Härtung ohne konkreten Angriffspfad im Ist-Zustand.

---

### S12-11 — `Cache-Control: public` auf einer authentifizierten, mandantenbezogenen Antwort

**Severity:** Low
**Datei:** `apps/web/src/app/api/v1/branding/css/[orgId]/route.ts:15,124-129`

**Evidenz.**

```ts
// GET /api/v1/branding/css/:orgId -- Public CSS custom properties endpoint (cached 1h)
```

```ts
return new Response(css, {
  headers: {
    "Content-Type": "text/css",
    "Cache-Control": "public, max-age=3600",
  },
});
```

**Cross-Tenant-Prüfung (Kernfrage des Auftrags).** Der Mandantenschlüssel `orgId` ist **Teil des Pfades** und damit Teil des Cache-Keys jedes RFC-konformen Caches. Zwei Organisationen können nicht auf denselben Eintrag abbilden. Der generierte Body enthält den `orgId` sogar wörtlich (`:88`: `/* ARCTOS Brand CSS -- org ${orgId} -- generated … */`), sodass eine Verwechslung auch bei der Diagnose auffiele. **Kein Cross-Tenant-Leak.**

**Restbefunde.**

1. `public` markiert eine Antwort, die tatsächlich hinter der Auth-Middleware liegt (`/api/v1/branding/**` steht nicht in der Public-Liste), als für Shared Caches zwischenspeicherbar. Inhalt sind sechs Hex-Farbwerte — der Vertraulichkeitsschaden ist praktisch null, die Semantik dennoch falsch.
2. Die Route ruft **kein** `withAuth()` auf und etabliert daher keinen RLS-Kontext (`:25-28`: `db.select().from(orgBranding).where(eq(orgBranding.orgId, orgId))`). Unter `grc_app` greift dieselbe Mechanik wie in S12-05: `org_branding` wird von einer Org-Policy geschützt, der Basis-Pool trägt keinen `app.current_org_id`, `brandings[0]` ist `undefined`, und die Route liefert **immer** `DEFAULT_COLORS` (`:5-13`). Das Branding-Feature ist unter der produktiven DB-Rolle wirkungslos — und unter der Dev-Superuser-Rolle funktioniert es. Gleiche Dev/Prod-Divergenz wie S12-05.
3. Der `orgId` aus dem Pfad wird ohne Abgleich gegen `ctx.orgId` verwendet. Unter der Dev-Konfiguration kann damit jeder authentifizierte Nutzer die Brand-Farben und (über `:44-49`) die Eltern-Org-Beziehung jeder beliebigen Organisation abfragen.

**Kompensierende Kontrolle geprüft.** CSS-Injection ist **ausgeschlossen**: alle sieben interpolierten Werte durchlaufen beim Schreiben `hexColorSchema` (`packages/shared/src/schemas/branding.ts:5-7`, `/^#[0-9a-fA-F]{6}$/`) bzw. `HEX_COLOR` in `api/v1/admin/branding/route.ts:24-30`. Die abgeleiteten Werte stammen aus `computeContrastForeground`/`computeDarkModeColor`. Das ist die richtige Bauweise und wird ausdrücklich als wirksame Kontrolle protokolliert.

**Severity-Begründung.** Low: Härtung und Datenqualität, kein Angriffspfad in der Produktivkonfiguration.

**Empfehlung.** `Cache-Control: private, max-age=3600` setzen; die Query in `withOrgReadContext(orgId, …)` kapseln und `orgId` gegen den Kontext des Aufrufers prüfen (oder die Route bewusst in die Public-Liste aufnehmen, dann aber ohne Eltern-Org-Auflösung).

---

### S12-12 — `window.open()` mit API-gelieferter URL in der SSO-Admin-Oberfläche

**Severity:** Low
**Datei:** `apps/web/src/app/(dashboard)/admin/sso/page.tsx:227`

**Evidenz.**

```tsx
window.open(json.data.redirectUrl, "sso-test", "width=600,height=700");
```

**Szenario.** `redirectUrl` wird aus der SSO-Test-Antwort übernommen und stammt letztlich aus der vom Org-Admin konfigurierten IdP-Login-URL. `window.open("javascript:…")` führt den Code im Origin des Öffnenden aus. Ein Org-Admin kann damit eine `javascript:`-URL als IdP-Endpunkt hinterlegen; ein zweiter Admin, der anschließend „SSO testen" klickt, führt sie in seinem Kontext aus.

**Kompensierende Kontrollen geprüft.** Die Konfigurationsroute erfordert `admin` (`api/v1/admin/sso/route.ts`), und der Angreifer wäre bereits Admin derselben Organisation. Der Gewinn beschränkt sich damit auf laterale Bewegung zwischen zwei Admin-Konten einer Org — deutlich weniger wertvoll als S12-06. Die CSP hilft auch hier nicht (`'unsafe-inline'`, S12-04).

**Severity-Begründung.** Low: Härtung, sehr hohe Angriffsvoraussetzung (bereits Admin), kein Vertraulichkeitsgewinn über die eigenen Rechte hinaus.

**Empfehlung.** Schema-Prüfung auf `https:` beim Speichern der IdP-URL und vor dem `window.open`.

---

### S12-13 — `resolve`-Route liest nur die erste Rollenzeile; Mehrfachrollen führen zu falscher Verweigerung

**Severity:** Low
**Datei:** `apps/web/src/app/api/v1/processes/[id]/comments/[commentId]/resolve/route.ts:19-36`

**Evidenz.**

```ts
  const [role] = await db
    .select({ role: userOrganizationRole.role })
    .from(userOrganizationRole)
    .where(
      and(
        eq(userOrganizationRole.userId, ctx.userId),
        eq(userOrganizationRole.orgId, ctx.orgId),
        isNull(userOrganizationRole.deletedAt),
      ),
    );

  const userRole = role?.role ?? "viewer";
  if (userRole !== "admin" && userRole !== "process_owner") {
```

**Szenario.** `userOrganizationRole` erlaubt mehrere Zeilen je (User, Org) — die gesamte Rollenlogik der Anwendung geht davon aus (`session.user.roles` ist ein Array, `requireRole` prüft mit `.some()`, `packages/auth/src/rbac.ts:70-74`). Diese Route nimmt via Destructuring **die erste Zeile ohne `ORDER BY`** und wirft alle weiteren weg. Ein Nutzer mit den Rollen `viewer` und `admin` in derselben Org erhält je nach Zeilenreihenfolge im Heap eine 403 — nicht deterministisch, nicht reproduzierbar, und über einen `VACUUM`/Reindex sogar wechselnd.

**Kompensierende Kontrollen geprüft.** Der Fehler ist **fail-closed** (falsche Verweigerung, keine falsche Gewährung). Er ist deshalb kein Sicherheitsdefekt im engeren Sinn.

**Severity-Begründung.** Low: inkonsistente Konvention gegenüber `requireRole` mit Fehlbedienungsrisiko.

**Empfehlung.** Auf das etablierte Muster umstellen: `withAuth("admin", "process_owner")` statt der handgeschriebenen Einzelabfrage.

---

### S12-14 — `withAuth`-Rollenprüfung wird durch beliebige Custom Role unterlaufen (Dedup-Kandidat mit S02)

**Severity:** High
**Datei:** `apps/web/src/lib/api.ts:203-213,222-236`

**Evidenz.**

```ts
if (roles.length) {
  const check = requireRole(...roles)(session, orgId, requestId);
  if (check) {
    // Standard role denied — check custom roles as fallback
    const hasCustomAccess = await checkCustomRoleAccess(session.user.id, orgId);
    if (!hasCustomAccess) return check;
  }
}
```

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

**Szenario.** Die Fallback-Abfrage prüft **nicht**, für welches Modul und welche Aktion die Custom Role gilt — nur, ob der Nutzer _irgendeine_ Custom Role mit _irgendeiner_ Berechtigung ungleich `none` in dieser Org besitzt. Besitzt ein Nutzer beispielsweise eine Custom Role „Leseansicht Schulungen" mit `action='read'` auf dem Academy-Modul, so liefert `checkCustomRoleAccess` `true` — und **jede** `withAuth("admin")`-Prüfung im gesamten Produkt wird für ihn übergangen. Der Nutzer erreicht damit alle Admin-Routen, für die keine zusätzliche Prüfung im Handler-Rumpf erfolgt.

Die dafür vorgesehene, korrekt granulare Funktion existiert unmittelbar darunter: `checkCustomRoleModuleAccess(userId, orgId, moduleKey, action)` (`api.ts:242`). Sie wird an dieser Stelle nicht aufgerufen.

**Kompensierende Kontrollen geprüft.** `establishRequestScopedContext` läuft vor der Rollenprüfung (`api.ts:196-201`), sodass RLS die **Mandantengrenze** weiterhin hält — es ist keine Cross-Tenant-Eskalation. Innerhalb der Organisation greift jedoch nichts. Einzelne Handler mit zusätzlicher Eigenprüfung (z. B. `isAuthorOrAdmin` in der Kommentar-Route) bleiben geschützt; die überwiegende Mehrheit der Routen verlässt sich auf das `withAuth(...)`-Argument.

**Severity-Begründung.** High: Privilegieneskalation innerhalb eines Mandanten, Umgehung von Segregation of Duties. Nicht Critical, weil die Mandantentrennung erhalten bleibt und eine Vorbedingung existiert (Zuweisung mindestens einer Custom Role).

**Abgrenzung / Deduplizierung.** Der Fund liegt im gemeinsamen `withAuth`-Helper, den **S02** systematisch prüft. Er ist hier protokolliert, weil er bei der Verifikation der client-seitigen Autorisierungs-Gates (Methodik-Punkt 6) aufgefallen ist und weil er die Bewertung von S12-06 mitträgt. **Für das Register ist S02 führend**; falls S02 denselben Sachverhalt meldet, ist dieser Eintrag zu verschmelzen.

**Empfehlung.** `checkCustomRoleAccess` durch `checkCustomRoleModuleAccess(userId, orgId, moduleKey, action)` ersetzen und `withAuth` um einen `moduleKey`-Parameter erweitern. Bis dahin: den Fallback ersatzlos entfernen — er gewährt heute mehr, als jede Custom Role definieren kann.

---

### S12-15 — SVG-Auslieferung ist an beiden relevanten Stellen gehärtet

**Severity:** Info (positiv)
**Dateien:** `apps/web/src/app/api/v1/organizations/[id]/branding/logo/route.ts:20-24,62-75`; `apps/web/src/app/api/v1/documents/[id]/download/route.ts:138-149`; `apps/web/src/app/api/v1/documents/[id]/files/[fileId]/download/route.ts:147-155`

**Evidenz.** Branding-Upload weist SVG explizit ab:

```ts
  // Reject SVG: it would be served inline from /uploads/, and SVG
  // supports <script>. PNG/JPG/WebP only.
  if (file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg")) {
    return Response.json({ error: "SVG upload is not allowed for branding assets", … }, { status: 415 });
  }
```

Der Dokumenten-Download — auf dem Weg landen die per `evidence/upload/route.ts:45` zugelassenen `image/svg+xml`-Dateien — schaltet den Content-Type um:

```ts
mimeType === "image/svg+xml" ? "application/octet-stream" : mimeType;
```

und setzt `"X-Content-Type-Options": "nosniff"` (`:155`).

**Bewertung.** Der klassische Pfad „SVG hochladen → inline von der App-Origin ausliefern → Stored XSS" ist an beiden Stellen geschlossen. Als **wirksame kompensierende Kontrolle** protokolliert; kein Finding. Der Vollständigkeit halber: die Wirksamkeit hängt an `X-Content-Type-Options: nosniff`, das für diese beiden Routen im Handler gesetzt wird — also unabhängig vom Reverse Proxy aus S12-08. Das ist die richtige Bauweise und sollte das Vorbild für S12-08 sein.

---

### S12-16 — Produktionsbuild auf der spezifizierten Audit-Umgebung nicht durchführbar (OOM)

**Severity:** Medium
**Dateien:** `apps/web/package.json:9`; `apps/web/next.config.ts:71-73`
**Belege:** `/work/audit/evidence/S12/build.log`, `/work/audit/evidence/S12/build2.log`

**Evidenz.** `apps/web/package.json:9`:

```json
    "build": "NODE_OPTIONS='--max-old-space-size=4096' next build",
```

Lauf 1 (`npx turbo build --filter=@grc/web`, Standard-Skript, 4096 MB Heap) auf der in `AUDIT_PLAN.md` Abschnitt 2 spezifizierten Umgebung (2 vCPU, ~8 GB RAM):

```
@grc/web:build: ▲ Next.js 16.2.11 (Turbopack)
@grc/web:build:   Creating an optimized production build ...
@grc/web:build: Killed
@grc/web:build: npm error code 137
 ERROR  run failed: command  exited (137)
  Time:    3m12.494s
```

Exit 137 = SIGKILL durch den OOM-Killer. Lauf 2 mit `--max-old-space-size=6500` läuft deutlich länger und belegt >5 GB RSS.

**Wirkung auf diesen Audit.** Der beauftragte dynamische Nachweis — Client-Chunks in `.next/static/chunks/**` nach Secret-Mustern durchsuchen — konnte nicht im ersten Durchlauf erbracht werden. Er wurde statisch kompensiert (S12-03: vollständiges `NEXT_PUBLIC_`-Inventar; M1: Prüfung der Session-/JWT-Serialisierung; M1: nachgewiesen, dass genau eine Server Component überhaupt DB-Daten hält und diese explizit projiziert). Diese statische Ableitung ist belastbar, weil Next Werte nur dann in Client-Chunks inlined, wenn sie `NEXT_PUBLIC_`-präfigiert sind oder über die RSC-Grenze serialisiert werden — beide Mengen wurden vollständig aufgezählt.

**Eigenständige Wirkung.** Ein Build, der auf einer 2-vCPU/8-GB-Maschine an der Speichergrenze scheitert, ist ein Betriebs- und Lieferkettenrisiko: CI-Runner dieser Größe sind Standard (GitHub-Hosted `ubuntu-latest` hat 7 GB). Ein Build, der nur knapp durchläuft, wird bei jeder weiteren hinzugefügten Route instabil. Verschärfend: `next.config.ts:71-73` setzt

```ts
  typescript: {
    ignoreBuildErrors: true,
  },
```

— der Build meldet also auch dann Erfolg, wenn der Typecheck fehlschlägt. Beides zusammen macht den Build als Qualitätstor unbrauchbar.

**Severity-Begründung.** Medium: Performance-/Betriebsdefekt mit Ausfallpotenzial in der Auslieferungskette.

**Empfehlung.** Heap-Limit an die tatsächliche Runner-Größe anpassen und den Speicherbedarf untersuchen (482 Pages + 1.357 Routen in einem einzigen Next-Build sind an der oberen Grenze dessen, was ein Turbopack-Build in einem Prozess trägt). `typescript.ignoreBuildErrors` entfernen, sobald S14 den `tsc`-Ist-Stand kennt — solange es gesetzt ist, ist keine Aussage über die Typkorrektheit des ausgelieferten Artefakts möglich. **Hinweis gemäß Auftrag:** durch die Buildversuche sind Artefakte unter `/work/repo/apps/web/.next/` entstanden. Quelldateien wurden nicht verändert.

---

### S12-17 — HinSchG-Isolationsgate der Middleware arbeitet auf JWT-Rollen, die bis zu 8 Stunden veraltet sein können

**Severity:** Medium
**Dateien:** `apps/web/src/middleware.ts:134-141`; `packages/auth/src/config.ts:12,21-31,33-39`; `apps/web/src/auth.ts:107-127`

**Evidenz.** Das Gate liest die Rollen aus dem von der Edge-Middleware verifizierten JWT:

```ts
  const roles =
    (req.auth.user as unknown as { roles?: Array<{ role: string }> }).roles ?? [];
  const isHinSchgIsolated =
    roles.length > 0 && roles.every((r) => HINSCHG_ISOLATED_ROLES.has(r.role));
  if (isHinSchgIsolated && !isHinSchgAllowedPath(pathname)) {
```

Die Middleware nutzt `authConfig` (`middleware.ts:3,7`) — die **edge-sichere** Variante ohne DB-Zugriff. Deren Session-Callback reicht die Rollen unverändert aus dem Token durch (`packages/auth/src/config.ts:38-39`):

```ts
const roles = ((token as any).roles as RoleAssignment[]) ?? [];
(session.user as any).roles = roles;
```

Der Token-Callback setzt `token.roles` **ausschließlich beim Sign-in** (`config.ts:22-30`: `if (authUser) { … token.roles = … }`). Session-Lebensdauer: `session: { strategy: "jwt", maxAge: 8 * 60 * 60 }` (`config.ts:12`).

Die Node-Runtime dagegen liest frisch aus der DB (`apps/web/src/auth.ts:110-113`):

```ts
      let roles = ((token as any).roles as RoleAssignment[]) ?? [];
      if (token.userId) {
        try {
          roles = await fetchFreshRoles(token.userId as string);
```

Es liegen also **zwei Rollenquellen mit unterschiedlicher Aktualität** vor: die Route Handler autorisieren gegen den DB-Stand, die Middleware gegen den Sign-in-Stand.

**Szenario (Eingabe → Wirkung).** Die Kommentierung in `middleware.ts:36-46` begründet das Gate ausdrücklich rechtlich („HinSchG vertraulichkeit", „§§16, 32 HinSchG") und legt fest, dass Nutzer, deren einzige Rollen `whistleblowing_officer`/`ombudsperson` sind, das Whistleblowing-Modul nicht verlassen dürfen.

1. Nutzer U meldet sich um 09:00 an. Seine Rollen zu diesem Zeitpunkt: `[admin, whistleblowing_officer]`. `roles.every(...)` ist `false` → nicht isoliert. Der Stand wird ins JWT geschrieben.
2. Um 09:30 entzieht die Compliance-Leitung ihm die `admin`-Rolle, gerade **damit** die HinSchG-Isolation greift (Rollenkonflikt, den der Code selbst als Grund nennt). In der DB steht nun nur noch `whistleblowing_officer`.
3. Bis 17:00 (JWT-`maxAge` 8 h) trägt der Cookie weiterhin beide Rollen. Die Middleware bewertet U weiterhin als _nicht isoliert_ und lässt jeden Pfad durch.
4. Die Route Handler prüfen mit **frischen** Rollen — aber die Mehrheit der Lese-Endpunkte nutzt `withAuth()` **ohne** Rollenargument (nur „authentifiziert"). U ruft `/api/v1/risks`, `/api/v1/audits`, `/api/v1/incidents` ab und erhält Daten. Die Kontrolle, die genau diese Vermischung verhindern soll, greift nicht.

Der symmetrische Fall wirkt in dieselbe Richtung: wird einem Nutzer die Rolle `whistleblowing_officer` **hinzugefügt**, greift die Isolation ebenfalls erst nach Neuanmeldung.

**Weiterer Aspekt derselben Ursache — keine Session-Invalidierung.** `fetchFreshRoles` (`apps/web/src/auth.ts:30-46`) liest ausschließlich `user_organization_role` und prüft **nicht** `user.isActive` oder `user.deletedAt`. `withAuth` (`apps/web/src/lib/api.ts:165-216`) prüft es ebenfalls nicht. Ein deaktivierter oder gelöschter Nutzer behält damit bis zu 8 Stunden eine voll funktionsfähige Session — der Credentials-Provider prüft `isActive` nur beim Login (`packages/auth/src/providers.ts:198-201`). Bei JWT-Strategie ohne Denylist existiert kein Widerrufsmechanismus.

**Kompensierende Kontrollen geprüft.**

- Für die **Rollen**-Aktualität auf API-Ebene: wirksam (`auth.ts:110-113`). Deshalb kein High.
- Für das **Middleware-Gate**: keine. Es ist laut Kommentar (`middleware.ts:38-40`) bewusst an dieser Stelle statt pro Route implementiert („Checked here (edge) instead of per-route to catch every path"). Genau diese Zentralisierung macht es zum alleinigen Träger der Kontrolle.
- Für die **Deaktivierung**: keine.
- Ein expliziter Refresh existiert nur bei `trigger === "update"` (`auth.ts:93-97`), also nur wenn der Client aktiv `session.update()` aufruft. Der `SessionProvider` ist mit `refetchInterval={0}` konfiguriert (`app/layout.tsx:55`) und tut das nie von selbst.

**Severity-Begründung.** Medium: Umgehung einer als gesetzliche Anforderung dokumentierten Segregation-Kontrolle mit einem Zeitfenster von bis zu 8 Stunden und der Vorbedingung einer Rollenänderung. Der Anteil „deaktivierter Nutzer behält Session" allein wäre ebenfalls Medium.

**Abgrenzung.** Der Aspekt „keine Session-Invalidierung bei Deaktivierung" überschneidet sich mit S02 Methodik-Punkt 4 (Auth.js-Konfiguration, Session-Lifetime, Rotation). Er ist hier vollständig belegt, weil er dieselbe Wurzel hat wie das Middleware-Gate; **für das Register ist bei Deduplizierung S02 führend**, das Middleware-Gate selbst bleibt S12.

**Empfehlung.**

1. Das HinSchG-Gate aus der Edge-Middleware in eine Node-Runtime-Prüfung verlagern (oder es dort zusätzlich spiegeln), damit es denselben frischen Rollenstand sieht wie die Autorisierung.
2. `fetchFreshRoles` um einen Join auf `user` mit `isActive = true AND deleted_at IS NULL` erweitern; liefert er keine Zeile, die Session verwerfen.
3. JWT-`maxAge` reduzieren (Rollenänderungen wirken dann schneller) oder eine Session-Version im User-Datensatz führen, die bei Deaktivierung und Rollenänderung hochgezählt und im Session-Callback verglichen wird.

---

### S12-18 — Public-Path-Prüfung der Middleware nutzt `startsWith()` auf zu kurzen Präfixen

**Severity:** Low
**Datei:** `apps/web/src/middleware.ts:83,95`

**Evidenz.**

```ts
    pathname.startsWith("/api/v1/whistleblowing/intake") ||
    …
    pathname.startsWith("/api/v1/meta")
```

Im Routenbaum existiert unter `apps/web/src/app/api/v1/whistleblowing/` neben `intake/` ein **eigenständiges** Verzeichnis `intake-codes/`:

```
$ ls apps/web/src/app/api/v1/whistleblowing/
cases  intake  intake-codes  investigations  protection  statistics
```

`"/api/v1/whistleblowing/intake-codes".startsWith("/api/v1/whistleblowing/intake")` → `true`. Die Middleware stuft `intake-codes` damit als anonym erreichbar ein, obwohl der Kommentar (`middleware.ts:72-78`) ausdrücklich nur den Tipp-Kanal und die Schema-Discovery meint.

**Szenario.** `GET /api/v1/whistleblowing/intake-codes` passiert die Middleware ohne Session. Der Handler gibt für **alle** Organisationen `orgCode`, `shortName` und `name` zurück (`intake-codes/route.ts:22-41`).

**Kompensierende Kontrolle geprüft — greift.** Der Handler prüft selbst:

```ts
export const GET = withErrorHandler(async function GET(_req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
```

Ein anonymer Aufruf erhält daher 401 aus dem Handler statt aus der Middleware. **Kein aktiver Auth-Bypass.** Der Befund wird deshalb von Medium auf Low herabgestuft.

**Restrisiko.** Die Middleware ist die Schicht, die laut Architektur (`middleware.ts:38-40`) „jeden Pfad" abdecken soll. Dass ein Verzeichnis unbeabsichtigt in die Public-Menge fällt und nur durch die Sorgfalt eines einzelnen Handlers gedeckt ist, ist eine latente Lücke: das nächste unter `intake*` angelegte Verzeichnis (etwa `intake-status/`, `intake-v2/`) erbt die Ausnahme automatisch, ohne dass jemand die Middleware anfasst. Dieselbe Bauweise betrifft `/api/v1/meta` (heute existiert nur `meta/build`, ein künftiges `meta-admin/` wäre offen) und `/login` (heute unkritisch).

**Severity-Begründung.** Low: Härtung ohne konkreten Angriffspfad im Ist-Zustand, mit klarem Regressionsrisiko.

**Empfehlung.** Exakte Pfade bzw. präfixe mit abschließendem Trennzeichen verwenden:

```ts
pathname === "/api/v1/whistleblowing/intake" ||
  pathname.startsWith("/api/v1/whistleblowing/intake/");
pathname === "/api/v1/meta" || pathname.startsWith("/api/v1/meta/");
pathname === "/login";
```

Ergänzend einen Unit-Test, der die Public-Menge gegen den tatsächlichen Routenbaum abgleicht.

---

### S12-19 — `/api/v1/meta/build` gibt unauthentifiziert die exakte Node.js-Version preis

**Severity:** Low
**Datei:** `apps/web/src/app/api/v1/meta/build/route.ts:48-60`; `apps/web/src/middleware.ts:95`

**Evidenz.** Die Route ist bewusst öffentlich (`middleware.ts:84-95`) und liefert:

```ts
  return Response.json({
    data: {
      commitSha: COMMIT_SHA,
      branch: GIT_BRANCH,
      builtAt: BUILT_AT,
      nodeVersion: process.version,
      runtimeUptimeSeconds: Math.floor((Date.now() - PROCESS_START_MS) / 1000),
      requestId: getRequestId(req),
```

Die Begründung im Middleware-Kommentar (`:88-91`) lautet: _„The meta endpoints expose only build-time / process-time strings that are also visible in any GitHub push event — no secrets, no PII, no DB touch."_

**Szenario.** Für `commitSha`, `branch` und `builtAt` trifft die Begründung zu — bei öffentlichem Repository (BASE-001) sind sie ohnehin bekannt. `nodeVersion` (`process.version`, z. B. `v22.14.0`) ist jedoch **kein** Build-Artefakt aus GitHub, sondern die exakte Patch-Version der laufenden Runtime. Ein unauthentifizierter Angreifer kann damit ohne jede Interaktion feststellen, ob die Instanz eine Node-Version mit bekannter CVE fährt, und `runtimeUptimeSeconds` sagt ihm zusätzlich, wie lange seit dem letzten Neustart (und damit potenziell seit dem letzten Patch) vergangen ist. Kombiniert ergibt das eine präzise Patch-Level-Aufklärung als Vorstufe.

**Kompensierende Kontrollen geprüft.** Keine — die Route ist ausdrücklich ohne Rate Limit und ohne Auth gebaut.

**Severity-Begründung.** Low: Informationspreisgabe ohne unmittelbaren Angriffspfad, aber mit Aufklärungswert.

**Empfehlung.** `nodeVersion` und `runtimeUptimeSeconds` aus der öffentlichen Antwort entfernen (oder die gesamte Route hinter `withAuth("admin")` legen und den D1-Prod-SHA-Check über einen separaten, tokengeschützten Pfad bedienen). `commitSha`/`branch`/`builtAt` können bleiben.

---

### S12-20 — `customCss` wird in drei Modulen gespeichert, aber nirgends gerendert und nirgends sanitisiert

**Severity:** Low
**Dateien:** `packages/shared/src/schemas/branding.ts:21`; `packages/shared/src/schemas/bi-reporting.ts:187`; `packages/shared/src/schemas/stakeholder-portal.ts:45`; `packages/db/src/schema/branding.ts:79`; `packages/db/src/schema/bi-reporting.ts:298`; `packages/db/src/schema/stakeholder-portal.ts:77`

**Evidenz.** Drei Entitäten nehmen freien CSS-Text entgegen:

```
packages/shared/src/schemas/branding.ts:21:          customCss: z.string().max(10000).nullable().optional(),
packages/shared/src/schemas/bi-reporting.ts:187:     customCss: z.string().max(50000).optional().nullable(),
packages/shared/src/schemas/stakeholder-portal.ts:45: customCss: z.string().max(50000).optional(),
```

Persistenz jeweils als `text("custom_css")`. Die vollständige Suche nach der Verwendung im Frontend

```
grep -rn "customCss\|custom_css" apps packages | grep -v node_modules
```

liefert ausschließlich Schema-, Persistenz- und Formularfeld-Treffer — **keine einzige Rendering-Stelle**. Insbesondere gibt es kein `<style>{customCss}</style>` und, passend dazu, kein `dangerouslySetInnerHTML` im gesamten Baum.

**Szenario.** Im Ist-Zustand: keine Wirkung — das Feld ist tote Konfiguration, die der Nutzer im Branding-Formular (`(dashboard)/settings/branding/page.tsx:137,164,193,225`) befüllen kann, ohne dass etwas passiert. Das ist zunächst nur ein Funktionsdefekt (der Anwender erwartet eine Wirkung).

Das Risiko liegt in der Zukunft: sobald ein Entwickler das Feld verdrahtet — und die naheliegende Umsetzung ist `<style dangerouslySetInnerHTML={{__html: customCss}} />` — entsteht mit einem Schlag ein org-weiter Stored-Injection-Vektor. `</style><script>…` beendet den Style-Block und öffnet ein Script-Element; die CSP wäre wegen `'unsafe-inline'` (S12-04) wirkungslos. Zusätzlich erlaubt auch reines CSS ohne Script-Ausbruch Datenabfluss über Attributselektoren mit `background-image: url(...)` und, bei den Stakeholder-Portalen, UI-Redressing gegenüber externen Dritten.

**Kompensierende Kontrollen geprüft.** Die Längenbegrenzung (10.000 bzw. 50.000 Zeichen) ist keine inhaltliche Prüfung. Ein CSS-Sanitizer ist im Projekt nicht vorhanden (`grep -rn "dompurify\|sanitize-html\|css-sanitiz" apps packages` → 0).

**Severity-Begründung.** Low: heute kein Angriffspfad (Härtung/Wartbarkeit), aber ein vorbereiteter Fußangel mit hohem Folgeschaden. Die Einstufung würde bei Verdrahtung des Feldes unmittelbar auf High springen.

**Empfehlung.** Entscheidung treffen und dokumentieren: entweder das Feld in allen drei Schemas und Migrationen entfernen (samt Formularfeld), oder es beibehalten und **vor** der ersten Verwendung eine Allowlist-basierte CSS-Sanitisierung samt ADR festlegen. Solange es unbenutzt bleibt, gehört mindestens ein Kommentar an die Schema-Definitionen, der die Sanitisierungspflicht festhält.

---

### S12-21 — `eslint-config-next` ist installiert, aber nicht eingebunden; die React-/Next-Sicherheitsregeln sind inaktiv

**Severity:** Low
**Dateien:** `apps/web/eslint.config.mjs:1-30`; `apps/web/package.json:75`; `apps/web/next.config.ts:65-68`; `.github/workflows/ci.yml:50`

**Evidenz.** Die Flat-Config lädt genau drei Quellen:

```js
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
    js.configs.recommended,
    ...tseslint.configs.recommended,
  {
        plugins: { "react-hooks": reactHooks },
```

`eslint-config-next` ist als devDependency deklariert (`apps/web/package.json:75`: `"eslint-config-next": "^16.2.11"`), wird aber nirgends importiert oder gespreadet:

```
$ grep -rn "eslint-config-next\|next/core-web-vitals\|FlatCompat" apps/web .github package.json | grep -v node_modules
apps/web/package.json:75:    "eslint-config-next": "^16.2.11",
```

Ein Treffer — die Deklaration selbst. Es existiert auch keine `.eslintrc*`-Altdatei (`ls -a apps/web | grep -i eslint` → nur `eslint.config.mjs`).

`next.config.ts:65-68` hält ausdrücklich fest, dass der Build nicht mehr lintet und ESLint eigenständig in CI läuft:

```ts
// Next 16 removed the `eslint` config option (and `next build` no longer
// lints) — ESLint runs standalone in CI, nothing replaces the old
// `eslint.ignoreDuringBuilds` block.
```

Und CI ruft genau die nicht eingebundene Konfiguration auf (`.github/workflows/ci.yml:50`): `npx eslint . --no-error-on-unmatched-pattern`.

**Szenario.** Weil weder `eslint-config-next` noch `eslint-plugin-react` geladen sind, ist keine der Regeln aktiv, die die in diesem Stream gefundenen Muster automatisch erkannt hätten:

- `react/jsx-no-script-url` — hätte **S12-06** (`href={l.targetUrl}` mit `javascript:`-Inhalt) und **S12-12** bei der Einführung gemeldet.
- `react/no-danger` — die präventive Absicherung gegen die in **S12-20** beschriebene naheliegende `customCss`-Verdrahtung.
- `react/jsx-no-target-blank` — heute erfüllt (alle 11 Vorkommen tragen `rel`), aber ohne Regel unbewacht.
- `@next/next/*` — unter anderem die Warnungen zu Synchron-Skripten und `<head>`-Manipulation.

Zusätzlich sind projektweite Strengeregeln deaktiviert (`eslint.config.mjs:11-19`): `@typescript-eslint/no-explicit-any: "off"` (widerspricht der in `CLAUDE.md` dokumentierten Konvention, siehe S14), `react-hooks/exhaustive-deps: "off"`, `react-hooks/rules-of-hooks: "warn"` statt `"error"`. Verletzungen der Hook-Regeln brechen CI damit nicht.

**Kompensierende Kontrollen geprüft.** CI führt ESLint aus (`ci.yml:50`) und die Lint-Stufe ist Voraussetzung für vier weitere Jobs (`needs: lint`). Das Tor existiert also — es prüft nur nicht das, was es laut installierter Abhängigkeit prüfen sollte. Es gibt keinen zweiten Mechanismus (kein Semgrep, kein CodeQL-Workflow: `ls .github/workflows/` enthält keinen SAST-Workflow).

**Severity-Begründung.** Low: Härtung und Wartbarkeit ohne eigenen Angriffspfad. Der Befund erklärt jedoch, warum S12-06 und S12-12 unbemerkt einfließen konnten, und ist damit die naheliegendste strukturelle Gegenmaßnahme für diese Findings-Klasse.

**Empfehlung.** `eslint-config-next` per `FlatCompat` (oder ab Next 16 direkt als Flat-Config-Export) einbinden und mindestens `react/jsx-no-script-url`, `react/no-danger` und `react/jsx-no-target-blank` auf `"error"` setzen. `react-hooks/rules-of-hooks` auf `"error"` heben. Über `@typescript-eslint/no-explicit-any` gemeinsam mit S14 entscheiden.

---

### S12-22 — Nur eine einzige Error Boundary in der gesamten App; kein `error.tsx` auf Segmentebene

**Severity:** Low
**Dateien:** `apps/web/src/app/global-error.tsx`; Routenbaum `apps/web/src/app/**`

**Evidenz.**

```
$ find apps/web/src/app -name "error.tsx" -o -name "global-error.tsx"
apps/web/src/app/global-error.tsx
$ find apps/web/src/app -name "loading.tsx" | wc -l
0
```

Eine Datei für 482 Pages. Kein `error.tsx` in `(dashboard)/`, keines in einem Modulsegment.

**Positiver Teilbefund (ausdrücklich geprüft).** `global-error.tsx` rendert **weder** `error.message` **noch** `error.digest` — die Signatur destrukturiert nur `{ reset }` und gibt einen statischen deutschen Text aus (Z. 14-18, 35-41). Es findet **kein Leak von Stack Traces oder internen Fehlerdetails an den Client** statt. Das ist die richtige Bauweise und wird als wirksame Kontrolle protokolliert.

**Szenario.** Weil kein Segment-`error.tsx` existiert, propagiert jeder Renderfehler einer beliebigen Unterseite bis zur globalen Boundary. `global-error` **ersetzt das Root-Layout** (der Kommentar Z. 10-11 hält das fest: „global-error replaces the root layout, hence the explicit `<html>`/`<body>`"). Ein Fehler in einer einzelnen Detailseite — etwa der in **S12-05** beschriebene RLS-bedingte Leerlauf, sobald er einmal in einen `TypeError` läuft — löscht damit die gesamte Anwendungsshell: keine Sidebar, keine Navigation, keine Session-Anzeige, keine i18n. Der Nutzer verliert seinen Arbeitskontext vollständig und kann nur „Erneut versuchen" oder zum Dashboard. In einem Werkzeug, in dem mehrstufige Freigabe- und Bewertungsformulare ausgefüllt werden, ist das ein Datenverlustrisiko auf Nutzerseite.

**Kompensierende Kontrollen geprüft.** Keine. Es gibt auch keine `loading.tsx`, sodass Suspense-Grenzen ebenfalls fehlen — das ist hier folgenlos, weil 455 der 482 Pages Client Components sind und ihre Ladezustände selbst verwalten.

**Severity-Begründung.** Low: Wartbarkeit und Resilienz, kein Sicherheitsdefekt (der potenziell sicherheitsrelevante Teil — Fehlerdetail-Leak — ist korrekt gelöst).

**Empfehlung.** Je ein `error.tsx` in `(dashboard)/` und in `(portal)/` ergänzen, das den umgebenden Layout-Rahmen erhält und ausschließlich `error.digest` (nicht `error.message`) als Korrelations-ID anzeigt — die `digest` ist genau dafür gedacht und enthält keine internen Details.

---

## 6. Geprüft und ohne Befund

Ausdrücklich geprüfte Punkte, die **kein** Finding ergeben haben — protokolliert, damit die Abdeckung nachvollziehbar ist:

| Prüfgegenstand                                                | Befund                                                                                                                                                                                                                  |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dangerouslySetInnerHTML`                                     | 0 Treffer im gesamten Baum                                                                                                                                                                                              |
| `innerHTML`/`outerHTML`/`insertAdjacentHTML`/`document.write` | 0 Treffer                                                                                                                                                                                                               |
| `eval`/`new Function`/String-`setTimeout`                     | 0 Treffer                                                                                                                                                                                                               |
| Markdown-Rendering                                            | keine Markdown-Bibliothek im Projekt                                                                                                                                                                                    |
| BPMN-Labels aus Nutzereingaben                                | alle Overlay-Knoten über `textContent`, kein HTML-String (`bpmn-editor.tsx:296,338,378,417,457`; `bpmn-viewer.tsx:185,226`)                                                                                             |
| `target="_blank"` ohne `rel="noopener"`                       | 0 von 11 Vorkommen betroffen                                                                                                                                                                                            |
| Serialisierung von `passwordHash`/Tokens über die RSC-Grenze  | kein Pfad; die einzige DB-lesende Server Component projiziert explizit                                                                                                                                                  |
| Session-/JWT-Nutzlast                                         | nur `userId`, `email`, `name`, `language`, `roles[]`, `currentOrgId`                                                                                                                                                    |
| `NEXT_PUBLIC_`-Secrets                                        | keine                                                                                                                                                                                                                   |
| Next-Cache als Cross-Tenant-Leak                              | ausgeschlossen (Abschnitt 4)                                                                                                                                                                                            |
| CSS-Injection über Brand-Farben                               | ausgeschlossen — `hexColorSchema` `/^#[0-9a-fA-F]{6}$/` auf allen sieben interpolierten Werten                                                                                                                          |
| SVG-Upload → Inline-XSS                                       | an beiden Stellen gehärtet (S12-15)                                                                                                                                                                                     |
| Middleware-Redirect als Open Redirect                         | `callbackUrl` = eigener `pathname`, nicht extern beeinflussbar (`middleware.ts:128`)                                                                                                                                    |
| `enforceSSO` nur client-seitig durchgesetzt?                  | **nein** — serverseitig in `packages/auth/src/providers.ts:220-237` durchgesetzt                                                                                                                                        |
| Client-Gates ohne Server-Gegenstück                           | keines gefunden (Tabelle M6)                                                                                                                                                                                            |
| CVE-2025-29927 (`x-middleware-subrequest`-Middleware-Bypass)  | nicht anwendbar — betrifft Next 11.1.4–15.2.2, hier läuft **16.2.11** (`build.log`)                                                                                                                                     |
| Org-Cookie-Manipulation                                       | `getCurrentOrgId` validiert gegen die Rollen der Session (`packages/auth/src/context.ts:19-40`); `setCurrentOrgId` setzt `httpOnly`, `sameSite: "lax"`, `secure` in Produktion (`:48-55`)                               |
| Stack-Trace-/Fehlerdetail-Leak an den Client                  | `global-error.tsx` rendert weder `error.message` noch `error.digest` (S12-22, positiver Teilbefund)                                                                                                                     |
| Session-Cookie-Flags                                          | Auth.js-v5-Defaults (kein `cookies`-Override in `packages/auth/src/config.ts`): `httpOnly`, `sameSite: "lax"`, `__Secure-`-Präfix bei HTTPS-`AUTH_URL`. CSRF-Schutz von Auth.js aktiv (Double-Submit auf `/api/auth/*`) |

**Nebenbeobachtung (Doku-Drift, gehört zu S14):** `AUDIT_PLAN.md` Abschnitt 1 nennt „Next.js 15 / React 19.2.7". Tatsächlich installiert und gebaut wird **Next.js 16.2.11** (`apps/web/package.json:48`: `"next": "^16.2.11"`; Build-Ausgabe: `▲ Next.js 16.2.11 (Turbopack)`). Der Build warnt zudem: _„The 'middleware' file convention is deprecated. Please use 'proxy' instead."_ — bei einem Wechsel auf die `proxy`-Konvention müssen die in S12-09 und S12-17 beschriebenen Defekte mitgezogen werden.

---

## 7. Findings-Übersicht

| ID     | Severity | Titel                                                                                                  | Datei:Zeile                                               |
| ------ | -------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| S12-09 | High     | Vier vorauthentifizierte Auth-Endpunkte von der Middleware blockiert; SSO und Break-Glass funktionslos | `apps/web/src/middleware.ts:79-96`                        |
| S12-14 | High     | `withAuth`-Rollenprüfung durch beliebige Custom Role unterlaufbar (Dedup mit S02)                      | `apps/web/src/lib/api.ts:203-213`                         |
| S12-04 | Medium   | CSP mit `'unsafe-inline'` und `'unsafe-eval'` im `script-src`                                          | `deploy/Caddyfile:36`                                     |
| S12-05 | Medium   | Trust Center: RSC ohne RLS-Kontext, „öffentlich" dokumentiert, Middleware blockiert                    | `apps/web/src/app/(portal)/trust/[orgCode]/page.tsx:1-95` |
| S12-06 | Medium   | Stored XSS über `javascript:`-URI in `programme_step_link.target_url`                                  | `.../steps/[stepId]/links/route.ts:25`                    |
| S12-07 | Medium   | Open Redirect über `callbackUrl` auf der Login-Seite                                                   | `apps/web/src/app/(auth)/login/page.tsx:20,79`            |
| S12-08 | Medium   | Security-Header nur im Reverse Proxy, nicht in der Anwendung                                           | `apps/web/next.config.ts`                                 |
| S12-16 | Medium   | Produktionsbuild auf spezifizierter Audit-Umgebung nicht durchführbar (OOM)                            | `apps/web/package.json:9`                                 |
| S12-17 | Medium   | HinSchG-Gate der Middleware auf bis zu 8 h veralteten JWT-Rollen                                       | `apps/web/src/middleware.ts:136-141`                      |
| S12-10 | Low      | Kein `server-only`-Guard auf `@grc/db` / `@grc/auth`                                                   | `packages/db/src/index.ts`                                |
| S12-11 | Low      | `Cache-Control: public` auf authentifizierter, mandantenbezogener Antwort                              | `.../branding/css/[orgId]/route.ts:127`                   |
| S12-12 | Low      | `window.open()` mit API-gelieferter URL in der SSO-Adminoberfläche                                     | `(dashboard)/admin/sso/page.tsx:227`                      |
| S12-13 | Low      | `resolve`-Route liest nur die erste Rollenzeile                                                        | `.../comments/[commentId]/resolve/route.ts:19-36`         |
| S12-18 | Low      | Public-Path-Prüfung mit zu kurzen `startsWith()`-Präfixen                                              | `apps/web/src/middleware.ts:83,95`                        |
| S12-19 | Low      | `/api/v1/meta/build` gibt unauthentifiziert die Node.js-Version preis                                  | `.../meta/build/route.ts:52`                              |
| S12-20 | Low      | `customCss` gespeichert, nirgends gerendert, nirgends sanitisiert                                      | `packages/shared/src/schemas/branding.ts:21`              |
| S12-21 | Low      | `eslint-config-next` installiert, aber nicht eingebunden; React-/Next-Sicherheitsregeln inaktiv        | `apps/web/eslint.config.mjs:1-30`                         |
| S12-22 | Low      | Nur eine Error Boundary in der gesamten App; kein `error.tsx` auf Segmentebene                         | `apps/web/src/app/global-error.tsx`                       |
| S12-01 | Info     | Keine Server Actions vorhanden; RPC-Fläche vollständig in Route Handlern                               | repository-weit                                           |
| S12-02 | Info     | Kein Next.js-Caching auf mandantenbezogenen Daten                                                      | `apps/web/src/app/layout.tsx:13`                          |
| S12-03 | Info     | `NEXT_PUBLIC_`-Variablen enthalten keine Secrets                                                       | `.env.example:82,190-192`                                 |
| S12-15 | Info     | SVG-Auslieferung an beiden relevanten Stellen gehärtet                                                 | `.../branding/logo/route.ts:62-75`                        |
