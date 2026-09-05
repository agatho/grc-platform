// #SEC-F01b-RUN — REAL route-chain RLS regression test.
//
// This is the test that the earlier RLS suites were missing. The existing
// packages/db RLS tests drive the request-context PRIMITIVES in isolation
// (reserveRequestContext / runWithRequestContext). They never exercised the
// REAL request pipeline a browser hits:
//
//   Request → withErrorHandler → withAuth → establishRequestScopedContext
//           → requireModule → the route's own `db` reads
//
// The production bug: `establishRequestScopedContext` pinned the org/user
// context with `AsyncLocalStorage.enterWith(...)` from inside the awaited
// `withAuth` helper. Under the Next App Router runtime (which runs each handler
// inside its own async-context frame) that `enterWith` is silently dropped when
// control returns to the route body across the `await` — so every `db` read ran
// context-less, RLS filtered every row, and each data endpoint answered
// `200 {"data":[],"total":0}` even though the org had rows.
//
// FAITHFUL REPRODUCTION IN A TEST RUNNER
// --------------------------------------
// A plain test runner has NO enclosing async-context frame, so a bare
// `enterWith` inside an awaited helper *does* propagate — meaning a naive
// handler call would NOT reproduce the bug. We therefore invoke the real `GET`
// inside an outer `requestDbStorage.run(baseStore, …)` frame, which is exactly
// the async-context condition Next establishes around every route handler (and
// exactly what the fix's own `withErrorHandler` now establishes internally).
// Empirically (async_hooks): a nested `enterWith` under an enclosing `run()`
// does NOT propagate to the caller's continuation, but a MUTATION of the
// run()-bound store object does. So under this frame:
//   • OLD code (enterWith)      → store dropped   → 0 rows  (RED — the bug)
//   • NEW code (run() + mutate) → store preserved → org rows (GREEN — the fix)
//
// Runs under APP_DATABASE_URL=grc_app (non-superuser, RLS live) so the exact
// pool a real route uses enforces RLS. See the CI "Route-chain RLS test" step.

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  vi,
} from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import { inArray } from "drizzle-orm";
import postgres from "postgres";

import {
  db,
  risk,
  organization,
  user,
  userOrganizationRole,
  moduleConfig,
  moduleDefinition,
  requestClient,
  requestDbStorage,
  baseDb,
  schema,
  type RequestDbStore,
} from "@grc/db";

// ── Mocked auth boundary (only the auth boundary — the db/context chain is
// fully REAL). vi.hoisted so the vi.mock factories can read this state. ──
const h = vi.hoisted(() => ({
  sessionUserId: "",
  sessionEmail: "" as string | null,
  sessionName: "" as string | null,
  currentOrgId: "" as string | null,
  roles: [] as Array<{ orgId: string; role: string }>,
  afterCbs: [] as Array<() => unknown | Promise<unknown>>,
}));

vi.mock("@/auth", () => ({
  auth: async () =>
    h.sessionUserId
      ? {
          user: {
            id: h.sessionUserId,
            email: h.sessionEmail,
            name: h.sessionName,
            roles: h.roles,
          },
        }
      : null,
}));

vi.mock("@grc/auth/context", () => ({
  getCurrentOrgId: async () => h.currentOrgId || null,
}));

// Keep `after()` succeeding (capture the release) so the OLD code takes its real
// enterWith path — the production failure mode — instead of bailing because
// after() is unavailable in the test runner. Everything else from next/server
// is passed through unchanged.
vi.mock("next/server", async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return {
    ...actual,
    after: (fn: () => unknown | Promise<unknown>) => {
      h.afterCbs.push(fn);
    },
  };
});

const SU_URL = process.env.DATABASE_URL!; // [OP-170] kein Rueckfallwert: setup-require-roles.ts erzwingt ihn
const suClient = postgres(SU_URL, { max: 1 });
const adminDb = drizzle(suClient, { schema });

const suffix = Date.now();
let orgAId = "";
let orgBId = "";
let userAId = "";
const riskAIds: string[] = [];
const riskBIds: string[] = [];
const createdRiskIds: string[] = [];

function makeBaseStore(): RequestDbStore {
  return { db: baseDb, reserved: null, orgId: "", userId: "", released: true };
}

/**
 * Invoke the REAL `GET /api/v1/risks` inside an outer request-scoped async
 * frame — the exact condition (Next App Router) under which the enterWith bug
 * manifests. Returns the parsed JSON body.
 */
async function callRisksGet(): Promise<{
  data: Array<{ id: string; orgId: string }>;
  pagination: { total: number };
}> {
  const { GET } = await import("@/app/api/v1/risks/route");
  const req = new Request("http://localhost/api/v1/risks", { method: "GET" });
  const res = (await requestDbStorage.run(makeBaseStore(), () =>
    GET(req, undefined as never),
  )) as Response;
  expect(res.status).toBe(200);
  return res.json();
}

/**
 * Invoke the REAL `POST /api/v1/risks` inside the same outer request frame. This
 * exercises `withAuditContext` -> `db.transaction()` on the reserved connection —
 * the path that regressed with `this.client.begin is not a function` once the
 * run()+mutate fix made the reserved connection the request-active one.
 */
async function callRisksPost(title: string): Promise<Response> {
  const { POST } = await import("@/app/api/v1/risks/route");
  const req = new Request("http://localhost/api/v1/risks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title,
      description: "rls-route-chain regression",
      riskCategory: "operational",
      riskSource: "erm",
    }),
  });
  return (await requestDbStorage.run(makeBaseStore(), () =>
    POST(req, undefined as never),
  )) as Response;
}

describe("#SEC-F01b-RUN risks route under grc_app (real withErrorHandler→withAuth→db)", () => {
  beforeAll(async () => {
    // grc_app must exist + have table grants (idempotent; CI also does this).
    await suClient.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'grc_app') THEN
          CREATE ROLE grc_app LOGIN PASSWORD 'grc_app_dev_password';
        END IF;
      END $$;
      GRANT USAGE ON SCHEMA public TO grc_app;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO grc_app;
      -- [ARCTOS-FULL-2026-08-31 / Restarbeiten · S01-04, S01-08]
      -- Gegenstueck zum pauschalen GRANT darueber. ON ALL TABLES erfasst
      -- auch die Auth.js-Token-Tabellen (deny-all seit Migration 0392) und
      -- die Materialized Views (koennen keine RLS tragen, Migration 0393).
      -- Ohne diesen REVOKE hebt dieser Test die beiden Kontrollen in der
      -- Datenbank dauerhaft auf: gemessen am 2026-09-01 stand
      -- has_table_privilege('grc_app','session','SELECT') nach einem
      -- vollstaendigen npm-test-Lauf auf true, und
      -- packages/db/tests/rls/tenant-isolation-systemtest.test.ts meldete
      -- danach fuenf RLS-Luecken — es bestand nur, weil es VOR diesem Test
      -- lief. Die acht RLS-Tests unter packages/db/tests/rls tragen denselben
      -- Block; hier fehlte er.
      REVOKE ALL ON public.session, public.account, public.verification_token
        FROM grc_app;
      DO $revoke_mv$ DECLARE r record; BEGIN
        FOR r IN SELECT c.relname FROM pg_class c
                   JOIN pg_namespace n ON n.oid = c.relnamespace
                  WHERE n.nspname = 'public' AND c.relkind = 'm' LOOP
          EXECUTE format('REVOKE ALL ON public.%I FROM grc_app', r.relname);
        END LOOP;
      END $revoke_mv$;
    `);

    // Global module definition (no RLS) — requireModule JOINs against it.
    await adminDb
      .insert(moduleDefinition)
      .values({
        moduleKey: "erm",
        displayNameDe: "Enterprise Risk Management",
        displayNameEn: "Enterprise Risk Management",
        navOrder: 1,
      })
      .onConflictDoNothing();

    const [orgA] = await adminDb
      .insert(organization)
      .values({
        name: `F01bRUN Org A ${suffix}`,
        type: "subsidiary",
        country: "DEU",
      })
      .returning({ id: organization.id });
    const [orgB] = await adminDb
      .insert(organization)
      .values({
        name: `F01bRUN Org B ${suffix}`,
        type: "subsidiary",
        country: "AUT",
      })
      .returning({ id: organization.id });
    orgAId = orgA.id;
    orgBId = orgB.id;

    const [uA] = await adminDb
      .insert(user)
      .values({
        email: `f01brun-${suffix}@test.dev`,
        name: "F01bRUN User",
        passwordHash: "x",
      })
      .returning({ id: user.id });
    userAId = uA.id;
    await adminDb
      .insert(userOrganizationRole)
      .values({ userId: userAId, orgId: orgAId, role: "admin" });

    // erm enabled for BOTH orgs so requireModule passes for each.
    await adminDb.insert(moduleConfig).values([
      {
        orgId: orgAId,
        moduleKey: "erm",
        uiStatus: "enabled",
        isDataActive: true,
      },
      {
        orgId: orgBId,
        moduleKey: "erm",
        uiStatus: "enabled",
        isDataActive: true,
      },
    ]);

    // 3 risks in Org A, 2 in Org B.
    for (let i = 0; i < 3; i++) {
      const [r] = await adminDb
        .insert(risk)
        .values({
          orgId: orgAId,
          title: `F01bRUN Risk A${i} ${suffix}`,
          riskCategory: "operational",
          riskSource: "erm",
        })
        .returning({ id: risk.id });
      riskAIds.push(r.id);
    }
    for (let i = 0; i < 2; i++) {
      const [r] = await adminDb
        .insert(risk)
        .values({
          orgId: orgBId,
          title: `F01bRUN Risk B${i} ${suffix}`,
          riskCategory: "operational",
          riskSource: "erm",
        })
        .returning({ id: risk.id });
      riskBIds.push(r.id);
    }
  });

  afterEach(async () => {
    // Drain the release callbacks captured from the mocked after() so reserved
    // connections go back to the request pool between calls.
    const cbs = h.afterCbs.splice(0);
    for (const cb of cbs) {
      try {
        await cb();
      } catch {
        /* ignore */
      }
    }
  });

  afterAll(async () => {
    const allRiskIds = [...riskAIds, ...riskBIds, ...createdRiskIds];
    await suClient.unsafe(`SET session_replication_role = 'replica'`);
    if (allRiskIds.length) {
      await adminDb.delete(risk).where(inArray(risk.id, allRiskIds));
    }
    await suClient.unsafe(
      `DELETE FROM audit_log WHERE org_id IN ('${orgAId}', '${orgBId}')`,
    );
    await suClient.unsafe(
      `DELETE FROM module_config WHERE org_id IN ('${orgAId}', '${orgBId}')`,
    );
    await suClient.unsafe(
      `DELETE FROM user_organization_role WHERE org_id IN ('${orgAId}', '${orgBId}')`,
    );
    await suClient.unsafe(`DELETE FROM "user" WHERE id = '${userAId}'`);
    await suClient.unsafe(
      `DELETE FROM organization WHERE id IN ('${orgAId}', '${orgBId}')`,
    );
    await suClient.unsafe(`SET session_replication_role = 'origin'`);

    await suClient.end();
    await requestClient.end();
    await (
      db as unknown as { $client: { end: () => Promise<void> } }
    ).$client.end();
  });

  it("Org A: the real route returns Org A's risks (NON-empty) — RED without the fix", async () => {
    h.sessionUserId = userAId;
    h.sessionEmail = "f01brun@test.dev";
    h.sessionName = "F01bRUN User";
    h.currentOrgId = orgAId;

    const body = await callRisksGet();

    // WITH the fix: the org's rows come through. WITHOUT it: [] / total 0.
    expect(body.pagination.total).toBe(3);
    expect(body.data).toHaveLength(3);
    // Every returned row belongs to Org A (isolation through the chain).
    expect(body.data.every((r) => r.orgId === orgAId)).toBe(true);
    // No Org B row leaked.
    expect(body.data.some((r) => riskBIds.includes(r.id))).toBe(false);
  });

  it("Org B: switching the org context returns ONLY Org B's risks (cross-tenant isolation)", async () => {
    h.sessionUserId = userAId;
    h.sessionEmail = "f01brun@test.dev";
    h.sessionName = "F01bRUN User";
    h.currentOrgId = orgBId;

    const body = await callRisksGet();

    expect(body.pagination.total).toBe(2);
    expect(body.data).toHaveLength(2);
    expect(body.data.every((r) => r.orgId === orgBId)).toBe(true);
    expect(body.data.some((r) => riskAIds.includes(r.id))).toBe(false);
  });

  it("Org A: POST create succeeds via withAuditContext transaction on the reserved connection (regression: this.client.begin is not a function)", async () => {
    h.sessionUserId = userAId;
    h.sessionEmail = "f01brun@test.dev";
    h.sessionName = "F01bRUN User";
    h.roles = [{ orgId: orgAId, role: "admin" }];
    h.currentOrgId = orgAId;

    const title = `F01bRUN Created ${suffix}`;
    const res = await callRisksPost(title);
    const body = (await res.json()) as {
      data?: { id?: string; orgId?: string; title?: string };
    };

    // Without begin/savepoint on the reserved connection this is a 500
    // ("this.client.begin is not a function"). With the fix it is a 201 and the
    // whole workItem+risk transaction committed on the pinned connection.
    expect(res.status, JSON.stringify(body)).toBe(201);
    expect(body.data?.id).toBeTruthy();
    expect(body.data?.orgId).toBe(orgAId);
    expect(body.data?.title).toBe(title);
    if (body.data?.id) createdRiskIds.push(body.data.id);
  });
});
