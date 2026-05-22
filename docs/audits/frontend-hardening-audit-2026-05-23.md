# Frontend Hardening Audit (post-Wave-26)

> Scope: `apps/web/src/app/**/page.tsx` (~470 pages) + `apps/web/src/components/**` (shadcn/ui shell + module components).
> Method: glob + grep + targeted Read (read-only, no code changes). Pulled 30+ representative pages across modules.
> Sources of truth: `apps/web/src/components/ui/*` (shadcn primitives), `messages/{de,en}/*.json` (next-intl), `CLAUDE.md` Critical Implementation Rules #7 ("All UI text through i18n").

## TL;DR

The frontend is structurally sound — **no `dangerouslySetInnerHTML`, no `.innerHTML =`, no `target="_blank"` without `rel`, no inline `<script>`, and no `console.log` in pages**. shadcn/Radix primitives bring keyboard + focus management for free. Sprint-1 modules (login, dashboard, risks, controls, programmes, BCMS) are well-localised. The four real problems are concentrated in the EU AI Act module and in formatting helpers used everywhere:

- **i18n bypass in 21+ pages** (whole EU AI Act module + a half-dozen error fallbacks + the DD portal): hardcoded German strings (`Speichern`, `Verboten`, `Erneut versuchen`, `Monitor konnte nicht geladen werden`, etc.) that ignore `useTranslations`. Wave-12 promised full i18n; AI Act shipped after that and never got translated. Counter to Critical Rule #7.
- **`.toLocaleDateString()` / `.toLocaleString()` without a locale argument in 68 files**. Output depends on the user-agent locale, not the next-intl session locale. A German user with `en-US` set on their OS sees `5/22/2026` next to German-language UI.
- **No `next/image` anywhere** (5 raw `<img>` instances). Misses lazy-loading, automatic `width`/`height` for CLS, and CSP `img-src` enforcement.
- **`if (error) return <div>{error.message}</div>` in ~9 pages with no retry** — pure dead-end UX. Wave-23 added the proper "AlertTriangle + Retry" card shape in `grc-composite`, `bcms/readiness-monitor`, etc. but the older pages were never migrated.
- **5 `eslint-disable-next-line react-hooks/exhaustive-deps` annotations**, all reviewed — each is justified, but two (`programmes/[id]/audit-simulation` and `programmes/my-work`) call a captured `load` closure that ignores changes to other state slices and would benefit from `useCallback`. Not bugs today, will be after the next refactor.

## Top-5 HIGH priority

1. **AI Act module: complete i18n bypass.**
   `apps/web/src/app/(dashboard)/ai-act/qms/page.tsx:197,206,211` — `<Label>Nachstes Audit</Label>`, `<Button>Speichern</Button>`, `Verfahren erfullt`.
   `apps/web/src/app/(dashboard)/ai-act/prohibited/page.tsx:169,174,183` — `VERBOTEN`, `Kein Verbot`, `Ergebnis speichern`.
   `apps/web/src/app/(dashboard)/ai-act/penalties/page.tsx:153–222` — 6 `<Label>` elements with raw German.
   `apps/web/src/app/(dashboard)/ai-act/incidents/[id]/page.tsx:218–379` — 12 `<Label>` elements (`Schweregrad`, `Sofortmassnahmen`, `Praeventivmassnahmen`, …).
   `apps/web/src/app/(dashboard)/ai-act/systems/[id]/page.tsx:150–315` — 10 `<Label>` elements (`Systemcode`, `Beschreibung`, `Risikoklasse`, …).
   Same shape in `ai-act/corrective-actions/[id]/page.tsx`, `ai-act/gpai/[id]/page.tsx`, `ai-act/systems/[id]/compliance-wizard/page.tsx`.
   **Fix:** add an `ai-act` namespace under `messages/{de,en}/ai-act.json` and replace literals with `t('field.audit_next_date')` etc. An English-locale user today sees a half-German screen.

2. **Locale-blind date formatting in 68 files.**
   Representative offenders: `apps/web/src/app/(dashboard)/dashboard/page.tsx:797` (`new Date(task.dueDate).toLocaleDateString()`), `apps/web/src/app/(dashboard)/work-items/page.tsx:471`, `apps/web/src/app/(dashboard)/documents/page.tsx:100`, `apps/web/src/components/calendar/upcoming-widget.tsx:121`, `apps/web/src/components/process/process-findings-tab.tsx:130`, `apps/web/src/app/(dashboard)/academy/enrollments/page.tsx:111,117`, `apps/web/src/app/(dashboard)/academy/certificates/page.tsx:90,95`, `apps/web/src/components/work-item/work-item-detail-layout.tsx:105`.
   **Fix:** create `src/lib/format-date.ts` exporting `formatDate(d, locale)` that wraps `new Intl.DateTimeFormat(locale, {dateStyle:'short'})`, and have it read locale from `useLocale()` (next-intl). Sed-replace `new Date(x).toLocaleDateString()` site-wide. CLAUDE.md i18n contract says `DE = dd.MM.yyyy`, `EN = MM/dd/yyyy` — today the browser decides.

3. **Error states with no retry button.**
   `apps/web/src/app/(dashboard)/programmes/portfolio/page.tsx:66-71` — `<div>{error}</div>`. No retry, surface is the raw `HTTP 500` string from the fetch wrapper.
   `apps/web/src/app/(dashboard)/programmes/[id]/gantt/page.tsx:108-113` — same shape.
   `apps/web/src/app/(dashboard)/programmes/my-work/page.tsx:99-108` — error in a red box, no retry.
   `apps/web/src/app/(dashboard)/erm/risks/[id]/fair/page.tsx:289`, `apps/web/src/app/(dashboard)/controls/heatmap/page.tsx:128` — `<CardContent>{error}</CardContent>`, no retry.
   `apps/web/src/app/(dashboard)/programmes/page.tsx:91`, `apps/web/src/app/(dashboard)/admin/scim/page.tsx:172`, `apps/web/src/app/(dashboard)/admin/sso/page.tsx:298` — same.
   **Fix:** adopt the existing `bcms/readiness-monitor/page.tsx:157-174` pattern (AlertTriangle icon + reason + `<Button onClick={fetchData}>Erneut versuchen</Button>`) — but use `useTranslations('common')` for the label (today it's hardcoded German too — see item 1).

4. **Raw `<img>` instead of `next/image`.**
   `apps/web/src/app/(dashboard)/settings/branding/page.tsx:426,479,836` — org logo + favicon + email preview. No `width`/`height`, no priority hint, no lazy loading. Triggers layout shift and bypasses Next's image-CSP allowlist.
   `apps/web/src/app/(dashboard)/marketplace/page.tsx:167-171` and `marketplace/listings/[id]/page.tsx:134-138` — listing icons with `alt=""` (decorative is OK, but should be `<Image>`).
   **Fix:** import `Image from "next/image"`, set explicit `width={48} height={48}` per use site, configure `next.config.js` `images.remotePatterns` to allow the org-logo CDN host. Confirms ADR-002 (Next.js 15) story.

5. **AI Act error fallbacks: hardcoded German "Erneut versuchen" / "Monitor konnte nicht geladen werden".**
   `apps/web/src/app/(dashboard)/ai-act/incidents/monitor/page.tsx:156,161`,
   `apps/web/src/app/(dashboard)/ai-act/annual-report/[year]/page.tsx:209,214` (similar),
   `apps/web/src/app/(dashboard)/bcms/readiness-monitor/page.tsx:164,169`,
   `apps/web/src/app/(dashboard)/dpms/deadline-monitor/page.tsx:139,144` (same shape — verified by Grep),
   `apps/web/src/app/(dashboard)/grc-findings/page.tsx:195,200`,
   `apps/web/src/app/(dashboard)/grc-composite/page.tsx:148,154`,
   `apps/web/src/app/(dashboard)/isms/cap-monitor/page.tsx:176,181`.
   **Fix:** add `common.errorTitle` + `common.retry` to `messages/{de,en}/common.json` and replace all 7 hardcoded copies.

## Categorised findings

### React safety

- **`dangerouslySetInnerHTML`** — **0 occurrences in the entire `apps/web/src/`**. No XSS surface from this pattern. Verified with two separate Greps.
- **`.innerHTML =`** — **0 occurrences**. Clean.
- **`target="_blank"` without `rel="noopener noreferrer"`** — **0 occurrences**. Clean.
- **`useEffect` + `exhaustive-deps` disables** — only 5 in the entire app:
  - `apps/web/src/components/layout/org-switcher.tsx:53` — justified (session-derived).
  - `apps/web/src/components/process/process-compliance-profile-switcher.tsx:43` — justified (prop-mirror).
  - `apps/web/src/app/(dashboard)/programmes/my-work/page.tsx:96` — calls `load()` which is not memoised; if a future change adds a captured state slice, this will become stale. Wrap `load` in `useCallback`.
  - `apps/web/src/app/(dashboard)/programmes/[id]/steps/[stepId]/page.tsx:273` — same pattern, same recommendation.
  - `apps/web/src/app/(dashboard)/programmes/[id]/audit-simulation/page.tsx:97` — same.
- **`useState` race conditions / AbortController** — **only 1 file** (`apps/web/src/app/api/v1/webhooks/[id]/test/route.ts`, server-side) uses `AbortController`. Several client pages fetch in `useEffect` and `setState` after — if the user navigates away mid-fetch, React will warn "set state on unmounted component". Not a security issue, will produce console noise. Adopting React Query (already in `org-switcher.tsx` via `useQuery`) project-wide would close this; ~250 client pages still use raw fetch.

### Accessibility (a11y)

- **`alt` text on `<img>`** — only 5 raw `<img>` tags in the app:
  - `apps/web/src/app/(dashboard)/settings/branding/page.tsx:426,479,836` — all three carry meaningful `alt={t('logoAlt')}` / `alt="Logo"`. OK.
  - `apps/web/src/app/(dashboard)/marketplace/page.tsx:167-171` and `marketplace/listings/[id]/page.tsx:134-138` — `alt=""` (decorative, acceptable since a `<Package>` icon already conveys the same role). OK.
  - **No missing-alt finding.**
- **Form labels** — 26 files use raw `<input>` outside of `<Label>`. Spot-check:
  - `apps/web/src/app/(dashboard)/processes/page.tsx:298, 366` — search inputs use `placeholder={t('tree.search')}` but no associated `<label>` or `aria-label`. Screen-reader users get "edit, blank". **Fix: add `aria-label={t('tree.search')}`** (cheap).
  - `apps/web/src/components/process/process-controls-tab.tsx:219-229` — checkbox is inside a clickable `<label>`, so the label-for relationship works. OK.
  - `apps/web/src/app/(auth)/login/page.tsx:182-207` — proper `<label htmlFor>` + matching `id`. OK.
- **Color-only state indicators** — partial issue:
  - `apps/web/src/app/(dashboard)/whistleblowing/statistics/page.tsx:205`, `apps/web/src/app/(dashboard)/budget/[year]/dashboard/page.tsx:218-233`, `apps/web/src/app/(dashboard)/isms/threat-landscape/page.tsx:287-294` — progress / impact bars rely on pure red/green/orange with no `aria-label` or accompanying text. Severity bar at `isms/threat-landscape/page.tsx:289` is the worst: no role/label.
  - **Fix:** add `role="progressbar" aria-valuenow={x} aria-valuemax={100} aria-label={t('impactScore')}`.
  - shadcn `<Badge>` instances elsewhere all carry their text — OK.
- **Keyboard traps** — every modal in the codebase uses shadcn `<Dialog>` / `<Sheet>` / `<AlertDialog>` (Radix-backed; Escape + focus-trap are built-in). No custom modals detected.
- **Status pill `e.status.replace(/_/g, " ")`** — `apps/web/src/app/(dashboard)/academy/enrollments/page.tsx:101` (and 9 other files matched the same regex pattern) — `assigned`, `in_progress`, `completed` rendered raw. Not a11y-blocking but breaks i18n. Move enum labels to `messages/{de,en}/enums.json`.

### Bundle size + perf

- **`import * as X from "lib"`** — verified safe: every occurrence is either a Radix primitive (`import * as DialogPrimitive from "@radix-ui/react-dialog"`, etc., which is the documented Radix pattern and tree-shakes via `sideEffects: false`), `import * as React from "react"`, or three Node-stdlib imports in API routes (`fs/promises`, `path`, `@grc/shared/lib/freetsa`). **No tree-shaking offender found.**
- **`"use client"` everywhere** — **all 250 page.tsx files in `(dashboard)/` declare `"use client"` at line 1**. This is the biggest structural perf issue, but it has been a deliberate architectural choice since Sprint 1 (likely to keep `useTranslations`/`useSession` working). Migrating top-level RSC + small client islands is a multi-week project. **Recommend:** leave the architecture as-is for alpha; the cost is bundle size, not correctness. File `apps/web/src/app/(dashboard)/academy/enrollments/page.tsx` is a representative candidate (50 lines, one fetch) that could be a Server Component if `next-intl` is upgraded to the RSC-friendly variant.
- **Unmemoised `filter().map().sort()` in render** — Grep returned 0 hits for the exact chain. `useMemo` is used in 42 files / 134 spots — the heavy-list pages (`risks/page.tsx`, `controls/page.tsx`, `audit-log/page.tsx`) do memoise. Not a finding.
- **Inline `<img src={branding.logoUrl}>` on every page** — branding logo loaded by `useBranding()` hook on every dashboard route. Confirmed via `layout.tsx`. No `priority` hint = LCP suffers. See top-5 #4.

### Error UX

- **Pages that surface raw `error.message` with no retry**: top-5 #3 covers the 9-file list.
- **Pages with retry, but hardcoded German label**: top-5 #5.
- **Pages with loading-states that flash empty content** — most pages render a `<Loader2 className="animate-spin">` while `loading && !data`. Spot-checks: `academy/page.tsx:61-67`, `programmes/portfolio/page.tsx:72-79`, `bcms/readiness-monitor/page.tsx`. **Clean.**
- **Form submit guarded by `disabled`?**
  - `apps/web/src/app/(dashboard)/assets/page.tsx:348-350` — `disabled={!name.trim() || !tier || submitting}`. OK.
  - `apps/web/src/app/(dashboard)/organizations/new/page.tsx:396` — `disabled={saving || !data.name.trim()}`. OK.
  - `apps/web/src/app/(dashboard)/ai-act/qms/page.tsx:206-212` — `disabled={!form.ai_system_id}` but **does NOT include a `submitting` flag** → double-click double-submits. Same shape in `ai-act/prohibited/page.tsx:180`, `ai-act/penalties/page.tsx`, `ai-act/incidents/page.tsx`, `ai-act/corrective-actions/page.tsx`, `ai-act/authority/page.tsx`, `ai-act/gpai/page.tsx`. **Fix:** add a `submitting` `useState` and chain `disabled={...submitting}`. Server-side idempotency is presumably already in place (Wave-21 idempotency-key sweep) but client double-submit will still toast twice.
- **`<form onSubmit>`** — 15 files use the form-pattern (vs. button-onClick). Login + admin-login are clean; only the DD portal at `apps/web/src/app/(portal)/dd/[token]/page.tsx:511` uses `onClick={handleSubmit}` with proper `disabled={submitting}`.

### i18n correctness

- **Hardcoded strings in JSX** — concentrated entirely in:
  1. **EU AI Act module** (13/14 pages have a `useTranslations` call but mix in hardcoded German labels; see top-5 #1).
  2. **Portal pages** at `apps/web/src/app/(portal)/dd/[token]/page.tsx` — uses an inline `lang === "de" ? "X" : "Y"` ternary at lines 350, 505, 515 etc. instead of `useTranslations`. Acceptable for portal-bounded code (the portal carries its own `?lang=` parameter) but inconsistent.
  3. **Error fallbacks**: see top-5 #5.
  4. `apps/web/src/app/(dashboard)/grc-findings/page.tsx:336` — `<CardTitle>Filter</CardTitle>`. Single literal but in a generic card title — easy fix.
  5. `apps/web/src/lib/ropa-export.ts:83` — `new Date().toLocaleDateString("de-DE", ...)` hardcodes German. This is RoPA-export, which is _legally_ German-formatted (GDPR Art. 30), so likely intentional — flag for review only.
- **Locale-blind date formatting** — see top-5 #2 for the 68-file list.
- **`.toLocaleString()` (datetime + number combined) without locale arg** — 15 files. Same fix as #2, but the call site `apps/web/src/app/(dashboard)/admin/performance/page.tsx:242` (`q.callCount.toLocaleString()`) is a number, not a date, and _should_ take a locale to honour the `1.234,56` vs `1,234.56` contract.

## Recommendations (cost-ordered, lowest first)

| #   | Item                                                            | Effort | Impact                             |
| --- | --------------------------------------------------------------- | ------ | ---------------------------------- |
| R1  | Add `common.errorTitle` + `common.retry` + replace 7 hardcoded  | 1 h    | Closes English-locale UX gap (#5)  |
| R2  | Add `aria-label` to all top-of-page search `<input>`s           | 1 h    | a11y                               |
| R3  | Add `submitting` guards to 6 AI-Act submit buttons              | 1 h    | Stops double-submit                |
| R4  | Wrap `load()` in `useCallback` in the 3 programmes pages        | 30 m   | Future-proofs eslint-disabled deps |
| R5  | Create `src/lib/format-date.ts` + sed-replace 68 call sites     | 4 h    | Honour i18n contract (#2)          |
| R6  | Add `aria-label` + `role=progressbar` to coloured progress bars | 1 h    | a11y                               |
| R7  | Create `messages/{de,en}/ai-act.json`, migrate 21+ pages        | 1.5 d  | Closes top-5 #1                    |
| R8  | Migrate 9 error pages to AlertTriangle+Retry shape              | 4 h    | Closes top-5 #3                    |
| R9  | Replace 5 raw `<img>` with `next/image` + remote-pattern config | 3 h    | LCP + CSP enforcement              |
| R10 | (Long term) RSC migration for read-only pages                   | weeks  | Bundle-size; not for alpha         |

## What we explicitly did NOT find

- No `dangerouslySetInnerHTML` (zero hits).
- No `.innerHTML =` (zero hits).
- No `eval(` or `new Function(` in components.
- No `target="_blank"` without `rel`.
- No empty `catch {}` in pages.
- No `console.log` in `apps/web/src/app/**` (zero hits).
- No custom modal implementations (everything uses Radix-backed shadcn).
- No `useEffect` with `fetch` lacking a try/catch (every fetch is wrapped or feeds an error state).
- No tree-shaking offenders.
