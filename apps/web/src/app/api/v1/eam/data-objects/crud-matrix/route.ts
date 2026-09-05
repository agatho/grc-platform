import {
  db,
  eamDataObject,
  eamDataObjectCrud,
  architectureElement,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/eam/data-objects/crud-matrix — CRUD matrix (objects x applications)
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const dataObjects = await db
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

  // Build matrix: rows = data objects, columns = applications
  const appMap = new Map<string, string>();
  for (const c of cruds) {
    appMap.set(c.crud.applicationId, c.appName ?? "Unknown");
  }

  const matrix = dataObjects.map((obj) => {
    const objCruds = cruds.filter((c) => c.crud.dataObjectId === obj.id);
    return {
      dataObjectId: obj.id,
      dataObjectName: obj.name,
      applications: objCruds.map((c) => ({
        applicationId: c.crud.applicationId,
        applicationName: c.appName ?? "Unknown",
        canCreate: c.crud.canCreate,
        canRead: c.crud.canRead,
        canUpdate: c.crud.canUpdate,
        canDelete: c.crud.canDelete,
      })),
    };
  });

  return Response.json({
    data: {
      matrix,
      applications: [...appMap.entries()].map(([id, name]) => ({ id, name })),
    },
  });
});
