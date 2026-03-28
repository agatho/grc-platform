// GET /api/v1/whistleblowing/cases/:id — Case detail with decrypted content

import {
  db,
  wbCase,
  wbReport,
  wbCaseMessage,
  wbCaseEvidence,
  user,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { decrypt } from "@grc/shared";
import { eq, asc } from "drizzle-orm";
import { withAuth } from "@/lib/api";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, { params }: RouteParams) {
  const ctx = await withAuth("admin", "ombudsperson");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("whistleblowing", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const caseRow = await db.query.wbCase.findFirst({
    where: eq(wbCase.id, id),
  });

  if (!caseRow || caseRow.orgId !== ctx.orgId) {
    return Response.json({ error: "Case not found" }, { status: 404 });
  }

  // Get report with decrypted fields
  const report = await db.query.wbReport.findFirst({
    where: eq(wbReport.id, caseRow.reportId),
  });

  if (!report) {
    return Response.json({ error: "Report not found" }, { status: 404 });
  }

  // Get messages (decrypted)
  const messages = await db
    .select()
    .from(wbCaseMessage)
    .where(eq(wbCaseMessage.caseId, id))
    .orderBy(asc(wbCaseMessage.createdAt));

  // Get evidence
  const evidence = await db
    .select()
    .from(wbCaseEvidence)
    .where(eq(wbCaseEvidence.caseId, id))
    .orderBy(asc(wbCaseEvidence.uploadedAt));

  // Get assignee info
  let assigneeName: string | null = null;
  if (caseRow.assignedTo) {
    const assignee = await db.query.user.findFirst({
      where: eq(user.id, caseRow.assignedTo),
    });
    assigneeName = assignee?.name ?? null;
  }

  // Decrypt fields
  let decryptedDescription = "";
  try {
    decryptedDescription = decrypt(report.description);
  } catch {
    decryptedDescription = "[Decryption error]";
  }

  let decryptedEmail: string | null = null;
  if (report.contactEmail) {
    try {
      decryptedEmail = decrypt(report.contactEmail);
    } catch {
      decryptedEmail = "[Decryption error]";
    }
  }

  let decryptedResolution: string | null = null;
  if (caseRow.resolution) {
    try {
      decryptedResolution = decrypt(caseRow.resolution);
    } catch {
      decryptedResolution = "[Decryption error]";
    }
  }

  return Response.json({
    data: {
      case: {
        id: caseRow.id,
        orgId: caseRow.orgId,
        reportId: caseRow.reportId,
        caseNumber: caseRow.caseNumber,
        status: caseRow.status,
        priority: caseRow.priority,
        assignedTo: caseRow.assignedTo,
        assignedToName: assigneeName,
        acknowledgedAt: caseRow.acknowledgedAt?.toISOString() ?? null,
        acknowledgeDeadline: caseRow.acknowledgeDeadline.toISOString(),
        responseDeadline: caseRow.responseDeadline.toISOString(),
        resolution: decryptedResolution,
        resolutionCategory: caseRow.resolutionCategory,
        resolvedAt: caseRow.resolvedAt?.toISOString() ?? null,
        closedAt: caseRow.closedAt?.toISOString() ?? null,
        createdAt: caseRow.createdAt.toISOString(),
        updatedAt: caseRow.updatedAt.toISOString(),
      },
      report: {
        id: report.id,
        category: report.category,
        description: decryptedDescription,
        contactEmail: decryptedEmail,
        language: report.language,
        ipHash: report.ipHash,
        submittedAt: report.submittedAt.toISOString(),
      },
      messages: messages.map((m) => {
        let content = "";
        try {
          content = decrypt(m.content);
        } catch {
          content = "[Decryption error]";
        }
        return {
          id: m.id,
          caseId: m.caseId,
          direction: m.direction,
          content,
          authorType: m.authorType,
          authorId: m.authorId,
          readAt: m.readAt?.toISOString() ?? null,
          createdAt: m.createdAt.toISOString(),
        };
      }),
      evidence: evidence.map((e) => ({
        id: e.id,
        fileName: e.fileName,
        fileSize: e.fileSize,
        mimeType: e.mimeType,
        sha256Hash: e.sha256Hash,
        uploadedAt: e.uploadedAt.toISOString(),
        isImmutable: e.isImmutable,
      })),
    },
  });
}
