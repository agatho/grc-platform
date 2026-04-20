import {
  db,
  eamDataObject,
  eamDataObjectCrud,
  architectureElement,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/eam/diagrams/data-objects — Data object hierarchy data
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const objects = await db
    .select()
    .from(eamDataObject)
    .where(eq(eamDataObject.orgId, ctx.orgId));

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
    .where(eq(eamDataObjectCrud.orgId, ctx.orgId));

  function buildTree(parentId: string | null): Array<Record<string, unknown>> {
    return objects
      .filter((o) => o.parentId === parentId)
      .map((obj) => ({
        id: obj.id,
        name: obj.name,
        dataCategory: obj.dataCategory,
        classification: obj.classification,
        children: buildTree(obj.id),
        crudApps: cruds
          .filter((c) => c.crud.dataObjectId === obj.id)
          .map((c) => ({
            applicationId: c.crud.applicationId,
            applicationName: c.appName,
            canCreate: c.crud.canCreate,
            canRead: c.crud.canRead,
            canUpdate: c.crud.canUpdate,
            canDelete: c.crud.canDelete,
          })),
      }));
  }

  return Response.json({ data: buildTree(null) });
}
