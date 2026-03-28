import { db } from "@grc/db";
import { requireModule } from "@grc/auth";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import type { MetroStation, MetroMapData } from "@grc/shared";

// GET /api/v1/processes/metro-layout — Get metro map data for all processes
export async function GET(req: Request) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "control_owner",
    "process_owner",
    "auditor",
    "viewer",
  );
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // Get processes with health and metro layout (columns from migrations 877, 878)
  const result = await db.execute(
    sql`SELECT id, title, parent_process_id,
               COALESCE(process_health, 'healthy') as process_health,
               metro_layout,
               level
        FROM process
        WHERE org_id = ${ctx.orgId} AND deleted_at IS NULL
        ORDER BY level ASC NULLS FIRST, title ASC`,
  );

  const processes = result;
  const stations: MetroStation[] = [];
  const lineColors = ["#3b82f6", "#22c55e", "#f97316", "#8b5cf6", "#ec4899", "#06b6d4"];

  // Group by top-level parent (main lines)
  const topLevel = processes.filter((p) => !p.parent_process_id);
  const lines: MetroMapData["lines"] = [];

  topLevel.forEach((parent, idx) => {
    const color = lineColors[idx % lineColors.length];
    const children = processes.filter((p) => p.parent_process_id === parent.id);
    const lineStationIds = [String(parent.id), ...children.map((c) => String(c.id))];

    const layoutData = parent.metro_layout
      ? (typeof parent.metro_layout === "string" ? JSON.parse(parent.metro_layout) : parent.metro_layout)
      : null;

    stations.push({
      processId: String(parent.id),
      processName: String(parent.title ?? ""),
      health: String(parent.process_health ?? "healthy"),
      x: layoutData?.x ?? idx * 200,
      y: layoutData?.y ?? 100,
      lineColor: color,
      connections: children.map((c) => String(c.id)),
    });

    children.forEach((child, childIdx) => {
      const childLayout = child.metro_layout
        ? (typeof child.metro_layout === "string" ? JSON.parse(child.metro_layout) : child.metro_layout)
        : null;

      stations.push({
        processId: String(child.id),
        processName: String(child.title ?? ""),
        health: String(child.process_health ?? "healthy"),
        x: childLayout?.x ?? idx * 200 + (childIdx + 1) * 150,
        y: childLayout?.y ?? 100,
        lineColor: color,
        connections: [],
      });
    });

    lines.push({
      id: String(parent.id),
      name: String(parent.title ?? ""),
      color,
      stationIds: lineStationIds,
    });
  });

  const mapData: MetroMapData = { stations, lines };
  return Response.json({ data: mapData });
}
