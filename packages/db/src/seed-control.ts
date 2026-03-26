// Seed: Sprint 4 — ICS + DMS demo data (controls, documents)
// Run: npx tsx src/seed-control.ts (from packages/db)
// Idempotent: checks for existing data before inserting

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

async function seed() {
  console.log("Seeding Sprint 4 ICS + DMS demo data...");

  // Bypass RLS for seeding
  await db.execute(sql`SET app.bypass_rls = 'true'`);

  // Get first org for seeding
  const orgs = await db.execute(sql`SELECT id FROM organization WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1`);
  if (orgs.length === 0) {
    console.log("No organizations found. Run db:seed first.");
    process.exit(1);
  }
  const orgId = orgs[0].id;

  // Get admin user
  const users = await db.execute(sql`SELECT id FROM "user" WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1`);
  if (users.length === 0) {
    console.log("No users found. Run db:seed first.");
    process.exit(1);
  }
  const userId = users[0].id;

  // ─── Check idempotency ─────────────────────────────────────
  const existingControls = await db.execute(sql`SELECT COUNT(*) as cnt FROM control WHERE org_id = ${orgId}`);
  if (Number(existingControls[0].cnt) > 0) {
    console.log("Control data already exists, skipping seed.");
    await client.end();
    return;
  }

  // ─── 5 Demo Controls ──────────────────────────────────────
  console.log("Inserting 5 demo controls...");

  await db.execute(sql`
    INSERT INTO control (org_id, title, description, control_type, frequency, automation_level, status, assertions, owner_id, department, objective, created_by, updated_by)
    VALUES
    (${orgId}, 'Zugriffsberechtigungsprüfung', 'Vierteljährliche Überprüfung aller Zugriffsberechtigungen für kritische IT-Systeme gemäß ISO 27001 Annex A.9', 'detective', 'quarterly', 'semi_automated', 'effective', '{"completeness","accuracy"}', ${userId}, 'IT Security', 'Sicherstellen, dass nur autorisierte Benutzer Zugriff auf kritische Systeme haben', ${userId}, ${userId}),
    (${orgId}, 'Änderungsmanagement-Freigabe', 'Jede Änderung an Produktionssystemen erfordert eine dokumentierte Genehmigung durch den Change Advisory Board', 'preventive', 'event_driven', 'manual', 'implemented', '{"completeness","existence"}', ${userId}, 'IT Operations', 'Unautorisierte Änderungen an Produktionssystemen verhindern', ${userId}, ${userId}),
    (${orgId}, 'Datensicherung und Wiederherstellung', 'Tägliche automatisierte Sicherung aller geschäftskritischen Daten mit monatlichem Wiederherstellungstest', 'preventive', 'daily', 'fully_automated', 'effective', '{"safeguarding_of_assets","completeness"}', ${userId}, 'IT Infrastructure', 'Geschäftskontinuität durch zuverlässige Datensicherung gewährleisten', ${userId}, ${userId}),
    (${orgId}, 'Rechnungsprüfung Vier-Augen-Prinzip', 'Alle Rechnungen über 10.000 EUR erfordern eine zweite Freigabe durch einen autorisierten Prüfer', 'preventive', 'event_driven', 'manual', 'designed', '{"accuracy","fraud_prevention","obligations_and_rights"}', ${userId}, 'Finance', 'Fehlerhafte oder betrügerische Zahlungen verhindern', ${userId}, ${userId}),
    (${orgId}, 'Sicherheitsvorfallserkennung', 'Automatisierte Erkennung und Alarmierung bei sicherheitsrelevanten Ereignissen mittels SIEM-System', 'detective', 'continuous', 'fully_automated', 'ineffective', '{"existence","completeness"}', ${userId}, 'IT Security', 'Sicherheitsvorfälle zeitnah erkennen und eskalieren', ${userId}, ${userId})
  `);

  // ─── 3 Demo Documents ─────────────────────────────────────
  console.log("Inserting 3 demo documents...");

  await db.execute(sql`
    INSERT INTO document (org_id, title, content, category, status, current_version, requires_acknowledgment, tags, owner_id, created_by, updated_by, published_at)
    VALUES
    (${orgId}, 'Informationssicherheitsrichtlinie', '# Informationssicherheitsrichtlinie

## 1. Zweck
Diese Richtlinie definiert die grundlegenden Anforderungen an die Informationssicherheit gemäß ISO 27001.

## 2. Geltungsbereich
Gilt für alle Mitarbeiter, Auftragnehmer und Dritte mit Zugang zu Informationssystemen.

## 3. Verantwortlichkeiten
Der CISO ist für die Umsetzung und Überwachung dieser Richtlinie verantwortlich.', 'policy', 'published', 1, true, '{"iso27001","isms","security"}', ${userId}, ${userId}, ${userId}, NOW()),
    (${orgId}, 'Verfahrensanweisung Änderungsmanagement', '# Verfahrensanweisung: Änderungsmanagement

## 1. Prozessübersicht
Beschreibt den Ablauf für Änderungen an IT-Systemen vom Antrag bis zur Implementierung.

## 2. Rollen
- Antragsteller: Initiiert den Change Request
- CAB: Bewertet und genehmigt Änderungen
- Implementierer: Führt die genehmigte Änderung durch', 'procedure', 'draft', 1, false, '{"change_management","itil"}', ${userId}, ${userId}, ${userId}, NULL),
    (${orgId}, 'Leitfaden Datenschutz-Folgenabschätzung', '# Leitfaden: Datenschutz-Folgenabschätzung (DSFA)

## 1. Wann ist eine DSFA erforderlich?
Eine DSFA ist durchzuführen, wenn eine Verarbeitung voraussichtlich ein hohes Risiko für die Rechte und Freiheiten natürlicher Personen mit sich bringt (Art. 35 DSGVO).

## 2. Durchführung
Die DSFA folgt einem strukturierten 4-Phasen-Modell.', 'guideline', 'approved', 1, false, '{"gdpr","dsgvo","privacy"}', ${userId}, ${userId}, ${userId}, NULL)
  `);

  // Create initial versions for documents
  const docs = await db.execute(sql`SELECT id, content, title FROM document WHERE org_id = ${orgId} ORDER BY created_at`);
  for (const doc of docs) {
    await db.execute(sql`
      INSERT INTO document_version (document_id, org_id, version_number, content, change_summary, is_current, created_by)
      VALUES (${doc.id}, ${orgId}, 1, ${doc.content}, 'Initial version', true, ${userId})
    `);
  }

  console.log("Sprint 4 seed complete:");
  console.log("  - 5 controls (mixed types, statuses)");
  console.log("  - 3 documents (policy published, procedure draft, guideline approved)");
  console.log("  - 3 document versions (v1 for each document)");

  await client.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
