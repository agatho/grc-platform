// GET /api/v1/platform/module-definitions — List all module definitions
// Any authenticated user can access; no org context needed.

import { db, moduleDefinition } from "@grc/db";
import { asc } from "drizzle-orm";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(moduleDefinition)
    .orderBy(asc(moduleDefinition.navOrder));

  return Response.json({ data: rows });
}
