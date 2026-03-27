import { db } from "@grc/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();
  let dbOk = false;
  let dbLatency = 0;

  try {
    const dbStart = Date.now();
    await db.execute(sql`SELECT 1`);
    dbLatency = Date.now() - dbStart;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const status = dbOk ? "healthy" : "degraded";
  const httpStatus = dbOk ? 200 : 503;

  return Response.json(
    {
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        database: { status: dbOk ? "up" : "down", latencyMs: dbLatency },
      },
      responseMs: Date.now() - start,
    },
    { status: httpStatus },
  );
}
