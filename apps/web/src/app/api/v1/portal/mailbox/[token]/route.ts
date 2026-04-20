// GET  /api/v1/portal/mailbox/:token — Case status + decrypted messages
// POST /api/v1/portal/mailbox/:token — Whistleblower reply

import {
  db,
  wbAnonymousMailbox,
  wbCase,
  wbReport,
  wbCaseMessage,
  wbCaseEvidence,
} from "@grc/db";
import { replyToMailboxSchema } from "@grc/shared";
import { encrypt, decrypt } from "@grc/shared";
import { eq, asc, sql } from "drizzle-orm";

interface RouteParams {
  params: Promise<{ token: string }>;
}

async function validateMailboxToken(token: string) {
  if (!token || token.length < 32) {
    return null;
  }

  const mailbox = await db.query.wbAnonymousMailbox.findFirst({
    where: eq(wbAnonymousMailbox.token, token),
  });

  if (!mailbox) return null;
  if (new Date() > new Date(mailbox.expiresAt)) return null;

  // Update access tracking
  await db
    .update(wbAnonymousMailbox)
    .set({
      lastAccessedAt: new Date(),
      accessCount: sql`${wbAnonymousMailbox.accessCount} + 1`,
    })
    .where(eq(wbAnonymousMailbox.id, mailbox.id));

  return mailbox;
}

// GET — Mailbox view: status, messages, evidence
export async function GET(req: Request, { params }: RouteParams) {
  const { token } = await params;
  const mailbox = await validateMailboxToken(token);
  if (!mailbox) {
    return Response.json(
      { error: "Invalid or expired token" },
      { status: 401 },
    );
  }

  // Get report
  const report = await db.query.wbReport.findFirst({
    where: eq(wbReport.id, mailbox.reportId),
  });
  if (!report) {
    return Response.json({ error: "Report not found" }, { status: 404 });
  }

  // Get case
  const caseRow = await db.query.wbCase.findFirst({
    where: eq(wbCase.reportId, report.id),
  });
  if (!caseRow) {
    return Response.json({ error: "Case not found" }, { status: 404 });
  }

  // Get messages, decrypt content
  const messages = await db
    .select()
    .from(wbCaseMessage)
    .where(eq(wbCaseMessage.caseId, caseRow.id))
    .orderBy(asc(wbCaseMessage.createdAt));

  const decryptedMessages = messages.map((m) => ({
    direction: m.direction,
    content: decrypt(m.content),
    authorType: m.authorType,
    createdAt: m.createdAt.toISOString(),
  }));

  // Mark outbound (ombudsperson) messages as read
  for (const m of messages) {
    if (m.direction === "outbound" && !m.readAt) {
      await db
        .update(wbCaseMessage)
        .set({ readAt: new Date() })
        .where(eq(wbCaseMessage.id, m.id));
    }
  }

  // Get evidence
  const evidence = await db
    .select({
      fileName: wbCaseEvidence.fileName,
      fileSize: wbCaseEvidence.fileSize,
      uploadedAt: wbCaseEvidence.uploadedAt,
    })
    .from(wbCaseEvidence)
    .where(eq(wbCaseEvidence.caseId, caseRow.id))
    .orderBy(asc(wbCaseEvidence.uploadedAt));

  return Response.json({
    data: {
      status: caseRow.status,
      caseNumber: caseRow.caseNumber,
      acknowledgeDeadline: caseRow.acknowledgeDeadline.toISOString(),
      responseDeadline: caseRow.responseDeadline.toISOString(),
      acknowledgedAt: caseRow.acknowledgedAt?.toISOString() ?? null,
      messages: decryptedMessages,
      evidence: evidence.map((e) => ({
        fileName: e.fileName,
        fileSize: e.fileSize,
        uploadedAt: e.uploadedAt.toISOString(),
      })),
    },
  });
}

// POST — Whistleblower reply
export async function POST(req: Request, { params }: RouteParams) {
  const { token } = await params;
  const mailbox = await validateMailboxToken(token);
  if (!mailbox) {
    return Response.json(
      { error: "Invalid or expired token" },
      { status: 401 },
    );
  }

  const body = replyToMailboxSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Find case from report
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

  const encryptedContent = encrypt(body.data.content);

  const [message] = await db
    .insert(wbCaseMessage)
    .values({
      caseId: caseRow.id,
      orgId: caseRow.orgId,
      direction: "inbound",
      content: encryptedContent,
      authorType: "whistleblower",
      authorId: null,
      createdAt: new Date(),
    })
    .returning();

  return Response.json(
    {
      data: {
        id: message!.id,
        direction: "inbound",
        createdAt: message!.createdAt.toISOString(),
      },
    },
    { status: 201 },
  );
}
