// GET /api/v1/platform/work-item-types — All work item type definitions
// Auth-only (no org context needed). Sorted by nav_order.

import { db, workItemType } from "@grc/db";
import { asc } from "drizzle-orm";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(workItemType)
    .orderBy(asc(workItemType.navOrder));

  return Response.json({ data: rows });
}
