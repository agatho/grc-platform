// GET /api/v1/vendors/enums
//
// #WAVE15-P3-VENDOR-ENUMS: Wave-14 QA had to guess the vendor `category`
// + `tier` enum values (cloud_provider, it_services, ...) — the schema
// is the source of truth but invisible to the API surface. This route
// surfaces the canonical lists so wizard pickers and integration tests
// can self-populate. Mirrored from packages/db/src/schema/tprm.ts so
// the wire payload stays in lock-step with the DB enums.

import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";

const VENDOR_CATEGORY_VALUES = [
  "it_services",
  "cloud_provider",
  "consulting",
  "facility",
  "logistics",
  "raw_materials",
  "financial",
  "hr_services",
  "other",
] as const;

const VENDOR_TIER_VALUES = [
  "critical",
  "important",
  "standard",
  "low_risk",
] as const;

const VENDOR_STATUS_VALUES = [
  "prospect",
  "active",
  "in_review",
  "suspended",
  "terminated",
] as const;

export const GET = withErrorHandler(async function GET(_req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  return Response.json({
    data: {
      category: VENDOR_CATEGORY_VALUES,
      tier: VENDOR_TIER_VALUES,
      status: VENDOR_STATUS_VALUES,
    },
  });
});
