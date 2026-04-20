import {
  db,
  eamDataObject,
  eamDataObjectCrud,
  architectureElement,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/eam/data-objects/:id/lineage — Data lineage graph
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const dataObjectId = url.searchParams.get("dataObjectId");
  if (!dataObjectId)
    return Response.json({ error: "dataObjectId required" }, { status: 400 });

  const dataObject = await db
    .select()
    .from(eamDataObject)
    .where(
      and(
        eq(eamDataObject.id, dataObjectId),
        eq(eamDataObject.orgId, ctx.orgId),
      ),
    )
    .limit(1);

  if (!dataObject.length)
    return Response.json({ error: "Data object not found" }, { status: 404 });

  const cruds = await db
    .select({
      crud: eamDataObjectCrud,
      appName: architectureElement.name,
    })
    .from(eamDataObjectCrud)
    .leftJoin(
      architectureElement,
      eq(eamDataObjectCrud.applicationId, architectureElement.id),
    )
    .where(eq(eamDataObjectCrud.dataObjectId, dataObjectId));

  return Response.json({
    data: {
      dataObject: dataObject[0],
      creators: cruds
        .filter((c) => c.crud.canCreate)
        .map((c) => ({ id: c.crud.applicationId, name: c.appName })),
      readers: cruds
        .filter((c) => c.crud.canRead)
        .map((c) => ({ id: c.crud.applicationId, name: c.appName })),
      updaters: cruds
        .filter((c) => c.crud.canUpdate)
        .map((c) => ({ id: c.crud.applicationId, name: c.appName })),
      deleters: cruds
        .filter((c) => c.crud.canDelete)
        .map((c) => ({ id: c.crud.applicationId, name: c.appName })),
    },
  });
}
