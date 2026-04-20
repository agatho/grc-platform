// POST /api/v1/portal/mailbox/:token/evidence — Upload additional evidence (whistleblower)

import {
  db,
  wbAnonymousMailbox,
  wbCase,
  wbReport,
  wbCaseEvidence,
} from "@grc/db";
import { eq, sql } from "drizzle-orm";
import { createHash } from "crypto";

interface RouteParams {
  params: Promise<{ token: string }>;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
];

export async function POST(req: Request, { params }: RouteParams) {
  const { token } = await params;

  if (!token || token.length < 32) {
    return Response.json({ error: "Invalid token" }, { status: 401 });
  }

  const mailbox = await db.query.wbAnonymousMailbox.findFirst({
    where: eq(wbAnonymousMailbox.token, token),
  });
  if (!mailbox || new Date() > new Date(mailbox.expiresAt)) {
    return Response.json(
      { error: "Invalid or expired token" },
      { status: 401 },
    );
  }

  const report = await db.query.wbReport.findFirst({
    where: eq(wbReport.id, mailbox.reportId),
  });
  if (!report) {
    return Response.json({ error: "Report not found" }, { status: 404 });
  }

  const caseRow = await db.query.wbCase.findFirst({
    where: eq(wbCase.reportId, report.id),
  });
  if (!caseRow) {
    return Response.json({ error: "Case not found" }, { status: 404 });
  }

  // Parse multipart form data
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return Response.json({ error: "File exceeds 50MB limit" }, { status: 413 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return Response.json({ error: "File type not allowed" }, { status: 415 });
  }

  // Read file bytes and compute SHA-256
  const buffer = Buffer.from(await file.arrayBuffer());
  const sha256 = createHash("sha256").update(buffer).digest("hex");

  // Store file (in production: encrypted storage to S3/MinIO)
  const storagePath = `wb/${caseRow.orgId}/${caseRow.id}/${Date.now()}-${file.name}`;

  const [evidence] = await db
    .insert(wbCaseEvidence)
    .values({
      caseId: caseRow.id,
      reportId: report.id,
      orgId: caseRow.orgId,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      storagePath,
      sha256Hash: sha256,
      uploadedBy: null, // anonymous
      uploadedAt: new Date(),
      isImmutable: true,
    })
    .returning();

  return Response.json(
    {
      data: {
        id: evidence!.id,
        fileName: evidence!.fileName,
        fileSize: evidence!.fileSize,
        sha256Hash: evidence!.sha256Hash,
      },
    },
    { status: 201 },
  );
}
