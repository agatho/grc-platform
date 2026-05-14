// GET /api/v1/whistleblowing/intake-codes
//
// #WAVE15-P3-WB-DISCOVERY: Wave-14 QA tried four reasonable orgCodes
// (MERIDIAN, meridian, demo, test) and got 404 from every one — there
// was no way to discover the canonical value an intake submission
// expects. Without it the channel is effectively unreachable for
// whistleblowers who lack inside knowledge.
//
// Returns the active orgCode list. RLS keeps this scoped to the
// caller's accessible orgs; whistleblowing is legally isolated, so the
// callable surface is intentionally narrow.

import { db, organization } from "@grc/db";
import { isNull, asc } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";

export const GET = withErrorHandler(async function GET(_req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const rows = await db
    .select({
      orgCode: organization.orgCode,
      shortName: organization.shortName,
      name: organization.name,
    })
    .from(organization)
    .where(isNull(organization.deletedAt))
    .orderBy(asc(organization.name));

  // Drop rows without an orgCode so callers don't see entries they can't
  // actually intake against. Same with whistleblowing-disabled orgs in
  // the future (no flag today — every org is intake-eligible).
  const codes = rows
    .filter((r) => r.orgCode)
    .map((r) => ({
      orgCode: r.orgCode,
      shortName: r.shortName,
      name: r.name,
    }));

  return Response.json({
    data: {
      total: codes.length,
      codes,
      note: "Submit intake at POST /api/v1/whistleblowing/intake/submit with `orgCode`.",
    },
  });
});
