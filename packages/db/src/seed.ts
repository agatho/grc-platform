// Seed: Demo holding + subsidiaries + admin user + DPO users
// Run: npm run db:seed (from packages/db or root)

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import { hash } from "bcryptjs";
import { randomBytes } from "crypto";
import { organization, user, userOrganizationRole } from "./schema/platform";

// ════════════════════════════════════════════════════════════════════
// #WP3-S02-01 (Critical) — Environment-Guard und Erstpasswortzwang
// ════════════════════════════════════════════════════════════════════
//
// Befund: dieser Seed legte `admin@arctos.dev` mit dem hartkodierten Passwort
// `admin123` an — ohne jeden Environment-Guard
// (`grep -n "NODE_ENV|production|ALLOW_SEED" packages/db/src/seed.ts` → keine
// Treffer) — und `deploy/.env.production.example:48` setzte `RUN_SEEDS=true`,
// während `deploy/setup.sh:88` und `deploy/create-tenant.sh:267` die
// Zugangsdaten als dokumentierten Produktions-Login ausgaben. Zusammen mit dem
// öffentlichen Repository (BASE-001) war das ein direkter
// Authentifizierungs-Bypass auf jeder Instanz, deren Betreiber den manuellen
// Rotationsschritt nicht ausgeführt hatte. `SECURITY.md:34` behauptete, die
// Kennung werde "only seeded into demo tenants" — die Deploy-Skripte
// widerlegten das.
//
// Drei Änderungen:
//   1. Der Seed VERWEIGERT den Lauf in Produktion, sofern nicht ausdrücklich
//      `ALLOW_PRODUCTION_SEED=true` gesetzt ist.
//   2. Es gibt kein hartkodiertes Passwort mehr. Entweder der Betreiber setzt
//      `SEED_ADMIN_PASSWORD`, oder es wird ein Zufallspasswort erzeugt und
//      EINMALIG auf stdout ausgegeben.
//   3. Jedes geseedete Konto bekommt `must_change_password = true`; der Login
//      erzwingt die Änderung, bevor irgendetwas anderes möglich ist.

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const ALLOW_PRODUCTION_SEED = process.env.ALLOW_PRODUCTION_SEED === "true";

function assertSeedAllowed(): void {
  if (IS_PRODUCTION && !ALLOW_PRODUCTION_SEED) {
    console.error(
      [
        "",
        "REFUSING TO SEED: NODE_ENV=production.",
        "",
        "This seed creates demo organizations and demo accounts. Running it",
        "against a production database was the root cause of finding S02-01",
        "(default admin with a known password on every documented production",
        "install).",
        "",
        "If you really want demo data in this environment, set",
        "ALLOW_PRODUCTION_SEED=true explicitly — and set SEED_ADMIN_PASSWORD",
        "to a value only you know.",
        "",
      ].join("\n"),
    );
    process.exit(1);
  }
}

/**
 * Password for a seeded account: the operator-supplied one, or a fresh random
 * one that is printed exactly once. Never a constant.
 */
function seedPassword(envVar: string, label: string): string {
  const supplied = process.env[envVar];
  if (supplied && supplied.length >= 12) return supplied;
  if (supplied) {
    console.error(
      `${envVar} is set but shorter than 12 characters — refusing.`,
    );
    process.exit(1);
  }
  const generated = randomBytes(18).toString("base64url");
  console.log(
    `  GENERATED PASSWORD for ${label}: ${generated}  ` +
      "(shown once; the account must change it at first login)",
  );
  return generated;
}

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

// Subsidiary definitions (fictional names)
const subsidiaries = [
  {
    name: "Arctis Textilservice GmbH",
    shortName: "Arctis Textil",
    orgCode: "ARC-TX",
    legalForm: "GmbH",
    dpoName: "Dr. Thomas Berger",
    dpoEmail: "dpo@arctis-textil.example.com",
  },
  {
    name: "Borealis Workwear International AG",
    shortName: "Borealis WW",
    orgCode: "ARC-WW",
    legalForm: "AG",
    dpoName: "Dr. Maria Weber",
    dpoEmail: "dpo@borealis-ww.example.com",
  },
  {
    name: "Polaris Hygiene Solutions GmbH",
    shortName: "Polaris Hygiene",
    orgCode: "ARC-HY",
    legalForm: "GmbH",
    dpoName: "Dr. Stefan Hoffmann",
    dpoEmail: "dpo@polaris-hygiene.example.com",
  },
  {
    name: "Vega Fire Safety GmbH",
    shortName: "Vega FS",
    orgCode: "ARC-FS",
    legalForm: "GmbH",
    dpoName: "Dr. Claudia Fischer",
    dpoEmail: "dpo@vega-fs.example.com",
  },
  {
    name: "Astra Cleanroom Technologies GmbH",
    shortName: "Astra CR",
    orgCode: "ARC-CR",
    legalForm: "GmbH",
    dpoName: "Dr. Andreas Krause",
    dpoEmail: "dpo@astra-cr.example.com",
  },
];

async function seed() {
  assertSeedAllowed();
  console.log("Seeding database...");

  await db.transaction(async (tx) => {
    // ── 1. Create Meridian holding (idempotent) ─────────────
    let holdingId: string;
    const existingHolding = await tx.execute<{ id: string }>(sql`
      SELECT id FROM organization WHERE name = 'Meridian Holdings GmbH' AND deleted_at IS NULL LIMIT 1
    `);
    if (existingHolding[0]) {
      holdingId = existingHolding[0].id;
      console.log(`  Holding:    ${holdingId} (exists)`);
    } else {
      const [holding] = await tx
        .insert(organization)
        .values({
          name: "Meridian Holdings GmbH",
          shortName: "Meridian",
          type: "holding",
          country: "DEU",
          isEu: true,
          legalForm: "GmbH",
          settings: { defaultLanguage: "de", mfaRequired: true },
        })
        .returning();
      holdingId = holding.id;
      console.log(`  Holding:    ${holdingId}`);
    }

    // Set org context so audit trigger can resolve org_id for user inserts
    await tx.execute(
      sql`SELECT set_config('app.current_org_id', ${holdingId}, true)`,
    );

    // 2. Create subsidiary (idempotent)
    let subsidiaryId: string;
    const existingSub = await tx.execute<{ id: string }>(sql`
      SELECT id FROM organization WHERE name = 'NovaTec Services GmbH' AND deleted_at IS NULL LIMIT 1
    `);
    if (existingSub[0]) {
      subsidiaryId = existingSub[0].id;
      console.log(`  Subsidiary: ${subsidiaryId} (exists)`);
    } else {
      const [subsidiary] = await tx
        .insert(organization)
        .values({
          name: "NovaTec Services GmbH",
          shortName: "NovaTec",
          type: "subsidiary",
          country: "DEU",
          isEu: true,
          parentOrgId: holdingId,
          legalForm: "GmbH",
          dpoName: "Dr. Eva Schmidt",
          dpoEmail: "dpo@novatec-services.example.com",
          settings: { defaultLanguage: "de", mfaRequired: true },
        })
        .returning();
      subsidiaryId = subsidiary.id;
      console.log(`  Subsidiary: ${subsidiaryId}`);
    }

    // 3. Create admin user (idempotent)
    // #WP3-S02-01: no hardcoded password. Either SEED_ADMIN_PASSWORD, or a
    // random one printed once. `mustChangePassword` forces rotation at first
    // login, so an un-rotated seeded account cannot be used at all.
    const passwordHash = await hash(
      seedPassword("SEED_ADMIN_PASSWORD", "admin@arctos.dev"),
      12,
    );
    const [admin] = await tx
      .insert(user)
      .values({
        email: "admin@arctos.dev",
        name: "Platform Admin",
        passwordHash,
        emailVerified: new Date(),
        language: "de",
        isActive: true,
        // #WP3-S02-01: the account is unusable until the password is changed.
        mustChangePassword: true,
        passwordChangedAt: null,
      })
      .onConflictDoNothing({ target: [user.email] })
      .returning();

    let adminId: string;
    if (admin) {
      adminId = admin.id;
      console.log(`  Admin user: ${adminId} (${admin.email})`);

      // 4. Assign admin role in both organizations
      await tx
        .insert(userOrganizationRole)
        .values([
          {
            userId: adminId,
            orgId: holdingId,
            role: "admin",
            lineOfDefense: "first",
            department: "IT",
          },
          {
            userId: adminId,
            orgId: subsidiaryId,
            role: "admin",
            lineOfDefense: "first",
            department: "IT",
          },
        ])
        .onConflictDoNothing();
      console.log("  Role assignments: admin @ Meridian + NovaTec");
    } else {
      const existingAdmin = await tx.execute<{ id: string }>(sql`
        SELECT id FROM "user" WHERE email = 'admin@arctos.dev' LIMIT 1
      `);
      adminId = existingAdmin[0]!.id;
      console.log(`  Admin user: ${adminId} (exists)`);
    }

    // ── 5. Arctis Group Holding ─────────────────────────────────────
    const existingGroup = await tx.execute<{ id: string }>(sql`
      SELECT id FROM organization WHERE org_code = 'ARC' AND deleted_at IS NULL LIMIT 1
    `);

    let groupHoldingId: string;

    if (existingGroup[0]) {
      groupHoldingId = existingGroup[0].id;
      console.log(`  Arctis Group Holding already exists: ${groupHoldingId}`);
    } else {
      const [groupHolding] = await tx
        .insert(organization)
        .values({
          name: "Arctis Group GmbH",
          shortName: "Arctis",
          type: "holding",
          country: "DEU",
          isEu: true,
          legalForm: "GmbH",
          orgCode: "ARC",
          isDataController: true,
          supervisoryAuthority: "Landesbeauftragte für Datenschutz NRW",
          dataResidency: "DE",
          gdprSettings: { dpiaPeriodMonths: 12, retentionPolicyYears: 10 },
          settings: { defaultLanguage: "de", mfaRequired: true },
        })
        .returning();

      groupHoldingId = groupHolding.id;
      console.log(`  Arctis Group Holding: ${groupHoldingId}`);

      // Admin role for the platform admin
      await tx.insert(userOrganizationRole).values({
        userId: adminId,
        orgId: groupHoldingId,
        role: "admin",
        lineOfDefense: "first",
        department: "IT",
      });
    }

    // ── 6. Subsidiaries + DPO Users ──────────────────────────────
    for (const sub of subsidiaries) {
      // Idempotent: check if org_code already exists
      const existingSub = await tx.execute<{ id: string }>(sql`
        SELECT id FROM organization WHERE org_code = ${sub.orgCode} AND deleted_at IS NULL LIMIT 1
      `);

      if (existingSub[0]) {
        console.log(
          `  ${sub.shortName} already exists (${sub.orgCode}), skipping`,
        );
        continue;
      }

      // Create subsidiary
      const [subOrg] = await tx
        .insert(organization)
        .values({
          name: sub.name,
          shortName: sub.shortName,
          type: "subsidiary",
          country: "DEU",
          isEu: true,
          parentOrgId: groupHoldingId,
          legalForm: sub.legalForm,
          orgCode: sub.orgCode,
          isDataController: true,
          supervisoryAuthority: "Landesbeauftragte für Datenschutz NRW",
          dataResidency: "DE",
          dpoName: sub.dpoName,
          dpoEmail: sub.dpoEmail,
          gdprSettings: { dpiaPeriodMonths: 12, retentionPolicyYears: 10 },
          settings: { defaultLanguage: "de", mfaRequired: true },
        })
        .returning();

      console.log(`  Subsidiary ${sub.orgCode}: ${subOrg.id}`);

      // Create a demo DPO user for each subsidiary
      const dpoEmailLocal = `dpo.${sub.orgCode.toLowerCase().replace("-", "")}@arctos.dev`;
      const dpoPasswordHash = await hash("dpo12345", 12);

      const [dpoUser] = await tx
        .insert(user)
        .values({
          email: dpoEmailLocal,
          name: sub.dpoName,
          passwordHash: dpoPasswordHash,
          emailVerified: new Date(),
          language: "de",
          isActive: true,
          notificationPreferences: {
            emailMode: "immediate",
            quietHoursStart: "20:00",
            quietHoursEnd: "08:00",
          },
        })
        .onConflictDoNothing({ target: [user.email] })
        .returning();

      if (dpoUser) {
        // Assign DPO role in the subsidiary
        await tx.insert(userOrganizationRole).values({
          userId: dpoUser.id,
          orgId: subOrg.id,
          role: "dpo",
          lineOfDefense: "second",
          department: "Data Protection",
        });

        // Set dpoUserId on the organization
        await tx.execute(sql`
          UPDATE organization SET dpo_user_id = ${dpoUser.id}
          WHERE id = ${subOrg.id}
        `);

        console.log(
          `  DPO user ${sub.orgCode}: ${dpoUser.id} (${dpoEmailLocal})`,
        );

        // Also assign admin role at the subsidiary for the platform admin
        await tx.insert(userOrganizationRole).values({
          userId: adminId,
          orgId: subOrg.id,
          role: "admin",
          lineOfDefense: "first",
          department: "IT",
        });
      }
    }

    // ── Seed module_definitions for EVERY key in MODULE_KEYS ──────────
    //
    // [E2E-TRIAGE-2026-09-02] This block used to insert FOUR keys (erm, bpm,
    // esg, whistleblowing) and left the remaining eight of Sprint 4-9 to
    // `sql/seed_module_definitions_sprint4_9.sql`, which only `scripts/
    // setup.sh` applies — via `psql`, best-effort, output discarded. On any
    // environment where that step did not run (no psql on PATH, a different
    // port, a plain `npm run db:seed`), `module_definition` ended up with
    // 11 of the 20 keys in `MODULE_KEYS`, and NOTHING said so.
    //
    // The consequence is not cosmetic. `requireModule(key, orgId)`
    // (packages/auth/src/middleware/module-guard.ts) answers 404 for a key
    // that has no definition row — "don't reveal the module exists" — so the
    // ENTIRE ics / dms / isms / bcms / dpms / audit / tprm / contract API
    // surface answered 404 for every organisation, and `ModuleGate` rendered
    // the "Modul aktivieren" teaser on every page of those modules. Roughly
    // half of the failing E2E suite traces back to exactly this.
    //
    // `db:seed` is `tsx`, runs everywhere, and is the one step every
    // environment performs — so the platform baseline belongs HERE, not in a
    // psql script that may or may not have been applied. The SQL file stays
    // (it also seeds `module_nav_item`); both are ON CONFLICT DO NOTHING, so
    // running either or both is idempotent.
    //
    // Keep this list in sync with MODULE_KEYS in packages/shared/src/modules.ts.
    console.log("  Seeding module definitions (all MODULE_KEYS)...");
    await tx.execute(sql`
      INSERT INTO module_definition (module_key, display_name_de, display_name_en, icon, nav_order, license_tier)
      VALUES
        ('erm', 'Enterprise Risk Management', 'Enterprise Risk Management', 'shield-alert', 20, 'included'),
        ('bpm', 'Prozessmanagement', 'Process Management', 'workflow', 30, 'included'),
        ('ics', 'Internes Kontrollsystem', 'Internal Control System', 'shield-check', 40, 'included'),
        ('dms', 'Dokumentenmanagement', 'Document Management', 'file-text', 45, 'included'),
        ('isms', 'Informationssicherheit', 'Information Security', 'lock', 50, 'included'),
        ('bcms', 'Business Continuity', 'Business Continuity', 'activity', 60, 'included'),
        ('dpms', 'Datenschutz', 'Data Protection', 'eye-off', 70, 'included'),
        ('audit', 'Audit Management', 'Audit Management', 'clipboard-check', 80, 'included'),
        ('tprm', 'Drittparteien-Risiko', 'Third-Party Risk', 'users', 90, 'included'),
        ('contract', 'Vertragsmanagement', 'Contract Management', 'file-signature', 95, 'included'),
        ('esg', 'ESG & Nachhaltigkeit', 'ESG & Sustainability', 'leaf', 100, 'included'),
        ('whistleblowing', 'Hinweisgebersystem', 'Whistleblowing', 'megaphone', 110, 'included'),
        ('reporting', 'Berichtswesen', 'Reporting', 'bar-chart-3', 120, 'included'),
        ('eam', 'Enterprise Architecture', 'Enterprise Architecture', 'network', 130, 'included'),
        ('academy', 'Academy', 'Academy', 'graduation-cap', 140, 'included'),
        ('community', 'Community', 'Community', 'users-round', 150, 'included'),
        ('marketplace', 'Marktplatz', 'Marketplace', 'store', 160, 'included'),
        ('simulations', 'Simulationen', 'Simulations', 'flask-conical', 170, 'included'),
        ('portals', 'Portale', 'Portals', 'door-open', 180, 'included'),
        ('programme', 'Programme', 'Programmes', 'route', 190, 'included')
      ON CONFLICT (module_key) DO NOTHING
    `);

    // A definition row that exists but is not active in the platform is
    // invisible to `requireModule` in exactly the same way. The seed's job is
    // a usable baseline, so make sure the keys it just declared are active.
    await tx.execute(sql`
      UPDATE module_definition SET is_active_in_platform = true
      WHERE is_active_in_platform = false
    `);

    // Fail loudly instead of leaving the same hole open one layer down: if a
    // key from MODULE_KEYS still has no definition after this insert, the
    // guard will 404 that module for every tenant and nobody will notice.
    const missingDefs = await tx.execute<{ module_key: string }>(sql`
      SELECT k AS module_key
      FROM unnest(ARRAY[
        'erm','bpm','ics','dms','isms','bcms','dpms','audit','tprm','contract',
        'esg','whistleblowing','reporting','eam','academy','community',
        'marketplace','simulations','portals','programme'
      ]) AS k
      WHERE NOT EXISTS (SELECT 1 FROM module_definition md WHERE md.module_key = k)
    `);
    if (missingDefs.length > 0) {
      throw new Error(
        "module_definition is incomplete after seeding — missing: " +
          missingDefs.map((r) => r.module_key).join(", ") +
          ". requireModule() answers 404 for every one of these, for every " +
          "organisation.",
      );
    }

    // ── Auto-enable ALL modules for ALL organizations ─────────────────
    console.log("  Enabling all modules for all organizations...");
    const enableResult = await tx.execute(sql`
      INSERT INTO module_config (id, org_id, module_key, ui_status, is_data_active, config, enabled_at, created_at, updated_at)
      SELECT gen_random_uuid(), o.id, md.module_key, 'enabled', true, '{}', now(), now(), now()
      FROM organization o
      CROSS JOIN module_definition md
      WHERE o.deleted_at IS NULL
      ON CONFLICT ON CONSTRAINT module_config_org_module_uq DO NOTHING
    `);
    console.log(`  Module configs enabled: ${enableResult.count} rows`);

    // ── Seed demo users with different roles ──────────────────
    console.log(
      "  Seeding demo users (risk_manager, auditor, control_owner)...",
    );
    // #WP3-S02-01: the demo accounts shared the hardcoded password
    // `arctos2026!`, which is in the public repository just like `admin123`.
    const demoPassword = await hash(
      seedPassword("SEED_DEMO_PASSWORD", "demo accounts (*@arctos.dev)"),
      12,
    );

    const demoUsers = [
      {
        name: "Lisa Schneider",
        email: "risk.manager@arctos.dev",
        role: "risk_manager" as const,
        lod: "second" as const,
        dept: "Risk Management",
      },
      {
        name: "Dr. Michael Braun",
        email: "auditor@arctos.dev",
        role: "auditor" as const,
        lod: "third" as const,
        dept: "Internal Audit",
      },
      {
        name: "Sarah Keller",
        email: "control.owner@arctos.dev",
        role: "control_owner" as const,
        lod: "first" as const,
        dept: "IT Operations",
      },
      {
        name: "Thomas Fischer",
        email: "process.owner@arctos.dev",
        role: "process_owner" as const,
        lod: "first" as const,
        dept: "Operations",
      },
    ];

    for (const demo of demoUsers) {
      const [demoUser] = await tx
        .insert(user)
        .values({
          name: demo.name,
          email: demo.email,
          passwordHash: demoPassword,
          language: "de",
          isActive: true,
          mustChangePassword: true,
        })
        .onConflictDoNothing()
        .returning({ id: user.id });

      if (demoUser) {
        await tx
          .insert(userOrganizationRole)
          .values({
            userId: demoUser.id,
            orgId: holdingId,
            role: demo.role,
            lineOfDefense: demo.lod,
            department: demo.dept,
          })
          .onConflictDoNothing();
        console.log(`    ${demo.role}: ${demoUser.id} (${demo.email})`);
      }
    }
  });

  console.log("Seed complete.");

  await client.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
