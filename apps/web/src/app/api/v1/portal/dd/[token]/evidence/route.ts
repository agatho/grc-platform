import { db, ddEvidence } from "@grc/db";
import { portalEvidenceUploadSchema } from "@grc/shared";
import { eq, sql } from "drizzle-orm";
import { validateDdToken } from "@/lib/portal-auth";

interface RouteParams {
  params: Promise<{ token: string }>;
}

// POST /api/v1/portal/dd/:token/evidence — Upload file metadata
export async function POST(req: Request, { params }: RouteParams) {
  const { token } = await params;
  const result = await validateDdToken(token, req);
  if (result instanceof Response) return result;

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
}
