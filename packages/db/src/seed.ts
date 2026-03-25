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
    await tx.execute(sql`SELECT set_config('app.current_org_id', ${holdingId}, true)`);

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
      .onConflictDoNothing({ target: [user.email] })
      .returning();

    let adminId: string;
    if (admin) {
      adminId = admin.id;
      console.log(`  Admin user: ${adminId} (${admin.email})`);

      // 4. Assign admin role in both organizations
      await tx.insert(userOrganizationRole).values([
        { userId: adminId, orgId: holdingId, role: "admin", lineOfDefense: "first", department: "IT" },
        { userId: adminId, orgId: subsidiaryId, role: "admin", lineOfDefense: "first", department: "IT" },
      ]).onConflictDoNothing();
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

        console.log(`  DPO user ${sub.orgCode}: ${dpoUser.id} (${dpoEmailLocal})`);

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
  });

  console.log("Seed complete.");

  await client.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
