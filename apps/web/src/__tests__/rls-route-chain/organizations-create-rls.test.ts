// [ARCTOS-FULL-2026-08-31 / Restdefekte · O-2] — real route-chain test for
// `POST /api/v1/organizations` under the non-superuser runtime role `grc_app`.
//
// THE DEFECT. `organization` carried only `org_isolation_modify`
// (`FOR ALL USING (id = <app.current_org_id>)`, no WITH CHECK of its own).
// PostgreSQL uses the USING expression of a FOR-ALL policy as its WITH CHECK,
// and a BRAND-NEW organization can never satisfy `id = current_org`. Every
// tenant creation therefore failed with SQLSTATE 42501 — and since WP2 makes
// `grc_app` mandatory in production (`assertRuntimeRoleIsolation()`), tenant
// creation through the API was impossible.
//
// THE DECISION (migration 0438, consistent with WP3/S02-03):
//   * platform administrator            → may create ANY organization;
//   * organization administrator        → may create a SUBSIDIARY of the org
//                                         they are acting in, nothing else.
//
// WHAT THIS TEST PROVES, in both directions and at both layers:
//   1. entitled  → the organization actually comes into existence, with its
//      admin grant and its module rows (the whole POST body, not just a 201);
//   2. unentitled → refused;
//   3. the DATABASE is the control, not the handler: a direct INSERT as
//      `grc_app` in the tenant's context is refused by RLS as well, so
//      deleting the handler check would change the status code and not the
//      authorization.
//
// Runs under APP_DATABASE_URL (grc_app, RLS live) like the other files in
// this directory — see vitest.rls.config.ts.

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

const APP_URL = process.env.APP_DATABASE_URL!; // [OP-170] kein Rueckfallwert: setup-require-roles.ts erzwingt ihn

const suffix = Date.now();
let parentOrgId = "";
let tenantUserId = "";
let platformUserId = "";
const createdOrgIds: string[] = [];

function makeBaseStore(): RequestDbStore {
  return { db: baseDb, reserved: null, orgId: "", userId: "", released: true };
}

async function callOrgPost(
  payload: Record<string, unknown>,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const { POST } = await import("@/app/api/v1/organizations/route");
  const req = new Request("http://localhost/api/v1/organizations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const res = (await requestDbStorage.run(makeBaseStore(), () =>
    POST(req, undefined as never),
  )) as Response;
  return {
    status: res.status,
    body: (await res.json()) as Record<string, unknown>,
  };
}

describe("O-2 POST /api/v1/organizations under grc_app", () => {
  beforeAll(async () => {
    await suClient.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'grc_app') THEN
          CREATE ROLE grc_app LOGIN PASSWORD 'grc_app_dev_password';
        END IF;
      END $$;
      GRANT USAGE ON SCHEMA public TO grc_app;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO grc_app;
      -- Same restore as the other files in this directory: the blanket GRANT
      -- above would otherwise permanently lift the deny-all on the Auth.js
      -- token tables (0392) and the materialized views (0393).
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

    // At least one "included" module so the auto-activation branch of the
    // handler has something to insert.
    await adminDb
      .insert(moduleDefinition)
      .values({
        moduleKey: "erm",
        displayNameDe: "Enterprise Risk Management",
        displayNameEn: "Enterprise Risk Management",
        navOrder: 1,
      })
      .onConflictDoNothing();

    const [parent] = await adminDb
      .insert(organization)
      .values({
        name: `O2 Parent ${suffix}`,
        type: "holding",
        country: "DEU",
      })
      .returning({ id: organization.id });
    parentOrgId = parent.id;
    createdOrgIds.push(parentOrgId);

    const [tenantUser] = await adminDb
      .insert(user)
      .values({
        email: `o2-tenant-${suffix}@test.dev`,
        name: "O2 Tenant Admin",
        passwordHash: "x",
      })
      .returning({ id: user.id });
    tenantUserId = tenantUser.id;

    const [platformUser] = await adminDb
      .insert(user)
      .values({
        email: `o2-platform-${suffix}@test.dev`,
        name: "O2 Platform Admin",
        passwordHash: "x",
      })
      .returning({ id: user.id });
    platformUserId = platformUser.id;

    await adminDb.insert(userOrganizationRole).values([
      { userId: tenantUserId, orgId: parentOrgId, role: "admin" },
      { userId: platformUserId, orgId: parentOrgId, role: "admin" },
    ]);

    // Platform-admin grant is an operator action at the DB prompt — there is
    // deliberately no API path for it (WP3/S02-03), so the test does it the
    // same way `deploy/setup.sh` documents.
    await suClient.unsafe(
      `INSERT INTO platform_admin (user_id, reason)
       VALUES ('${platformUserId}', 'O-2 route-chain test')
       ON CONFLICT (user_id) DO NOTHING`,
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
    const ids = createdOrgIds.map((id) => `'${id}'`).join(",");
    if (ids) {
      await suClient.unsafe(`DELETE FROM audit_log WHERE org_id IN (${ids})`);
      await suClient.unsafe(
        `DELETE FROM module_config WHERE org_id IN (${ids})`,
      );
      await suClient.unsafe(
        `DELETE FROM user_organization_role WHERE org_id IN (${ids})`,
      );
    }
    await suClient.unsafe(
      `DELETE FROM platform_admin WHERE user_id = '${platformUserId}'`,
    );
    await suClient.unsafe(
      `DELETE FROM "user" WHERE id IN ('${tenantUserId}', '${platformUserId}')`,
    );
    if (ids) {
      // Children first: parent_org_id is a real FK.
      await suClient.unsafe(
        `DELETE FROM organization WHERE parent_org_id IN (${ids})`,
      );
      await suClient.unsafe(`DELETE FROM organization WHERE id IN (${ids})`);
    }
    await suClient.unsafe(`SET session_replication_role = 'origin'`);

    await suClient.end();
    await requestClient.end();
    await (
      db as unknown as { $client: { end: () => Promise<void> } }
    ).$client.end();
  });

  it("entitled — an org admin creates a SUBSIDIARY of the active org: 201, row + admin grant + modules", async () => {
    h.sessionUserId = tenantUserId;
    h.sessionEmail = `o2-tenant-${suffix}@test.dev`;
    h.sessionName = "O2 Tenant Admin";
    h.roles = [{ orgId: parentOrgId, role: "admin" }];
    h.currentOrgId = parentOrgId;

    const name = `O2 Subsidiary ${suffix}`;
    const { status, body } = await callOrgPost({
      name,
      type: "subsidiary",
      country: "DEU",
      parentOrgId,
    });

    // RED before migration 0438: 500 out of withErrorHandler, because the
    // INSERT hit `new row violates row-level security policy`.
    expect(status, JSON.stringify(body)).toBe(201);
    const data = body.data as { id: string; name: string; parentOrgId: string };
    expect(data?.id).toBeTruthy();
    createdOrgIds.push(data.id);
    expect(data.name).toBe(name);
    expect(data.parentOrgId).toBe(parentOrgId);

    // The row really exists — read back with the superuser handle, not the
    // handler's own answer.
    const rows = await suClient.unsafe<
      { id: string; parent_org_id: string | null }[]
    >(`SELECT id, parent_org_id FROM organization WHERE id = '${data.id}'`);
    expect(rows).toHaveLength(1);
    expect(rows[0].parent_org_id).toBe(parentOrgId);

    // …and so do the two follow-up writes, which are the reason the handler
    // has to switch the org context inside the transaction: both target the
    // NEW org and would be refused under the caller's context.
    const grants = await suClient.unsafe<{ role: string }[]>(
      `SELECT role FROM user_organization_role
        WHERE org_id = '${data.id}' AND user_id = '${tenantUserId}'`,
    );
    expect(grants.map((g) => g.role)).toContain("admin");

    const modules = await suClient.unsafe<{ cnt: string }[]>(
      `SELECT count(*)::text AS cnt FROM module_config WHERE org_id = '${data.id}'`,
    );
    expect(Number(modules[0].cnt)).toBeGreaterThan(0);
  });

  it("unentitled — the same org admin creates a ROOT tenant: 403, and nothing is written", async () => {
    h.sessionUserId = tenantUserId;
    h.sessionEmail = `o2-tenant-${suffix}@test.dev`;
    h.sessionName = "O2 Tenant Admin";
    h.roles = [{ orgId: parentOrgId, role: "admin" }];
    h.currentOrgId = parentOrgId;

    const name = `O2 Rogue Root ${suffix}`;
    const { status, body } = await callOrgPost({
      name,
      type: "holding",
      country: "DEU",
    });

    expect(status, JSON.stringify(body)).toBe(403);
    const rows = await suClient.unsafe<{ id: string }[]>(
      `SELECT id FROM organization WHERE name = '${name}'`,
    );
    expect(rows).toHaveLength(0);
  });

  it("unentitled — an org admin hangs a new org under a FOREIGN org: 403", async () => {
    // A second root org the tenant has no role in.
    const [foreign] = await adminDb
      .insert(organization)
      .values({
        name: `O2 Foreign ${suffix}`,
        type: "holding",
        country: "AUT",
      })
      .returning({ id: organization.id });
    createdOrgIds.push(foreign.id);

    h.sessionUserId = tenantUserId;
    h.sessionEmail = `o2-tenant-${suffix}@test.dev`;
    h.sessionName = "O2 Tenant Admin";
    h.roles = [{ orgId: parentOrgId, role: "admin" }];
    h.currentOrgId = parentOrgId;

    const name = `O2 Foreign Child ${suffix}`;
    const { status } = await callOrgPost({
      name,
      type: "subsidiary",
      country: "DEU",
      parentOrgId: foreign.id,
    });

    expect(status).toBe(403);
    const rows = await suClient.unsafe<{ id: string }[]>(
      `SELECT id FROM organization WHERE name = '${name}'`,
    );
    expect(rows).toHaveLength(0);
  });

  it("entitled — a PLATFORM administrator creates a new root tenant: 201", async () => {
    h.sessionUserId = platformUserId;
    h.sessionEmail = `o2-platform-${suffix}@test.dev`;
    h.sessionName = "O2 Platform Admin";
    h.roles = [{ orgId: parentOrgId, role: "admin" }];
    h.currentOrgId = parentOrgId;

    const name = `O2 New Tenant ${suffix}`;
    const { status, body } = await callOrgPost({
      name,
      type: "holding",
      country: "DEU",
    });

    expect(status, JSON.stringify(body)).toBe(201);
    const data = body.data as { id: string; parentOrgId: string | null };
    createdOrgIds.push(data.id);
    expect(data.parentOrgId ?? null).toBeNull();

    const rows = await suClient.unsafe<{ id: string }[]>(
      `SELECT id FROM organization WHERE id = '${data.id}'`,
    );
    expect(rows).toHaveLength(1);
  });

  it("the DATABASE is the control: a direct INSERT as grc_app is refused for a root org and allowed for a subsidiary", async () => {
    const appClient = postgres(APP_URL, { max: 1 });
    try {
      await appClient.unsafe(
        `SELECT set_config('app.current_org_id', '${parentOrgId}', false),
                set_config('app.current_user_id', '${tenantUserId}', false)`,
      );

      // Root org — refused by `organization_create` (and by
      // `org_isolation_modify`, which can never accept a new row).
      await expect(
        appClient.unsafe(
          `INSERT INTO organization (name, type, country)
           VALUES ('O2 Direct Root ${suffix}', 'holding', 'DEU')`,
        ),
      ).rejects.toMatchObject({ code: "42501" });

      // Subsidiary of the active org — accepted. Deliberately WITHOUT
      // `RETURNING`: reading the new row back in the same statement would
      // have to satisfy the SELECT policy `org_isolation_select`
      // (`id = current_org`), which a brand-new row cannot — the reason the
      // handler generates the id itself and reads the row back under the new
      // org's own context.
      await appClient.unsafe(
        `INSERT INTO organization (name, type, country, parent_org_id)
         VALUES ('O2 Direct Sub ${suffix}', 'subsidiary', 'DEU', '${parentOrgId}')`,
      );
      const inserted = await suClient.unsafe<{ id: string }[]>(
        `SELECT id FROM organization WHERE name = 'O2 Direct Sub ${suffix}'`,
      );
      expect(inserted).toHaveLength(1);
      createdOrgIds.push(inserted[0].id);
    } finally {
      await appClient.end();
    }
  });
});
