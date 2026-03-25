// Seed: Demo holding + subsidiaries + admin user + DPO users
// Run: npm run db:seed (from packages/db or root)

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import { hash } from "bcryptjs";
import {
  organization,
  user,
  userOrganizationRole,
} from "./schema/platform";

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

// Haniel subsidiary definitions
const hanielSubsidiaries = [
  {
    name: "BekaertDeslee (Haniel Beteiligung)",
    shortName: "BekaertDeslee",
    orgCode: "HAN-BS",
    legalForm: "GmbH",
    dpoName: "Dr. Thomas Berger",
    dpoEmail: "dpo@bekaertdeslee-haniel.example.com",
  },
  {
    name: "TAKKT AG (Haniel Beteiligung)",
    shortName: "TAKKT",
    orgCode: "HAN-WW",
    legalForm: "AG",
    dpoName: "Dr. Maria Weber",
    dpoEmail: "dpo@takkt-haniel.example.com",
  },
  {
    name: "CWS-boco International (Haniel)",
    shortName: "CWS-boco",
    orgCode: "HAN-HY",
    legalForm: "GmbH",
    dpoName: "Dr. Stefan Hoffmann",
    dpoEmail: "dpo@cws-haniel.example.com",
  },
  {
    name: "ELG Haniel GmbH",
    shortName: "ELG",
    orgCode: "HAN-FS",
    legalForm: "GmbH",
    dpoName: "Dr. Claudia Fischer",
    dpoEmail: "dpo@elg-haniel.example.com",
  },
  {
    name: "ROVEMA GmbH (Haniel Beteiligung)",
    shortName: "ROVEMA",
    orgCode: "HAN-CR",
    legalForm: "GmbH",
    dpoName: "Dr. Andreas Krause",
    dpoEmail: "dpo@rovema-haniel.example.com",
  },
];

async function seed() {
  console.log("Seeding database...");

  await db.transaction(async (tx) => {
    // ── 1. Create Meridian holding (existing demo org) ─────────────
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

    console.log(`  Holding:    ${holding.id}`);

    // Set org context so audit trigger can resolve org_id for user inserts
    await tx.execute(sql`SELECT set_config('app.current_org_id', ${holding.id}, true)`);

    // 2. Create subsidiary under holding
    const [subsidiary] = await tx
      .insert(organization)
      .values({
        name: "NovaTec Services GmbH",
        shortName: "NovaTec",
        type: "subsidiary",
        country: "DEU",
        isEu: true,
        parentOrgId: holding.id,
        legalForm: "GmbH",
        dpoName: "Dr. Eva Schmidt",
        dpoEmail: "dpo@novatec-services.example.com",
        settings: { defaultLanguage: "de", mfaRequired: true },
      })
      .returning();

    console.log(`  Subsidiary: ${subsidiary.id}`);

    // 3. Create admin user (password: "admin123" — dev only)
    const passwordHash = await hash("admin123", 12);
    const [admin] = await tx
      .insert(user)
      .values({
        email: "admin@arctos.dev",
        name: "Platform Admin",
        passwordHash,
        emailVerified: new Date(),
        language: "de",
        isActive: true,
      })
      .returning();

    console.log(`  Admin user: ${admin.id} (${admin.email})`);

    // 4. Assign admin role in both organizations
    await tx.insert(userOrganizationRole).values([
      {
        userId: admin.id,
        orgId: holding.id,
        role: "admin",
        lineOfDefense: "first",
        department: "IT",
      },
      {
        userId: admin.id,
        orgId: subsidiary.id,
        role: "admin",
        lineOfDefense: "first",
        department: "IT",
      },
    ]);

    console.log("  Role assignments: admin @ Meridian + NovaTec");

    // ── 5. Haniel Holding ──────────────────────────────────────────
    // Check if HAN holding already exists by org_code
    const existingHan = await tx.execute<{ id: string }>(sql`
      SELECT id FROM organization WHERE org_code = 'HAN' AND deleted_at IS NULL LIMIT 1
    `);

    let hanHoldingId: string;

    if (existingHan[0]) {
      hanHoldingId = existingHan[0].id;
      console.log(`  Haniel Holding already exists: ${hanHoldingId}`);
    } else {
      const [hanHolding] = await tx
        .insert(organization)
        .values({
          name: "Franz Haniel & Cie. GmbH",
          shortName: "Haniel",
          type: "holding",
          country: "DEU",
          isEu: true,
          legalForm: "GmbH",
          orgCode: "HAN",
          isDataController: true,
          supervisoryAuthority: "Landesbeauftragte für Datenschutz NRW",
          dataResidency: "DE",
          gdprSettings: { dpiaPeriodMonths: 12, retentionPolicyYears: 10 },
          settings: { defaultLanguage: "de", mfaRequired: true },
        })
        .returning();

      hanHoldingId = hanHolding.id;
      console.log(`  Haniel Holding: ${hanHoldingId}`);

      // Admin role at Haniel for the platform admin
      await tx.insert(userOrganizationRole).values({
        userId: admin.id,
        orgId: hanHoldingId,
        role: "admin",
        lineOfDefense: "first",
        department: "IT",
      });
    }

    // ── 6. Haniel Subsidiaries + DPO Users ─────────────────────────
    for (const sub of hanielSubsidiaries) {
      // Idempotent: check if org_code already exists
      const existingSub = await tx.execute<{ id: string }>(sql`
        SELECT id FROM organization WHERE org_code = ${sub.orgCode} AND deleted_at IS NULL LIMIT 1
      `);

      if (existingSub[0]) {
        console.log(`  ${sub.shortName} already exists (${sub.orgCode}), skipping`);
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
          parentOrgId: hanHoldingId,
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

        console.log(`  DPO user ${sub.orgCode}: ${dpoUser.id} (${dpoEmailLocal})`);

        // Also assign admin role at the subsidiary for the platform admin
        await tx.insert(userOrganizationRole).values({
          userId: admin.id,
          orgId: subOrg.id,
          role: "admin",
          lineOfDefense: "first",
          department: "IT",
        });
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
