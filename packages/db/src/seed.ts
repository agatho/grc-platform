// Seed: Demo holding + subsidiary + admin user
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

async function seed() {
  console.log("Seeding database...");

  await db.transaction(async (tx) => {
    // 1. Create holding (top-level org)
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
    // SET doesn't support parameterized queries, use sql.raw for the UUID value
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
  });

  console.log("Seed complete.");

  await client.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
