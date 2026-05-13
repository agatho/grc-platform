import { db, contract } from "@grc/db";
import { eq, and, isNull } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";
import { requireUuidParam } from "@/lib/param-validation";

// GET /api/v1/contracts/[id]/transitions
//
// Discovery for the contract lifecycle.
// Status (contract_status enum):
//   draft → negotiation → pending_approval → active → renewal/expired/terminated → archived

const CONTRACT_STATUSES = [
  "draft",
  "negotiation",
  "pending_approval",
  "active",
  "renewal",
  "expired",
  "terminated",
  "archived",
] as const;

const CONTRACT_ALLOWED: Record<
  (typeof CONTRACT_STATUSES)[number],
  (typeof CONTRACT_STATUSES)[number][]
> = {
  draft: ["negotiation", "archived"],
  negotiation: ["pending_approval", "draft", "archived"],
  pending_approval: ["active", "negotiation", "archived"],
  active: ["renewal", "expired", "terminated"],
  renewal: ["active", "expired", "terminated"],
  expired: ["renewal", "archived", "terminated"],
  terminated: ["archived"],
  archived: [], // terminal
};

type IdCtx = { params: Promise<{ id: string }> };

export const GET = withErrorHandler<IdCtx>(async function GET(req, { params }) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("contract", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const { id } = await params;
  requireUuidParam(id);

  const [row] = await db
    .select({ status: contract.status })
    .from(contract)
    .where(
      and(
        eq(contract.id, id),
        eq(contract.orgId, ctx.orgId),
        isNull(contract.deletedAt),
      ),
    );

  if (!row) {
    return Response.json({ error: "Contract not found" }, { status: 404 });
  }

  return Response.json({
    data: {
      current: row.status,
      knownStatuses: CONTRACT_STATUSES,
      allowedNext: CONTRACT_ALLOWED[row.status] ?? [],
      endpoint: `/api/v1/contracts/${id}`,
      method: "PUT",
      bodyShape: {
        status: `<one of: ${CONTRACT_STATUSES.join(" | ")}>`,
      },
    },
  });
});
