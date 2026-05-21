# Wave 24 — A1 Hypothesis: `POST /findings` drops cross-module FKs

**Status:** ✅ **CLOSED 2026-05-21** after five waves. Root cause: **H1 — stale
prod build** (the 40 % top-of-list hypothesis below was correct).

The Wave-24 deploy (carrying PR #218) brought the post-Wave-22 finding insert
code to production (`apps/web/src/app/api/v1/findings/route.ts:166-169` now
passes `controlId`, `controlTestId`, `riskId`, `auditId` into the Drizzle
insert). Verified by direct round-trip on prod 2026-05-21 13:49 UTC:

```
POST /api/v1/findings {controlId:"d0000000-…-1101", title:"a1", severity:…, source:"audit"}
  → 201 {data:{id:"8f797a3a-…", controlId:"d0000000-…-1101", …}}
GET /api/v1/findings/8f797a3a-…
  → {data:{id:"8f797a3a-…", controlId:"d0000000-…-1101", …}}
```

The diagnostic endpoint at `_debug/finding-insert-trace/` was never reachable —
Next.js silently excludes `_<name>` folders from routing. The hypothesis runbook
below is preserved for archive in case a similar symptom recurs on a future
migration. The endpoint + script + integration-test scaffold are removed in the
same commit that closes this doc.

---

## Original hypothesis (archived)

**Bug shape.** `POST /api/v1/findings` with body
`{controlId: <valid uuid>, ...}` returns 201, but a subsequent
`GET /api/v1/findings?id=<new>` shows `controlId = null`. Same for
`auditId`, `riskId`, `controlTestId`. Wave-23 added a server-side
`FindingFkMismatchError` (route.ts:38) that throws when the Drizzle
`returning()` row disagrees with the input — yet prod keeps reporting
null-FK rows on subsequent GETs.

Two things follow from that:

1. The `returning()` row at insert-time matches the input (otherwise the
   Wave-23 verifier would 500). So the FK either lives in the row at
   insert and is removed later, OR the value the verifier sees is the
   FK echoed back to it by the driver — not the one that hit disk.
2. Whatever is dropping the FK is not visible inside the same
   transaction the route uses.

The two surviving hypothesis families are: (a) the FK is persisted to a
column the GET path doesn't read (column-name drift); (b) something
nulls the FK after the verifier fires (AFTER-INSERT trigger / a second
write path) (c) the deployed binary is stale.

---

## 1. Code-path trace (what should happen)

| #   | Step                                                                                                                | File                                                | Expected state                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------- |
| 1   | Client sends `POST /api/v1/findings` with `{title, severity, source, controlId}`                                    | n/a                                                 | Raw JSON `{controlId:"<uuid>"}`                                            |
| 2   | `withAuth("admin","auditor","risk_manager","control_owner","process_owner","ciso")` returns ctx                     | `apps/web/src/app/api/v1/findings/route.ts:75`      | `ctx.orgId`, `ctx.userId` populated                                        |
| 3   | `requireModule("ics", ctx.orgId, req.method)` returns `null` (module enabled)                                       | `route.ts:85`                                       | OK, falls through                                                          |
| 4   | `await req.json()` returns body; `rawBody.status` not set                                                           | `route.ts:93`                                       | `rawBody.controlId = <uuid>`                                               |
| 5   | `createFindingSchema.safeParse(rawBody)` succeeds                                                                   | `packages/shared/src/schemas/control.ts:253`        | `body.data.controlId = <uuid>` (Zod accepts uuid)                          |
| 6   | `withAuditContext(ctx, fn)` opens tx, sets `app.current_org_id`, `app.current_user_id` via `SELECT set_config(...)` | `apps/web/src/lib/api.ts:165`                       | RLS scoped to ctx.orgId                                                    |
| 7   | `tx.insert(workItem).values({...}).returning()` — creates the work_item parent first                                | `route.ts:135`                                      | `wi.id` populated                                                          |
| 8   | `tx.insert(finding).values({orgId, workItemId: wi.id, ..., controlId: body.data.controlId, ...}).returning()`       | `route.ts:157`                                      | row has all FKs populated                                                  |
| 9   | BEFORE-INSERT trigger `finding_auto_create_work_item` only fires WHEN `NEW.work_item_id IS NULL`                    | `packages/db/drizzle/0011_flimsy_lifeguard.sql:520` | **Does NOT fire** in step 8 because step 7 already supplied `work_item_id` |
| 10  | `audit_trigger` (AFTER INSERT/UPDATE/DELETE) writes to audit_log                                                    | `0011_flimsy_lifeguard.sql:418`                     | Side-effect only, can't null `finding.*`                                   |
| 11  | `sync_er_finding_control` (AFTER INSERT OR UPDATE OF control_id OR DELETE) writes to entity_reference               | `0034_sprint22_where_used_event_bus.sql:310`        | Side-effect only, doesn't touch `finding`                                  |
| 12  | Drizzle `returning()` reads RETURNING columns into JS row                                                           | drizzle-orm internals                               | `row.controlId === body.data.controlId`                                    |
| 13  | Wave-23 verifier (route.ts:189-209) compares input vs row; no mismatch → no throw                                   | `route.ts:200`                                      | OK                                                                         |
| 14  | tx commits; route returns 201 with `{data: {...row}}`                                                               | `route.ts:235`                                      | Client sees 201                                                            |
| 15  | Subsequent `GET /api/v1/findings` reads `finding.controlId` and exposes in projection                               | `route.ts:417`                                      | **Prod reports: null**                                                     |

Steps 8–14 each have a candidate failure mode (next section).

---

## 2. Hypothesis ranking

### H1 — Stale prod build (MOST LIKELY, 40%)

**Theory.** The Hetzner Docker image is pinned to a commit before the
`controlId/auditId/riskId/controlTestId` keys were added to
`tx.insert(finding).values({...})` (route.ts:166–169). The repo HEAD
shows the fix; the running container does not. The Wave-23 verifier
DOES exist in the same image (since 23 is "recent"), but only because
that PR's `route.ts` was a single contiguous block — partial cherry-pick
during a rollback could land the verifier without the values.

**Proof.**

```bash
ssh hetzner "docker exec arctos-web sh -c 'grep -n controlId /app/apps/web/src/app/api/v1/findings/route.ts | head'"
# Look for line numbers around 166-169 — if no controlId in the .values({...}) block, this is the bug.
ssh hetzner "docker inspect arctos-web --format '{{.Image}}'"
ssh hetzner "docker images | grep arctos-web"   # compare digests against the CI-pushed digest
ssh hetzner "git -C /srv/arctos rev-parse HEAD && git -C /srv/arctos log --oneline -5"
```

### H2 — Drizzle schema TS file is correct, but the deployed `dist/` JS uses an older compiled schema that's missing the FK columns (35%)

**Theory.** `packages/db/src/schema/control.ts:328` declares
`controlId: uuid("control_id").references(() => control.id)`. If the
deployed bundle/transpile output is older, Drizzle's table object at
runtime has no `controlId` field; `tx.insert(finding).values({controlId: x})`
silently ignores unknown keys (Drizzle does not throw on extra keys —
only TS does). The `returning()` then returns `controlId: null` because
the column was never put into the INSERT statement, the Wave-23 verifier
fires (`expected != null && actual !== expected` → throws) — UNLESS the
`returning()` projection also lacks `controlId`, in which case
`row.controlId === undefined`, and `actual !== expected` → throws.

Wait — under that interpretation Wave-23 would throw and we'd see a 500
with `mismatches`. We don't. So either:

- the stale image predates Wave-23 too (collapses into H1), or
- the runtime `finding` schema object has `controlId` but Drizzle is
  mapping it to a no-op SQL column (very unlikely, but…)

**Proof.**

```bash
ssh hetzner "docker exec arctos-web node -e 'const {finding}=require(\"@grc/db\"); console.log(Object.keys(finding))' "
# Expect: controlId, controlTestId, riskId, auditId, ... — if missing, schema drift
ssh hetzner "docker exec arctos-web sha256sum /app/packages/db/dist/schema/control.js"
# Compare to local: cd packages/db && sha256sum dist/schema/control.js
```

### H3 — Drizzle-kit `_journal.json` only contains entries 0000–0024; prod was bootstrapped via `drizzle-kit migrate` (not `db:migrate-all`) and never ran 0025–0346 (10%)

**Theory.** I verified the journal at
`packages/db/drizzle/meta/_journal.json` lists only 25 tags (last:
`0024_sprint13a_branding`). `migrate-all.ts` reads every `.sql` file
regardless of journal, but `drizzle-kit migrate` consults the journal.
If prod runs `npm run db:migrate` (not `db:migrate-all`), it would only
apply 25 migrations. However, `finding.control_id` is created in
`0011_flimsy_lifeguard.sql:101` which IS in the journal, so the COLUMN
must exist. What WOULDN'T exist is migration `0034`'s
`sync_er_finding_control` trigger or `0331`'s `process_id` column —
which wouldn't null `control_id` either.

This hypothesis is mostly here to be ruled out fast.

**Proof.**

```bash
ssh hetzner "docker exec arctos-db psql -U grc -d grc_platform -c \"SELECT version FROM __drizzle_migrations ORDER BY version DESC LIMIT 5\""
# Expect lots of rows; if only 25, prod used drizzle-kit migrate
ssh hetzner "docker exec arctos-db psql -U grc -d grc_platform -c \"\\d finding\""
# Verify control_id, audit_id, risk_id, control_test_id columns exist
```

### H4 — Unknown AFTER-INSERT/UPDATE trigger on `finding` nulls the FK columns after the route's tx commits (8%)

**Theory.** The Wave-23 verifier sees the FK in the `returning()` row
because RETURNING reflects state at the end of the statement — but
inside the same transaction. If there's an AFTER-INSERT trigger that
opens its own subtransaction or autonomous-fn that updates the row
post-commit (e.g. a queue worker that "normalizes" the row, the
`finding_sync_work_item` AFTER UPDATE trigger fired by something else,
a v2 dispatcher), the GET reads the post-update state.

Repo audit: the only relevant triggers are `audit_trigger` (writes to
audit_log, never updates source), `sync_er_finding_control` (writes to
entity_reference, never updates source), `finding_sync_work_item`
(AFTER UPDATE — by definition can't fire on INSERT). So this would be a
trigger that was installed on prod manually / by a partially-applied
migration and is not in the repo.

**Proof.**

```bash
ssh hetzner "docker exec arctos-db psql -U grc -d grc_platform -c \"SELECT trigger_name, action_timing, event_manipulation, action_statement FROM information_schema.triggers WHERE event_object_table = 'finding'\""
# Compare list against:
#  - audit_trigger (AFTER INSERT/UPDATE/DELETE)
#  - finding_auto_create_work_item (BEFORE INSERT WHEN work_item_id IS NULL)
#  - finding_sync_work_item (AFTER UPDATE)
#  - sync_er_finding_control (AFTER INSERT OR UPDATE OF control_id OR DELETE)
#  - set_updated_at (BEFORE UPDATE)
# Any extra trigger is the culprit.

ssh hetzner "docker exec arctos-db psql -U grc -d grc_platform -c \"SELECT proname, prosrc FROM pg_proc WHERE proname LIKE '%finding%'\""
```

### H5 — `finding_auto_create_work_item` BEFORE-INSERT trigger has been altered on prod (5%)

**Theory.** The repo version (0011_flimsy_lifeguard.sql:495) has
`WHEN (NEW.work_item_id IS NULL)`, so it only fires if work_item_id was
not supplied. The route DOES supply it (route.ts:161, `wi.id` from the
prior insert). So the trigger should not fire. But if someone shipped a
hotfix that drops the `WHEN` clause OR rewrites the body to also set
`NEW.control_id := NULL` (e.g. an over-eager "normalize FKs to use
work_item_link instead" patch), this would fire and clobber.

**Proof.**

```bash
ssh hetzner "docker exec arctos-db psql -U grc -d grc_platform -c \"\\sf finding_auto_create_work_item\""
# Expect body matching 0011_flimsy_lifeguard.sql:495-517. If different, this is the bug.
ssh hetzner "docker exec arctos-db psql -U grc -d grc_platform -c \"SELECT action_condition FROM information_schema.triggers WHERE trigger_name = 'finding_auto_create_work_item'\""
# Expect: (new.work_item_id IS NULL)
```

### H6 — A reverse proxy / WAF rewrites the request body and strips uuid-shaped fields (1%)

**Theory.** Some CSRF/PII WAF rule could be redacting uuid values from
the request body before the Next.js handler reads it. The Wave-23
verifier then sees `body.data.controlId === undefined` (Zod's
`.optional()` allows omission) and skips the FK in `.values({...})`.

**Proof.**

```bash
# On the prod app container, log the raw body for one request:
ssh hetzner "docker exec arctos-web sh -c 'node -e \"const http=require(\\\"http\\\");http.createServer((req,res)=>{let b=\\\"\\\";req.on(\\\"data\\\",c=>b+=c);req.on(\\\"end\\\",()=>{console.log(b);res.end()})}).listen(9999)\"'"
# Send the same POST through the proxy at :443 → :9999 and at :3000 (direct) and diff bodies.
```

### H7 — `RETURNING` column-name aliasing race in postgres-js with prepared statements (1%)

**Theory.** Drizzle issues `INSERT INTO finding (..., control_id, ...) VALUES (..., $5, ...) RETURNING control_id, ...`. postgres-js
caches prepared statements per connection. If a prior statement on the
same connection invalidated the type cache for `control_id` (column
dropped + recreated, or pgenum change), the returning column could be
silently mapped to the wrong slot. Wave-22 was very firm that "the FK
went in, came back null" — postgres-js's per-connection prepared-statement
cache is the most exotic but historically-buggy explanation.

**Proof.**

```bash
# Restart pg connections, then retest:
ssh hetzner "docker exec arctos-web kill -USR2 1"   # or docker restart arctos-web
# Run the POST + GET again immediately on a fresh pool. If FKs persist now, prepared-stmt cache.
ssh hetzner "docker exec arctos-db psql -U grc -d grc_platform -c \"SELECT name, statement FROM pg_prepared_statements LIMIT 20\""
```

---

## 3. Critical evidence on the repo side (static-analysis findings)

| Check                                                                                            | Result                                                                                                                                                                                                                                                                                                                                                      | Citation                                                             |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| SQL migrations that DROP / RENAME `finding.control_id`, `audit_id`, `risk_id`, `control_test_id` | **None found** across 0001–0346. The only finding-touching migrations are 0011 (create), 0034 (sync_er_finding_control trigger), 0077 (global_tag_system — unrelated), 0290 (audit_checklist_item enum widening, no finding change), 0293 (finding_severity enum widening), 0331 (ADD COLUMN process_id, process_step_id), 0338 (CREATE INDEX on audit_id). | `Grep -i finding packages/db/drizzle/*.sql`                          |
| BEFORE-INSERT trigger on `finding` that could null FK columns                                    | `finding_auto_create_work_item` exists but only fires `WHEN (NEW.work_item_id IS NULL)`. Body sets `NEW.work_item_id` only. **Cannot null `control_id`.**                                                                                                                                                                                                   | `packages/db/drizzle/0011_flimsy_lifeguard.sql:495-524`              |
| RLS policies that strip columns                                                                  | All `finding` policies are row-level `FOR ALL USING (...)`; no per-column policy, no `WITH CHECK` clause. Cannot rewrite column values.                                                                                                                                                                                                                     | `packages/db/drizzle/0011_flimsy_lifeguard.sql:333-337,384-387`      |
| Drizzle column-name mapping                                                                      | `controlId: uuid("control_id")` ✅ — `controlTestId: uuid("control_test_id")` ✅ — `riskId: uuid("risk_id")` ✅ — `auditId: uuid("audit_id")` ✅                                                                                                                                                                                                            | `packages/db/src/schema/control.ts:328-333`                          |
| `requireModule` early-return that skips body parse                                               | `requireModule` returns a `Response` if module disabled; route does `if (moduleCheck) return moduleCheck;` (route.ts:86). Returns BEFORE `req.json()` — but that just means we never insert, we don't insert-with-null-FK.                                                                                                                                  | `apps/web/src/app/api/v1/findings/route.ts:85-86`                    |
| Zod schema silently strips fields via `.optional()`                                              | `createFindingSchema` declares each FK as `.uuid().optional()`. Optional just means the key can be absent; values that ARE present are kept. **No silent strip.**                                                                                                                                                                                           | `packages/shared/src/schemas/control.ts:258-261`                     |
| Drizzle journal coverage                                                                         | `_journal.json` only lists 25 entries (0000–0024). Migrations 0025–0346 exist as `.sql` files but are not in the journal. `db:migrate-all` reads all `.sql` files anyway, so this only matters if prod uses `db:migrate`.                                                                                                                                   | `packages/db/drizzle/meta/_journal.json`                             |
| Audit triggers as the writer of the null                                                         | `audit_trigger AFTER INSERT OR UPDATE OR DELETE ON finding` only inserts to `audit_log`, doesn't update the source row.                                                                                                                                                                                                                                     | `packages/db/drizzle/0011_flimsy_lifeguard.sql:418`                  |
| where-used trigger as the writer of the null                                                     | `sync_er_finding_control AFTER INSERT OR UPDATE OF control_id OR DELETE` only writes to `entity_reference`. Doesn't update the source row.                                                                                                                                                                                                                  | `packages/db/drizzle/0034_sprint22_where_used_event_bus.sql:310-312` |

### Anything weird I found

1. **The Wave-23 verifier comparison is structurally sound but cannot detect H3/H4** — those failure modes by design make the bug invisible inside the route's transaction. If the GET is the only place the bug surfaces, the verifier inside the route will never throw. That fits the observed pattern: 201 returned, no `FindingFkMismatchError` 500, but later GET shows null.

2. **The diagnostic endpoint at `/api/v1/_debug/finding-insert-trace` does NOT use `withAuditContext`**, so its inserts run without `app.current_org_id` set. Postgres RLS will block them unless `app.bypass_rls = 'true'` is also set (it isn't). The direct-SQL path will fail with the org_isolation policy. Recommend wrapping the trace in `withAuditContext` OR setting `app.bypass_rls` before the first insert — otherwise the trace returns errors for both paths and tells us nothing.

3. **The diagnostic endpoint's direct-SQL INSERT uses `work_item_id = gen_random_uuid()`**, which will fail the FK constraint `finding_work_item_id_work_item_id_fk`. So the direct-SQL path always errors. The next operator must either insert a real work_item first, or remove the FK from that test, or expect that arm to always fail (it's not a useful arm in the current shape).

4. **The integration test `packages/db/tests/integration/schema-drift-finding-fk.test.ts:116-166`** already does a raw-SQL round-trip with `finding.control_id` and asserts it persists. The test catches the "schema accepts the column but doesn't store it" branch (the test's own words on line 147). If this test passes in CI but prod is broken, that is itself strong evidence for H1/H2 (CI runs the live migrations, prod runs a stale image).

---

## 4. Diagnostic-endpoint usage plan

The debug endpoint lives at `apps/web/src/app/api/v1/_debug/finding-insert-trace/route.ts` and is gated by either `ARCTOS_DEBUG_TRACE_ENABLED=1` env var on the server, OR an `x-arctos-debug-token` request header matching `ARCTOS_DEBUG_TOKEN` on the server.

### Curl invocation (header-token path)

```bash
# Pre-seed: pick a real control and a real audit from the prod DB.
CTL_ID="<existing-uuid>"   # SELECT id FROM control LIMIT 1;
AUD_ID="<existing-uuid>"   # SELECT id FROM audit LIMIT 1;
RSK_ID="<existing-uuid>"
DEBUG_TOKEN="$(ssh hetzner 'docker exec arctos-web sh -c \"printenv ARCTOS_DEBUG_TOKEN\"')"
COOKIE="<a valid Auth.js session cookie for an admin user>"

curl -sS -X POST https://prod.arctos.example/api/v1/_debug/finding-insert-trace \
  -H "Content-Type: application/json" \
  -H "Cookie: $COOKIE" \
  -H "x-arctos-debug-token: $DEBUG_TOKEN" \
  -d "{\"title\":\"WAVE24-A1-DIAG\",\"severity\":\"minor_nonconformity\",\"source\":\"audit\",\"controlId\":\"$CTL_ID\",\"auditId\":\"$AUD_ID\",\"riskId\":\"$RSK_ID\"}" | jq .
```

### Expected output mapped to hypothesis branches

```json
{
  "enabled": true,
  "orgId": "<...>",
  "userId": "<...>",
  "traces": [
    { "stage": "raw-body", "value": { "controlId": "<CTL_ID>", ... } },
    { "stage": "direct-sql-insert", "result": { "id": "...", "control_id": "<CTL_ID>", "audit_id": "<AUD_ID>", "risk_id": "<RSK_ID>", "control_test_id": null } },
    { "stage": "drizzle-insert",    "result": { "id": "...", "controlId": "<CTL_ID>", "auditId": "<AUD_ID>", "riskId": "<RSK_ID>", "controlTestId": null } }
  ]
}
```

| Trace shape                                                                               | Diagnosis                                                                                                                                                                                                                          |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `direct-sql.result.control_id === CTL_ID` AND `drizzle.result.controlId === CTL_ID`       | The DB persists, ORM persists. The bug is downstream of insert. Look at the GET projection or post-commit triggers. Pursue **H4** or **H7**.                                                                                       |
| `direct-sql.result.control_id === CTL_ID` AND `drizzle.result.controlId === null`         | Drizzle is dropping the column at insert time. Strong **H2** (stale compiled schema).                                                                                                                                              |
| `direct-sql.result.control_id === null` AND `drizzle.result.controlId === null`           | The DB itself is dropping the value. Look for a trigger that doesn't appear in this repo (run the trigger inventory in H4).                                                                                                        |
| Both arms `error` with `42P01` (relation doesn't exist)                                   | Schema migration didn't run. **H3.**                                                                                                                                                                                               |
| Both arms `error` with `42501` (RLS blocks)                                               | The endpoint runs without `app.current_org_id` set — known issue from "Anything weird" #2 above. Fix by wrapping in `withAuditContext` or adding `SET LOCAL app.bypass_rls = 'true'` at the top of the route. Not a bug indicator. |
| `direct-sql.error` "violates foreign key constraint finding_work_item_id_work_item_id_fk" | "Anything weird" #3 — the trace's `gen_random_uuid()` for work_item_id always fails the FK. Fix the trace, not the bug.                                                                                                            |
| `enabled: false` / 404                                                                    | Env var `ARCTOS_DEBUG_TRACE_ENABLED=1` and `ARCTOS_DEBUG_TOKEN=<token>` are not set on the running container. Set them via `docker exec arctos-web env` or restart with `-e`.                                                      |

### Alternative: env-flag path

```bash
ssh hetzner "docker exec arctos-web sh -c 'export ARCTOS_DEBUG_TRACE_ENABLED=1 && supervisorctl restart arctos-web'"
# Then issue the curl above without the x-arctos-debug-token header.
# REMEMBER TO UNSET AFTER: this endpoint is documented for removal once A1 closes.
```

---

## 5. Integration test

Written to `apps/web/src/__tests__/integration/findings-fk-persistence.test.ts`. The
test is marked `describe.skip` by default because:

1. `apps/web/src/__tests__/integration/` does not yet exist (no infra harness for
   web-side integration tests against a live Postgres). The
   `packages/db/tests/integration/schema-drift-finding-fk.test.ts` test
   already proves the raw-SQL path via the db-package helpers.
2. To run, you must set `DATABASE_URL` to a writable Postgres with
   migrations applied and unskip the `describe`. Quick unblock at the
   bottom of the file.

It exercises the full repo-side path: real Postgres, real triggers, real
RLS context, real Drizzle insert/select. If this test passes locally
and prod is broken, the bug is in deploy (H1/H2/H3), not code.

---

## TL;DR for the operator

The repo code is correct. The five most-likely root causes, in order:

1. **Stale prod build** — old container image without the controlId/auditId/riskId fields in the `.values({})` payload (H1). Verify with `docker images` + `grep` inside container.
2. **Stale compiled schema** — packages/db/dist/schema/control.js missing the FK columns at runtime; Drizzle silently ignores unknown values keys (H2). Verify with `node -e 'Object.keys(require("@grc/db").finding)'`.
3. **Migration journal drift** — if prod ran `drizzle-kit migrate` it only applied 25 of 346 migrations (H3). Verify with `SELECT version FROM __drizzle_migrations`.
4. **Manual prod trigger** — a hotfix trigger nulls the FK after insert (H4). Verify with `SELECT * FROM information_schema.triggers WHERE event_object_table = 'finding'`.
5. **postgres-js prepared-stmt cache** — exotic, last resort. Restart the app container and retest.

First action: run the `/api/v1/_debug/finding-insert-trace` curl above. Two minutes of output disambiguates between (1)-(2), (3)-(4), and (5).
