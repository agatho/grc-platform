import { db, ddEvidence, runWithRequestContext } from "@grc/db";
import { portalEvidenceUploadSchema } from "@grc/shared";
import { eq, sql } from "drizzle-orm";
import { validateDdToken } from "@/lib/portal-auth";
import { withErrorHandler } from "@/lib/api-wrapper";

interface RouteParams {
  params: Promise<{ token: string }>;
}

// POST /api/v1/portal/dd/:token/evidence — Upload file metadata
export const POST = withErrorHandler(async function POST(
  req: Request,
  { params }: RouteParams,
) {
  const { token } = await params;
  const result = await validateDdToken(token, req);
  if (result instanceof Response) return result;
  // #WP3-S02-05 — everything below reads/writes FORCE-RLS tables
  // (`dd_session`, `dd_response`, `dd_evidence`, `vendor`, questionnaire
  // tables). This handler is anonymous by design, so no request context
  // existed and every query was RLS-filtered to 0 rows under `grc_app` —
  // the portal answered with an empty questionnaire instead of failing.
  // The org is now known from the resolved token, so pin it for the rest of
  // the handler; the `db` proxy routes to that connection automatically.
  return runWithRequestContext(
    { orgId: result.orgId, userId: "" },
    async () => {
      const session = result.session;

      const body = portalEvidenceUploadSchema.safeParse(await req.json());
      if (!body.success) {
        return Response.json(
          { error: "Validation failed", details: body.error.flatten() },
          { status: 422 },
        );
      }

      // Check total evidence size for this session (100MB limit)
      const existing = await db
        .select({
          total: sql<number>`COALESCE(SUM(${ddEvidence.fileSize}), 0)::int`,
        })
        .from(ddEvidence)
        .where(eq(ddEvidence.sessionId, session.id));

      const currentTotal = existing[0]?.total ?? 0;
      if (currentTotal + body.data.fileSize > 100 * 1024 * 1024) {
        return Response.json(
          { error: "Total upload limit (100MB) exceeded" },
          { status: 413 },
        );
      }

      // Generate storage path
      const storagePath = `dd/${session.orgId}/${session.id}/${crypto.randomUUID()}_${body.data.fileName}`;

      const [evidence] = await db
        .insert(ddEvidence)
        .values({
          sessionId: session.id,
          questionId: body.data.questionId ?? null,
          fileName: body.data.fileName,
          fileSize: body.data.fileSize,
          fileType: body.data.fileType,
          storagePath,
          virusScanStatus: "pending",
        })
        .returning();

      return Response.json(
        {
          data: {
            id: evidence.id,
            fileName: evidence.fileName,
            fileSize: evidence.fileSize,
            fileType: evidence.fileType,
            storagePath: evidence.storagePath,
            virusScanStatus: evidence.virusScanStatus,
            uploadedAt: evidence.uploadedAt,
          },
        },
        { status: 201 },
      );
    },
  );
});
