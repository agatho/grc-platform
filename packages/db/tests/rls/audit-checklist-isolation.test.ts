import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTestDb,
  createAppDb,
  setRlsContext,
  clearRlsContext,
} from "../helpers";

/**
 * RLS Cross-Tenant Isolation — Audit-Checklist-Item (inkl. method_entries jsonb).
 *
 * Overnight-Session Task 5. Verifiziert, dass:
 *   • Org B die audit_checklist-Einträge von Org A nicht sieht
 *   • Org B die audit_checklist_item-Einträge (inkl. method_entries jsonb)
 *     von Org A nicht sieht
 *   • Die GIN-Index-Query `@> '[{"method":"interview"}]'` respektiert RLS
 *
 * Das jsonb-Feld method_entries (Migration 0292) enthält potenziell
 * sensible Details (Interviewpartner, Systemnamen, Sample-IDs).
 */

let adminDb: ReturnType<typeof createTestDb>;
let appDb: ReturnType<typeof createAppDb>;
let orgAId: string;
let orgBId: string;
let userAId: string;
let userBId: string;
let auditAId: string;
let checklistAId: string;
let itemAId: string;
const suffix = Date.now();

describe("RLS Audit-Checklist-Item Isolation (method_entries jsonb)", () => {
  beforeAll(async () => {
    adminDb = createTestDb();

    await adminDb.client.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'grc_app') THEN
          CREATE ROLE grc_app LOGIN PASSWORD 'grc_app_dev_password';
        END IF;
      END $$;
      GRANT USAGE ON SCHEMA public TO grc_app;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO grc_app;
    `);

    appDb = createAppDb();

    // Zwei Test-Orgs + User
    const [orgA] = await adminDb.client<{ id: string }[]>`
      INSERT INTO organization (name, type, country)
      VALUES (${"RLS Audit Org A " + suffix}, 'subsidiary', 'DEU')
      RETURNING id
    `;
    const [orgB] = await adminDb.client<{ id: string }[]>`
      INSERT INTO organization (name, type, country)
      VALUES (${"RLS Audit Org B " + suffix}, 'subsidiary', 'AUT')
      RETURNING id
    `;
    orgAId = orgA.id;
    orgBId = orgB.id;

    const [uA] = await adminDb.client<{ id: string }[]>`
      INSERT INTO "user" (email, name, password_hash)
      VALUES (${"rls-audit-a-" + suffix + "@test.dev"}, 'Audit User A', 'x')
      RETURNING id
    `;
    const [uB] = await adminDb.client<{ id: string }[]>`
      INSERT INTO "user" (email, name, password_hash)
      VALUES (${"rls-audit-b-" + suffix + "@test.dev"}, 'Audit User B', 'x')
      RETURNING id
    `;
    userAId = uA.id;
    userBId = uB.id;

    await adminDb.client`
      INSERT INTO user_organization_role (user_id, org_id, role)
      VALUES (${userAId}, ${orgAId}, 'auditor'),
             (${userBId}, ${orgBId}, 'auditor')
    `;

    // Audit für Org A
    const [audit] = await adminDb.client<{ id: string }[]>`
      INSERT INTO audit (org_id, title, audit_type, status)
      VALUES (${orgAId}, ${"RLS Audit " + suffix}, 'internal', 'fieldwork')
      RETURNING id
    `;
    auditAId = audit.id;

    // Checklist für Org A
    const [cl] = await adminDb.client<{ id: string }[]>`
      INSERT INTO audit_checklist (org_id, audit_id, name, source_type)
      VALUES (${orgAId}, ${auditAId}, ${"RLS Checklist " + suffix}, 'custom')
      RETURNING id
    `;
    checklistAId = cl.id;

    // Checklist-Item für Org A mit method_entries (sensible Details)
    const methodEntriesJson = JSON.stringify([
      {
        id: "entry-rls-1",
        method: "interview",
        interviewee: "Geheim McVertraulich",
        intervieweeRole: "CISO",
      },
      {
        id: "entry-rls-2",
        method: "sampling",
        populationSize: 100,
        sampleSize: 10,
        sampleIds: ["SECRET-001", "SECRET-002"],
      },
    ]);
    const [item] = await adminDb.client<{ id: string }[]>`
      INSERT INTO audit_checklist_item (
        org_id, checklist_id, question, result, method_entries
      )
      VALUES (
        ${orgAId},
        ${checklistAId},
        'RLS-Test: vertrauliche Item-Frage',
        'major_nonconformity',
        ${methodEntriesJson}::jsonb
      )
      RETURNING id
    `;
    itemAId = item.id;
  });

  afterAll(async () => {
    await adminDb.client.unsafe(`SET session_replication_role = 'replica'`);
    await adminDb.client.unsafe(`
      DELETE FROM audit_checklist_item WHERE org_id IN ('${orgAId}', '${orgBId}');
      DELETE FROM audit_checklist WHERE org_id IN ('${orgAId}', '${orgBId}');
      DELETE FROM audit WHERE org_id IN ('${orgAId}', '${orgBId}');
      DELETE FROM user_organization_role WHERE org_id IN ('${orgAId}', '${orgBId}');
      DELETE FROM audit_log WHERE user_id IN ('${userAId}', '${userBId}');
      DELETE FROM "user" WHERE id IN ('${userAId}', '${userBId}');
      DELETE FROM organization WHERE id IN ('${orgAId}', '${orgBId}');
    `);
    await adminDb.client.unsafe(`SET session_replication_role = 'origin'`);
    await appDb.client.end();
    await adminDb.client.end();
  });

  it("Org A sees its own audit_checklist_item with method_entries", async () => {
    await setRlsContext(appDb.client, orgAId);
    const rows = await appDb.client<{ id: string }[]>`
      SELECT id FROM audit_checklist_item WHERE id = ${itemAId}
    `;
    await clearRlsContext(appDb.client);
    expect(rows.length).toBe(1);
  });

  it("Org B does NOT see Org A's audit_checklist_item", async () => {
    await setRlsContext(appDb.client, orgBId);
    const rows = await appDb.client<{ id: string }[]>`
      SELECT id FROM audit_checklist_item WHERE id = ${itemAId}
    `;
    await clearRlsContext(appDb.client);
    expect(rows.length).toBe(0);
  });

  it("Org B does NOT see Org A's audit_checklist via audit_id", async () => {
    await setRlsContext(appDb.client, orgBId);
    const rows = await appDb.client<{ id: string }[]>`
      SELECT id FROM audit_checklist WHERE id = ${checklistAId}
    `;
    await clearRlsContext(appDb.client);
    expect(rows.length).toBe(0);
  });

  it("method_entries jsonb GIN-Query respektiert RLS", async () => {
    // Org B darf nichts finden, auch wenn sie nach dem jsonb-Predikat
    // sucht, das die Org-A-Daten eigentlich treffen würde.
    await setRlsContext(appDb.client, orgBId);
    const rows = await appDb.client<{ id: string }[]>`
      SELECT id
      FROM audit_checklist_item
      WHERE method_entries @> '[{"method":"interview"}]'::jsonb
    `;
    await clearRlsContext(appDb.client);
    // Falls in der Test-DB weitere audit_checklist_items mit Interview-
    // Entries existieren, sind sie entweder Org B oder ein dritter Mandant —
    // das Item aus setup MUSS fehlen.
    expect(rows.map((r) => r.id)).not.toContain(itemAId);
  });

  it("Sensible Detail-Werte aus method_entries leaken nicht an Org B", async () => {
    await setRlsContext(appDb.client, orgBId);
    const rows = await appDb.client<{ entries: unknown }[]>`
      SELECT method_entries AS entries
      FROM audit_checklist_item
      WHERE org_id = ${orgAId}
    `;
    await clearRlsContext(appDb.client);
    // Egal was RLS zurückgibt — es darf keine Zeile mit Org A's Daten sein.
    expect(rows.length).toBe(0);
  });
});
