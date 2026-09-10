# Handover — OP-245: `eslint-plugin-react-hooks` 7.1.1, 416 findings

**To:** the local Claude Code session
**From:** the cloud session (audit ARCTOS-FULL-2026-08-31)
**Date:** 2026-09-09
**Branch:** `audit/full-2026-08-31`, measured against `29224b2f`
**Run this in:** `C:\Users\daimon\Downloads\grcfiles\arctos-audit-build`

---

## 1. The decision, and what it reverses

The owner has decided: **we keep the newer plugin and do the work.** That is
option **B** of the three recorded in the register — not A (pin) and not C
(demote to `warn` and put under the ratchet).

You took option A provisionally, and you were right to: it kept CI meaningful
while the decision was open. It is now superseded. The pin is one line:

```json
// apps/web/package.json, devDependencies
"eslint-plugin-react-hooks": "7.0.1",
```

**Do not remove it first.** Remove it in the _last_ commit of this work, in
the same commit as the fixes that make the count zero. Removing it up front
turns the lint job red for the whole duration and buries every other signal —
exactly the failure mode OP-242 was about. Until then, measure with an
explicit install (§3).

---

## 2. What the finding actually is

`eslint-config-next@16.3.4` pulls `eslint-plugin-react-hooks@^7.0.0`, which
resolves to **7.1.1**. Measured against the same commit, the same
`apps/web/eslint.config.mjs`, with only the plugin version swapped:

| `eslint-plugin-react-hooks` | errors in `apps/web` |
| --------------------------- | -------------------- |
| 7.0.1                       | **0**                |
| 7.1.1                       | **416** in 354 files |

**Not one line of application code changed between those two numbers.** The
rules were widened; the code stands where wave 7b left it. Treat every finding
as newly _detected_, never as newly _introduced_ — that distinction decides how
you write each commit message, and it is the honest one.

Breakdown at 7.1.1:

| Rule                                      | Findings |
| ----------------------------------------- | -------- |
| `react-hooks/set-state-in-effect`         | 384      |
| `react-hooks/refs`                        | 15       |
| `react-hooks/purity`                      | 9        |
| `react-hooks/static-components`           | 4        |
| `react-hooks/immutability`                | 3        |
| `react-hooks/preserve-manual-memoization` | 1        |

---

## 3. Reproduce the measurement before you start

Do this once, and do not trust any number in this document that you have not
seen yourself:

```powershell
npx npm@11.12.0 ci --ignore-scripts
npx npm@11.12.0 install eslint-plugin-react-hooks@7.1.1 --no-save --ignore-scripts
cd apps\web
..\..\node_modules\.bin\eslint.cmd . --no-error-on-unmatched-pattern --quiet -f json -o ..\..\eslint-711.json
```

`--no-save` keeps `package.json` clean, so the pin stays in force for CI while
you work locally against the newer plugin. To get back to the pinned state:
`npx npm@11.12.0 ci --ignore-scripts`.

Counting script (drop it anywhere, it only reads the JSON):

```js
const a = require("./eslint-711.json");
const R = {},
  D = {};
for (const f of a)
  for (const m of f.messages) {
    R[m.ruleId] = (R[m.ruleId] || 0) + 1;
    const k = f.filePath.replace(/.*apps[\/\\]web[\/\\]/, "");
    D[k] = (D[k] || 0) + 1;
  }
console.log(
  Object.values(R).reduce((x, y) => x + y, 0),
  "in",
  Object.keys(D).length,
  "files",
);
console.table(R);
```

---

## 4. The 384 `set-state-in-effect` findings are one shape, 346 times

This is the part that makes the job tractable. Bucketed by the flagged
expression:

| Shape                                                   | Count | Resolution                         |
| ------------------------------------------------------- | ----- | ---------------------------------- |
| **A** fetch on mount — `void fetchData()` and friends   | 275   | `@tanstack/react-query`            |
| **A** same, without `void` — `fetchData()`              | 71    | `@tanstack/react-query`            |
| **E** a direct `setX(...)` in the effect body           | 26    | derive during render, case by case |
| **?** everything else (conditional calls, mixed bodies) | 12    | read each one                      |

346 of 384 — **90 %** — are the same shape. And they are spread thin, not
clustered:

- 344 files hold them; **321 of those files hold exactly one**
- 2 files hold more than four: `audit/executions/[id]/page.tsx` (8),
  `processes/[id]/page.tsx` (7)
- **321 of 344 files sit under `src/app/(dashboard)`** — one page pattern,
  repeated

This is not a design question 344 times. It is one conversion, applied 321
times to near-identical code, plus roughly 23 files that need reading.

### 4.1 The pattern is already in this repository

`@tanstack/react-query` **5.102.8** is installed and used in 17 files. Wave 7b
converted nine sites this way; use those as the reference, not a fresh design:

- `src/app/(dashboard)/catalogs/objects/page.tsx` — the clearest one
- `src/app/(dashboard)/processes/[id]/ropa/page.tsx`
- `src/app/(dashboard)/bcms/bia/[id]/processes/page.tsx`
- `src/app/(dashboard)/dashboard/page.tsx`

**Before** — `src/app/(dashboard)/academy/certificates/page.tsx`, the typical
case, and 275 files look almost exactly like this:

```tsx
const [items, setItems] = useState<Certificate[]>([]);
const [loading, setLoading] = useState(true);

const fetchData = useCallback(async () => {
  setLoading(true);
  try {
    const res = await fetch("/api/v1/academy/certificates");
    if (res.ok) setItems((await res.json()).data ?? []);
  } finally {
    setLoading(false);
  }
}, []);

useEffect(() => {
  void fetchData(); // ← react-hooks/set-state-in-effect
}, [fetchData]);
```

**After** — the shape wave 7b settled on in `catalogs/objects/page.tsx`:

```tsx
const {
  data: items = [],
  isPending: loading,
  refetch,
} = useQuery<Certificate[]>({
  queryKey: ["academy", "certificates"],
  queryFn: async () => {
    const res = await fetch("/api/v1/academy/certificates");
    const json = await res.json();
    return (json.data ?? []) as Certificate[];
  },
});
```

Both the effect and the mirrored `loading` state disappear. Where callers still
need an imperative refresh, wave 7b kept a thin wrapper rather than rewriting
every call site:

```tsx
const fetchData = useCallback(async () => {
  await refetch();
}, [refetch]);
```

Three things to carry over from wave 7b's conversions:

1. **The `queryKey` must contain every input the request depends on** — the
   filter, the id, the locale. A key that omits a filter serves stale rows when
   the filter changes, and no test will tell you.
2. **`isPending`, not `isLoading`**, when you are replacing a `loading` flag
   that starts `true`.
3. **Keep the error path.** If the old code swallowed a failed response, say so
   in the commit rather than silently changing the behaviour under cover of a
   lint fix.

### 4.2 The 26 shape-E findings

These are a direct `setX(...)` in the effect body, e.g.
`audit/executions/[id]/page.tsx:1750`:

```tsx
setSelectedChecklist(checklists[0].id);
```

Wave 7b's four resolutions for this family, in `docs/UMSETZUNG-WELLE-7B.md`:
derive during render; key the component instead of resetting in an effect;
`useSyncExternalStore` for anything reading an external store; mount-time
initialisation moved into `useState`'s initialiser. Pick per site; do not batch
these.

---

## 5. The other 32 findings, enumerated in full

Small enough to list, so there is no discovery step:

**`refs` (15)** — 8 of them on two lines:

```
src/app/(dashboard)/processes/[id]/page.tsx:1489   (×4)
src/app/(dashboard)/processes/[id]/page.tsx:1490   (×4)
src/components/bpmn/arctos-bpmn-canvas.tsx:287, 289, 308, 950
src/components/bpmn/bpmn-viewer-legacy.tsx:67, 69
src/components/bpmn/grc-view-select.tsx:144
```

**`purity` (9)**

```
src/app/(dashboard)/admin/scim/page.tsx:141
src/app/(dashboard)/audit/analytics/page.tsx:127
src/app/(dashboard)/bcms/crisis/[id]/page.tsx:257
src/app/(dashboard)/rcsa/my-assessments/page.tsx:115
src/app/(dashboard)/whistleblowing/cases/[id]/page.tsx:150, 154
src/app/(portal)/dd/[token]/page.tsx:323
src/app/(portal)/report/mailbox/[token]/page.tsx:164, 168
```

**`static-components` (4)**

```
src/app/(dashboard)/settings/modules/[moduleKey]/page.tsx:353
src/app/(dashboard)/work-items/[id]/page.tsx:718
src/components/module/module-teaser.tsx:74
src/components/work-item/work-item-detail-layout.tsx:136
```

**`immutability` (3)**

```
src/app/(dashboard)/admin/sso/page.tsx:96
src/app/(dashboard)/processes/page.tsx:124, 168
```

**`preserve-manual-memoization` (1)**

```
src/components/layout/user-menu.tsx:38
```

Note the four `bpmn` `refs` findings: `arctos-bpmn-canvas.tsx` is our own
engine, and a ref read during render there may be load-bearing. Read the
message before changing anything, and if the honest answer is "the rule is
right and the fix is a redesign", say that in the register instead of forcing
it.

---

## 6. Rules that hold for this work

These are the owner's standing rules for this audit. They are not negotiable
here, and every one of them has been broken at least once in this engagement,
which is why they are written down:

1. **No `eslint-disable`, anywhere, for these rules.** If a finding cannot be
   fixed, it goes in the register with the measured reason — the way
   `react-hooks/incompatible-library` did in ADR-028, scoped to the two named
   files rather than switched off globally.
2. **The `apps/web` ratchet stays at 0.** It has been 0 since wave 4b-5. Do
   not raise it, and do not add these rules to `.eslint-ratchet.json`.
3. **Where a test shows a defect, fix the defect, not the expectation.** If a
   conversion breaks a test, the conversion is probably wrong.
4. **A counter-proof only counts if the failure itself is in the log.** Show
   the red run, then the green one. Not the green one alone.
5. **Check CI, not just the local run.** Six times in this engagement something
   was green locally and red in CI. `gh run list --branch audit/full-2026-08-31`.

---

## 7. Suggested sequencing

Do not open 344 files in one commit. Nobody can review that, and a single bad
`queryKey` in the middle is unfindable.

1. **One pilot file first.** Take a one-finding page under
   `src/app/(dashboard)`, convert it, run the page's own tests, and post the
   diff. Get the shape agreed before multiplying it 320 times.
2. **Then batch by directory** — `academy`, `admin`, `audit`, `bcms`,
   `catalogs`, … — one commit per directory, with the finding count in the
   subject (`… 14 → 0`). That keeps each commit reviewable and each number
   checkable.
3. **The 26 shape-E and the 32 other findings last**, individually, once the
   uniform mass is gone and the remaining noise is small enough to read.
4. **Last commit: remove the pin** from `apps/web/package.json`, regenerate the
   lockfile, and show `eslint . --quiet` at **0** with 7.1.1 actually resolved
   (`npm ls eslint-plugin-react-hooks`).

After every batch:

```powershell
node scripts/lint-ratchet.mjs        # apps/web must stay 0 / 0
npx tsc --noEmit -p apps\web\tsconfig.json
npx vitest run --dir apps\web        # or the affected suites
npx prettier --check .
```

---

## 8. Explicitly out of scope

- **OP-246** (the five Windows-only test-suite defects) — yours, separate.
- **OP-221** (`npm run lint` red on this branch) — still an owner decision, do
  not resolve it as a side effect here.
- The 12 `?`-bucket findings may turn out to include one or two genuine
  behaviour bugs. If one does, it gets its **own** OP number and its own
  commit — do not let a real defect ride into main inside a 40-file lint batch.

---

## 9. Where the numbers came from

Everything above was measured in the cloud container against `29224b2f`, with
`eslint-plugin-react-hooks@7.1.1` force-installed over the pin, using
`apps/web/eslint.config.mjs` unchanged. The register entry is the
**Nachtrag 2026-09-09 — Welle 8l** section of
`docs/OFFENE-PUNKTE-REGISTER.md`; the decision is recorded there as option B.
