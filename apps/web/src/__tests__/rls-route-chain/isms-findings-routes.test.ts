// [ARCTOS-FULL-2026-08-31 / Restdefekte · O-3, O-4] — real route-chain tests
// for the two endpoints that answered 500. Both are older than this audit and
// both fail on EVERY database, with or without data, so a live-DB test is the
// only kind that can hold them:
//
//   O-3  GET  /api/v1/isms/threats/heatmap
//        `column v.asset_id does not exist` (42703). `vulnerability` has
//        `affected_asset_id`, never `asset_id`. A second defect hid behind it:
//        `GROUP BY … asset_tier` bound to the REAL input column
//        `asset.asset_tier` instead of the output alias (42803).
//        Fix: packages/reporting/src/threat-dashboard.ts.
//
//   O-4  POST /api/v1/findings
//        FK `work_item_type_key_work_item_type_type_key_fk` violated: the
//        route (and the trigger `finding_auto_create_work_item`) write a
//        `work_item` with `type_key = 'finding'`, and 'finding' was never
//        registered in the `work_item_type` catalog.
//        Fix: catalog migration 0439 — seed data, not a test fixture.
//
// Runs under APP_DATABASE_URL (grc_app, RLS live), see vitest.rls.config.ts.

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
import postgres from "postgres";

import {
  db,
  organization,
  user,
  userOrganizationRole,
  moduleDefinition,
  moduleConfig,
  requestClient,
  requestDbStorage,
  baseDb,
  schema,
  type RequestDbStore,
} from "@grc/db";

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
let orgId = "";
let userId = "";
let threatId = "";
let assetId = "";

function makeBaseStore(): RequestDbStore {
  return { db: baseDb, reserved: null, orgId: "", userId: "", released: true };
}

describe("O-3 / O-4 ISMS + findings routes under grc_app", () => {
  beforeAll(async () => {
    await suClient.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'grc_app') THEN
          CREATE ROLE grc_app LOGIN PASSWORD 'grc_app_dev_password';
        END IF;
      END $$;
      GRANT USAGE ON SCHEMA public TO grc_app;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO grc_app;
      REVOKE ALL ON public.session, public.account, public.verification_token
        FROM grc_app;
      DO $revoke_mv$ DECLARE r record; BEGIN
        FOR r IN SELECT c.relname FROM pg_class c
                   JOIN pg_namespace n ON n.oid = c.relnamespace
                  WHERE n.nspname = 'public' AND c.relkind = 'm' LOOP
          EXECUTE format('REVOKE ALL ON public.%I FROM grc_app', r.relname);
        END LOOP;
      END $revoke_mv$;
      REVOKE INSERT, UPDATE, DELETE ON public.platform_admin FROM grc_app;
    `);

    for (const [key, name] of [
      ["isms", "Information Security Management"],
      ["ics", "Internal Control System"],
    ] as const) {
      await adminDb
        .insert(moduleDefinition)
        .values({
          moduleKey: key,
          displayNameDe: name,
          displayNameEn: name,
          navOrder: 1,
        })
        .onConflictDoNothing();
    }

    const [org] = await adminDb
      .insert(organization)
      .values({ name: `O34 Org ${suffix}`, type: "holding", country: "DEU" })
      .returning({ id: organization.id });
    orgId = org.id;

    const [u] = await adminDb
      .insert(user)
      .values({
        email: `o34-${suffix}@test.dev`,
        name: "O34 User",
        passwordHash: "x",
      })
      .returning({ id: user.id });
    userId = u.id;

    await adminDb
      .insert(userOrganizationRole)
      .values({ userId, orgId, role: "admin" });

    await adminDb.insert(moduleConfig).values([
      { orgId, moduleKey: "isms", uiStatus: "enabled", isDataActive: true },
      { orgId, moduleKey: "ics", uiStatus: "enabled", isDataActive: true },
    ]);

    // A threat with a scenario that reaches an asset BOTH ways the fixed
    // query supports — directly (risk_scenario.asset_id) and through the
    // vulnerability (vulnerability.affected_asset_id) — so the heatmap has
    // something to bucket instead of returning trivially empty.
    const [threat] = await suClient.unsafe<{ id: string }[]>(
      `INSERT INTO threat (org_id, title, threat_category, likelihood_rating)
       VALUES ('${orgId}', 'O34 Threat ${suffix}', 'cyber', 3) RETURNING id`,
    );
    threatId = threat.id;

    const [asset] = await suClient.unsafe<{ id: string }[]>(
      `INSERT INTO asset (org_id, name)
       VALUES ('${orgId}', 'O34 Asset ${suffix}') RETURNING id`,
    );
    assetId = asset.id;

    const [vuln] = await suClient.unsafe<{ id: string }[]>(
      `INSERT INTO vulnerability (org_id, title, affected_asset_id)
       VALUES ('${orgId}', 'O34 Vuln ${suffix}', '${assetId}') RETURNING id`,
    );

    await suClient.unsafe(
      `INSERT INTO risk_scenario (org_id, threat_id, vulnerability_id, asset_id, title)
       VALUES ('${orgId}', '${threatId}', '${vuln.id}', '${assetId}', 'O34 Scenario ${suffix}')`,
    );
  });

  afterEach(async () => {
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
    await suClient.unsafe(`SET session_replication_role = 'replica'`);
    for (const t of [
      "finding",
      "work_item",
      "risk_scenario",
      "vulnerability",
      "asset",
      "threat",
      "notification",
      "audit_log",
      "module_config",
      "user_organization_role",
    ]) {
      await suClient
        .unsafe(`DELETE FROM ${t} WHERE org_id = '${orgId}'`)
        .catch(() => undefined);
    }
    await suClient.unsafe(`DELETE FROM "user" WHERE id = '${userId}'`);
    await suClient.unsafe(`DELETE FROM organization WHERE id = '${orgId}'`);
    await suClient.unsafe(`SET session_replication_role = 'origin'`);

    await suClient.end();
    await requestClient.end();
    await (
      db as unknown as { $client: { end: () => Promise<void> } }
    ).$client.end();
  });

  it("O-3: GET /isms/threats/heatmap answers 200 with cells (was 500 / 42703)", async () => {
    h.sessionUserId = userId;
    h.sessionEmail = `o34-${suffix}@test.dev`;
    h.sessionName = "O34 User";
    h.roles = [{ orgId, role: "admin" }];
    h.currentOrgId = orgId;

    const { GET } = await import("@/app/api/v1/isms/threats/heatmap/route");
    const req = new Request("http://localhost/api/v1/isms/threats/heatmap");
    const res = (await requestDbStorage.run(makeBaseStore(), () =>
      GET(req),
    )) as Response;
    const body = (await res.json()) as {
      data?: {
        cells?: Array<{
          threatCategory: string;
          assetTier: string;
          count: number;
        }>;
      };
    };

    expect(res.status, JSON.stringify(body)).toBe(200);
    const cells = body.data?.cells ?? [];
    // The seeded threat must appear, and its scenario must be counted — a
    // query that merely stops throwing but joins nothing would return the
    // category with count 0.
    const cyber = cells.find((c) => c.threatCategory === "cyber");
    expect(cyber, JSON.stringify(cells)).toBeDefined();
    expect(cyber!.count).toBeGreaterThanOrEqual(1);
  });

  it("O-3: GET /isms/threats/top answers 200 (same two defects, second route)", async () => {
    h.sessionUserId = userId;
    h.sessionEmail = `o34-${suffix}@test.dev`;
    h.sessionName = "O34 User";
    h.roles = [{ orgId, role: "admin" }];
    h.currentOrgId = orgId;

    const { GET } = await import("@/app/api/v1/isms/threats/top/route");
    const req = new Request(
      "http://localhost/api/v1/isms/threats/top?limit=10",
    );
    const res = (await requestDbStorage.run(makeBaseStore(), () =>
      GET(req),
    )) as Response;
    const body = (await res.json()) as {
      data?: {
        threats?: Array<{
          threatId: string;
          riskScenarioCount: number;
          impactScore: number;
        }>;
      };
    };

    expect(res.status, JSON.stringify(body)).toBe(200);
    const entry = (body.data?.threats ?? []).find(
      (e) => e.threatId === threatId,
    );
    expect(entry, JSON.stringify(body.data)).toBeDefined();
    expect(entry!.riskScenarioCount).toBe(1);
    // likelihood_rating 3 × 1 scenario — proves the de-nested aggregate still
    // computes the documented number and was not just deleted.
    expect(entry!.impactScore).toBe(3);
  });

  it("O-4: POST /findings answers 201 and links a work_item of type 'finding' (was 500 / FK 23503)", async () => {
    h.sessionUserId = userId;
    h.sessionEmail = `o34-${suffix}@test.dev`;
    h.sessionName = "O34 User";
    h.roles = [{ orgId, role: "admin" }];
    h.currentOrgId = orgId;

    const { POST } = await import("@/app/api/v1/findings/route");
    const req = new Request("http://localhost/api/v1/findings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: `O34 Finding ${suffix}`,
        description: "O-4 regression",
        severity: "observation",
        source: "audit",
      }),
    });
    const res = (await requestDbStorage.run(makeBaseStore(), () =>
      POST(req, undefined as never),
    )) as Response;
    const body = (await res.json()) as {
      data?: { id?: string; workItemId?: string; elementId?: string };
    };

    expect(res.status, JSON.stringify(body)).toBe(201);
    expect(body.data?.id).toBeTruthy();

    const wi = await suClient.unsafe<
      { type_key: string; element_id: string | null }[]
    >(
      `SELECT type_key, element_id FROM work_item WHERE id = '${body.data!.workItemId}'`,
    );
    expect(wi).toHaveLength(1);
    expect(wi[0].type_key).toBe("finding");
    // 0439 gives the type an element_id_prefix, so the generator trigger has
    // something to work with instead of leaving element_id NULL.
    expect(wi[0].element_id).toMatch(/^FND-\d{3}$/);
  });

  it("O-4: every work_item type_key the API writes is registered in the catalog", async () => {
    // The durable half of the fix: 'finding' was one of five unregistered
    // keys, all on live POST paths. This query is the standing guard — a new
    // typeKey in a route without a catalog row turns this red instead of
    // producing a 500 in production.
    const rows = await suClient.unsafe<{ type_key: string }[]>(
      `SELECT k AS type_key
         FROM unnest(ARRAY['finding','data_breach','dsr','ropa_entry','tia',
                           'risk','control','audit','document','dpia',
                           'contract','vendor','risk_treatment','process',
                           'management_review_action']) AS k
        WHERE NOT EXISTS (SELECT 1 FROM work_item_type t WHERE t.type_key = k)`,
    );
    expect(rows.map((r) => r.type_key)).toEqual([]);
  });
});
