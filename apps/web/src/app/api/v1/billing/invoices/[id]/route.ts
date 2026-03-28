import { db, billingInvoice } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/billing/invoices/:id
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;

  const [row] = await db
    .select()
    .from(billingInvoice)
    .where(and(eq(billingInvoice.id, id), eq(billingInvoice.orgId, ctx.orgId)));

  if (!row) {
    return Response.json({ error: "Invoice not found" }, { status: 404 });
  }

  return Response.json({ data: row });
}
