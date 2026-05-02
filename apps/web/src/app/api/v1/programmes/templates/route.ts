// GET /api/v1/programmes/templates
// Liste aller veröffentlichten Templates (filterbar nach msType).

import { db, programmeTemplate, seedProgrammeTemplates } from "@grc/db";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { and, eq, isNull, asc } from "drizzle-orm";
import { MS_TYPE_VALUES } from "@grc/shared";

export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("programme", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const msTypeParam = url.searchParams.get("msType");
  const msType =
    msTypeParam &&
    (MS_TYPE_VALUES as readonly string[]).includes(msTypeParam)
      ? (msTypeParam as (typeof MS_TYPE_VALUES)[number])
      : null;

  // Idempotent lazy-seed: norm templates are platform-wide reference
  // data (no org_id) and the seeder skips templates that already exist
  // by (code, version). Running it on every list request is cheap and
  // ensures new template versions land without a separate seed step.
  await seedProgrammeTemplates();

  const where = msType
    ? and(
        eq(programmeTemplate.isActive, true),
        isNull(programmeTemplate.deprecatedAt),
        eq(programmeTemplate.msType, msType),
      )
    : and(
        eq(programmeTemplate.isActive, true),
        isNull(programmeTemplate.deprecatedAt),
      );

  const rows = await db
    .select({
      id: programmeTemplate.id,
      code: programmeTemplate.code,
      msType: programmeTemplate.msType,
      name: programmeTemplate.name,
      description: programmeTemplate.description,
      version: programmeTemplate.version,
      frameworkCodes: programmeTemplate.frameworkCodes,
      estimatedDurationDays: programmeTemplate.estimatedDurationDays,
      publishedAt: programmeTemplate.publishedAt,
    })
    .from(programmeTemplate)
    .where(where)
    .orderBy(asc(programmeTemplate.msType), asc(programmeTemplate.name));

  return Response.json({ data: rows });
}
