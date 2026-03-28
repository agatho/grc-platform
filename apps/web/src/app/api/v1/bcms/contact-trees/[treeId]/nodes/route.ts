import { db, crisisContactNode, crisisContactTree } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { createContactNodeSchema } from "@grc/shared";

// GET /api/v1/bcms/contact-trees/:treeId/nodes — List nodes for a tree
export async function GET(req: Request, { params }: { params: Promise<{ treeId: string }> }) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { treeId } = await params;

  // Verify tree belongs to org
  const [tree] = await db.select().from(crisisContactTree)
    .where(and(eq(crisisContactTree.id, treeId), eq(crisisContactTree.orgId, ctx.orgId)));
  if (!tree) return Response.json({ error: "Contact tree not found" }, { status: 404 });

  const nodes = await db.select().from(crisisContactNode)
    .where(eq(crisisContactNode.treeId, treeId))
    .orderBy(crisisContactNode.sortOrder);

  return Response.json({ data: nodes });
}

// POST /api/v1/bcms/contact-trees/:treeId/nodes — Add node
export async function POST(req: Request, { params }: { params: Promise<{ treeId: string }> }) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { treeId } = await params;
  const body = createContactNodeSchema.safeParse({ ...(await req.json()), treeId });
  if (!body.success) {
    return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });
  }

  // Validate no circular parent references
  if (body.data.parentNodeId) {
    const [parent] = await db.select().from(crisisContactNode)
      .where(eq(crisisContactNode.id, body.data.parentNodeId));
    if (!parent || parent.treeId !== treeId) {
      return Response.json({ error: "Parent node not found in this tree" }, { status: 422 });
    }
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [node] = await tx.insert(crisisContactNode).values(body.data).returning();
    return node;
  });

  return Response.json({ data: created }, { status: 201 });
}
