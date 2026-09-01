// [ARCTOS-FULL-2026-08-31 / WP9 · S10-09, S10-10, S10-13]
//
// Integration test against a REAL PostgreSQL. The three acceptance criteria
// of this work package that cannot be shown with a mocked `@grc/db`:
//
//   * two parallel runs of the same job execute it exactly once
//     (advisory lock — the audit measured 0 locks in 128 jobs);
//   * a job that fails midway through a set leaves no inconsistent state
//     (transaction — 3 of 128 jobs used one);
//   * a repeated notification is written once, not once per run
//     (dedupe key + partial unique index from migration 0435).
//
// These are exactly the situations that produced the pre-fix behaviour, so
// each `expect` below fails on the old code.
//
// Requires DATABASE_URL (or APP_DATABASE_URL) to point at a migrated
// database. CI must set it — see "Bedarf an andere Pakete" in
// /work/audit/remediation/WP9.md.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import postgres from "postgres";
import { randomUUID } from "crypto";

const URL = process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL;

const suite = URL ? describe : describe.skip;

suite("worker job runtime against PostgreSQL", () => {
  let sql: ReturnType<typeof postgres>;
  let withJobLock: typeof import("../../src/lib/job-runtime").withJobLock;
  let withOrgContext: typeof import("../../src/lib/job-runtime").withOrgContext;
  let insertNotification: typeof import("../../src/lib/notify").insertNotification;
  let orgId: string;
  let userId: string;

  beforeAll(async () => {
    sql = postgres(URL!, { max: 4 });
    const rt = await import("../../src/lib/job-runtime");
    withJobLock = rt.withJobLock;
    withOrgContext = rt.withOrgContext;
    insertNotification = (await import("../../src/lib/notify"))
      .insertNotification;

    // Fixture, found-or-created under a fixed name. It is deliberately NOT
    // deleted afterwards: WP4 made `audit_log` append-only, and the INSERT
    // trigger on `organization` writes a row holding a foreign key on it —
    // so a created organisation can never be removed again. Reusing the same
    // fixture keeps repeated runs from accumulating orgs. The only rows this
    // suite adds and removes are notifications.
    const FIXTURE_ORG = "ARCTOS WP9 test fixture";
    const FIXTURE_EMAIL = "wp9-fixture@example.invalid";

    const [existingOrg] = await sql<{ id: string }[]>`
      SELECT id FROM organization WHERE name = ${FIXTURE_ORG} LIMIT 1`;
    orgId =
      existingOrg?.id ??
      (
        await sql<{ id: string }[]>`
          INSERT INTO organization (name) VALUES (${FIXTURE_ORG}) RETURNING id`
      )[0].id;

    const [existingUser] = await sql<{ id: string }[]>`
      SELECT id FROM "user" WHERE email = ${FIXTURE_EMAIL} LIMIT 1`;
    userId =
      existingUser?.id ??
      (
        await sql<{ id: string }[]>`
          INSERT INTO "user" (email, name, is_active)
          VALUES (${FIXTURE_EMAIL}, 'WP9 fixture', true) RETURNING id`
      )[0].id;
  }, 60_000);

  afterAll(async () => {
    if (!URL) return;
    if (orgId) {
      // Only what this suite wrote.
      await sql`DELETE FROM notification
                 WHERE org_id = ${orgId}::uuid
                   AND (title LIKE 'WP9 %' OR title LIKE '%WP9 dedupe probe')`;
    }
    await sql.end({ timeout: 5 });
    const { baseClient } = await import("@grc/db");
    await baseClient.end({ timeout: 5 });
  }, 60_000);

  // ── S10-09 ─────────────────────────────────────────────────────────
  it("runs a job exactly once when two runs start in parallel", async () => {
    let executions = 0;
    const body = async () => {
      executions++;
      // Hold the lock long enough that the second call is guaranteed to
      // arrive while it is held.
      await new Promise((r) => setTimeout(r, 300));
      return "done";
    };

    const lock = `wp9-test-${orgId}`;
    const [a, b] = await Promise.all([
      withJobLock(lock, body),
      new Promise<Awaited<ReturnType<typeof withJobLock>>>((resolve) =>
        setTimeout(() => resolve(withJobLock(lock, body)), 50),
      ).then((p) => p),
    ]);

    expect(executions).toBe(1);
    const skipped = [a, b].filter((r) => r.skipped);
    expect(skipped).toHaveLength(1);
  }, 30_000);

  it("releases the lock so a later run can take it", async () => {
    const lock = `wp9-test-serial-${orgId}`;
    const first = await withJobLock(lock, async () => 1);
    const second = await withJobLock(lock, async () => 2);
    expect(first.skipped).toBe(false);
    expect(second.skipped).toBe(false);
  }, 30_000);

  // ── S10-13 ─────────────────────────────────────────────────────────
  it("leaves no partial state when a job fails midway through a set", async () => {
    const before = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM notification
       WHERE org_id = ${orgId}::uuid AND title LIKE 'WP9 atomicity probe%'`;

    await expect(
      withOrgContext(orgId, async (tx) => {
        await insertNotification(
          {
            orgId,
            userId,
            type: "deadline_approaching",
            title: "WP9 atomicity probe A",
            channel: "in_app",
          },
          { job: "wp9-test", tx, dedupeWindow: "none" },
        );
        await insertNotification(
          {
            orgId,
            userId,
            type: "deadline_approaching",
            title: "WP9 atomicity probe B",
            channel: "in_app",
          },
          { job: "wp9-test", tx, dedupeWindow: "none" },
        );
        throw new Error("simulated failure after the first writes");
      }),
    ).rejects.toThrow(/simulated failure/);

    const after = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM notification
       WHERE org_id = ${orgId}::uuid AND title LIKE 'WP9 atomicity probe%'`;
    // Pre-fix, these two inserts were separate statements and the first
    // would have survived the failure of the second.
    expect(after[0].n).toBe(before[0].n);
  }, 30_000);

  it("sets the org context transaction-locally and does not leak it", async () => {
    const inside = await withOrgContext(orgId, async (tx) => {
      const rows = (await tx.execute(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (await import("drizzle-orm"))
          .sql`SELECT current_setting('app.current_org_id', true) AS v`,
      )) as unknown as Array<{ v: string | null }>;
      return rows[0]?.v ?? null;
    });
    expect(inside).toBe(orgId);

    // S10-14: the old code used session scope on the SHARED pool, so the
    // value stayed on the connection and poisoned later context-less
    // queries. A fresh connection must see nothing.
    const [after] = await sql<{ v: string | null }[]>`
      SELECT current_setting('app.current_org_id', true) AS v`;
    expect(after.v === null || after.v === "").toBe(true);
  }, 30_000);

  // ── S10-10 ─────────────────────────────────────────────────────────
  it("writes a repeated reminder once, not once per run", async () => {
    const probeEntityId = randomUUID();
    const values = {
      orgId,
      userId,
      type: "deadline_approaching" as const,
      entityType: "risk",
      // A fresh entity id per run so a leftover row from an earlier run
      // cannot make this pass for the wrong reason.
      entityId: probeEntityId,
      title: "Risk review upcoming: WP9 dedupe probe",
      channel: "in_app" as const,
    };

    const results: boolean[] = [];
    for (let day = 0; day < 5; day++) {
      results.push(await insertNotification(values, { job: "wp9-test" }));
    }

    // Pre-fix this loop produced five identical rows — the audit's
    // "15 identical reminders for one risk" finding.
    expect(results.filter(Boolean)).toHaveLength(1);

    const [{ n }] = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM notification
       WHERE org_id = ${orgId}::uuid
         AND title = ${values.title}
         AND entity_id = ${probeEntityId}::uuid`;
    expect(n).toBe(1);
  }, 30_000);

  it("still writes when the caller opts out of dedup", async () => {
    const values = {
      orgId,
      userId,
      type: "escalation" as const,
      title: "WP9 no-dedupe probe",
      channel: "in_app" as const,
    };
    expect(
      await insertNotification(values, {
        job: "wp9-test",
        dedupeWindow: "none",
      }),
    ).toBe(true);
    expect(
      await insertNotification(values, {
        job: "wp9-test",
        dedupeWindow: "none",
      }),
    ).toBe(true);
  }, 30_000);
});
