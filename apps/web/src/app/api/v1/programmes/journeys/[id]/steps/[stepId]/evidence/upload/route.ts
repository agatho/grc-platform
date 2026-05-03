// POST /api/v1/programmes/journeys/[id]/steps/[stepId]/evidence/upload
//
// One-shot Evidence-Upload für Programme Cockpit. Akzeptiert Multipart-
// Form-Data, erzeugt in einem Call:
//   1. Document-Record im dms-Modul (Kategorie "evidence")
//   2. File-Storage unter UPLOAD_DIR
//   3. programme_step_link vom Step zum Document (linkType: "evidences")
//
// Damit muss der Operator nicht mehr separat im Documents-Modul ein
// Dokument anlegen und manuell verlinken — Drag-and-Drop am Subtask
// reicht. Der Audit-Trail erfasst beide Modul-Eintragungen einzeln.

import {
  db,
  document,
  programmeJourney,
  programmeJourneyStep,
  programmeStepLink,
  programmeJourneyEvent,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext } from "@/lib/api";
import { eq, and, isNull } from "drizzle-orm";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID, createHash } from "crypto";

const UPLOAD_DIR =
  process.env.UPLOAD_DIR ?? join(process.cwd(), "../../uploads/documents");
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const ALLOWED_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "text/plain",
  "text/csv",
  "text/markdown",
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "application/json",
  "application/xml",
  "text/xml",
]);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; stepId: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "control_owner");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("programme", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: journeyId, stepId } = await params;

  // Validate journey + step
  const [journey] = await db
    .select({ id: programmeJourney.id })
    .from(programmeJourney)
    .where(
      and(
        eq(programmeJourney.id, journeyId),
        eq(programmeJourney.orgId, ctx.orgId),
        isNull(programmeJourney.deletedAt),
      ),
    )
    .limit(1);
  if (!journey) {
    return Response.json({ error: "Journey not found" }, { status: 404 });
  }
  const [step] = await db
    .select({
      id: programmeJourneyStep.id,
      code: programmeJourneyStep.code,
      name: programmeJourneyStep.name,
    })
    .from(programmeJourneyStep)
    .where(
      and(
        eq(programmeJourneyStep.id, stepId),
        eq(programmeJourneyStep.journeyId, journeyId),
        eq(programmeJourneyStep.orgId, ctx.orgId),
      ),
    )
    .limit(1);
  if (!step) {
    return Response.json({ error: "Step not found" }, { status: 404 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const customTitle = formData.get("title") as string | null;

  if (!file) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return Response.json(
      { error: "File too large (max 50MB)" },
      { status: 413 },
    );
  }
  if (!ALLOWED_MIMES.has(file.type)) {
    return Response.json(
      { error: `File type not allowed: ${file.type}` },
      { status: 415 },
    );
  }

  // 1) Create document record
  const docTitle =
    customTitle?.trim() ||
    `Evidence: ${step.code} — ${file.name}`;

  const [doc] = await withAuditContext(ctx, async () =>
    db
      .insert(document)
      .values({
        orgId: ctx.orgId,
        title: docTitle,
        category: "evidence",
        status: "approved",
        ownerId: ctx.userId,
        currentVersion: 1,
        requiresAcknowledgment: false,
        tags: ["programme-evidence", `journey:${journeyId}`, `step:${step.code}`],
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning(),
  );

  // 2) Store file
  const orgDir = join(UPLOAD_DIR, ctx.orgId);
  const docDir = join(orgDir, doc.id);
  await mkdir(docDir, { recursive: true });

  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storedName = `${randomUUID()}-${safeFileName}`;
  const filePath = join(docDir, storedName);
  const relativePath = `${ctx.orgId}/${doc.id}/${storedName}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);
  const sha256 = createHash("sha256").update(buffer).digest("hex");

  await db
    .update(document)
    .set({
      fileName: file.name,
      filePath: relativePath,
      fileSize: file.size,
      mimeType: file.type,
      updatedAt: new Date(),
      updatedBy: ctx.userId,
    })
    .where(eq(document.id, doc.id));

  // 3) Create programme_step_link
  const [link] = await withAuditContext(ctx, async () =>
    db
      .insert(programmeStepLink)
      .values({
        orgId: ctx.orgId,
        journeyStepId: stepId,
        targetKind: "document",
        targetId: doc.id,
        targetLabel: docTitle,
        linkType: "evidences",
        notes: `SHA-256: ${sha256}`,
        createdBy: ctx.userId,
      })
      .returning(),
  );

  // Audit-Event auf Programme-Seite
  await db.insert(programmeJourneyEvent).values({
    orgId: ctx.orgId,
    journeyId,
    stepId,
    eventType: "evidence.uploaded",
    actorId: ctx.userId,
    payload: {
      documentId: doc.id,
      linkId: link.id,
      fileName: file.name,
      fileSize: file.size,
      sha256,
    },
  });

  return Response.json(
    {
      data: {
        document: {
          id: doc.id,
          title: doc.title,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          sha256,
        },
        link,
      },
    },
    { status: 201 },
  );
}
