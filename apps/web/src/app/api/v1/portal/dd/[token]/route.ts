import {
  db,
  ddSession,
  ddResponse,
  ddEvidence,
  questionnaireTemplate,
  questionnaireSection,
  questionnaireQuestion,
  vendor,
} from "@grc/db";
import { eq, asc } from "drizzle-orm";
import { validateDdToken } from "@/lib/portal-auth";

interface RouteParams {
  params: Promise<{ token: string }>;
}

// GET /api/v1/portal/dd/:token — Load questionnaire + existing responses
export async function GET(req: Request, { params }: RouteParams) {
  const { token } = await params;
  const result = await validateDdToken(token, req);
  if (result instanceof Response) return result;

  const session = result.session;

  // Load template info
  const template = await db.query.questionnaireTemplate.findFirst({
    where: eq(questionnaireTemplate.id, session.templateId),
  });

  // Load vendor info
  const vendorRow = await db.query.vendor.findFirst({
    where: eq(vendor.id, session.vendorId),
  });

  // Load sections with questions
  const sections = await db
    .select()
    .from(questionnaireSection)
    .where(eq(questionnaireSection.templateId, session.templateId))
    .orderBy(asc(questionnaireSection.sortOrder));

  const allQuestions: Array<typeof questionnaireQuestion.$inferSelect> = [];
  for (const section of sections) {
    const sectionQuestions = await db
      .select()
      .from(questionnaireQuestion)
      .where(eq(questionnaireQuestion.sectionId, section.id))
      .orderBy(asc(questionnaireQuestion.sortOrder));
    allQuestions.push(...sectionQuestions);
  }

  // Load existing responses
  const existingResponses = await db
    .select()
    .from(ddResponse)
    .where(eq(ddResponse.sessionId, session.id));

  // Load existing evidence
  const existingEvidence = await db
    .select()
    .from(ddEvidence)
    .where(eq(ddEvidence.sessionId, session.id));

  // Filter question fields for portal (no internal scoring info)
  const portalSections = sections.map((s) => ({
    id: s.id,
    titleDe: s.titleDe,
    titleEn: s.titleEn,
    descriptionDe: s.descriptionDe,
    descriptionEn: s.descriptionEn,
    sortOrder: s.sortOrder,
    questions: allQuestions
      .filter((q) => q.sectionId === s.id)
      .map((q) => ({
        id: q.id,
        questionType: q.questionType,
        questionDe: q.questionDe,
        questionEn: q.questionEn,
        helpTextDe: q.helpTextDe,
        helpTextEn: q.helpTextEn,
        options: (
          q.options as Array<{
            value: string;
            labelDe: string;
            labelEn: string;
          }>
        )?.map(({ value, labelDe, labelEn }) => ({ value, labelDe, labelEn })),
        isRequired: q.isRequired,
        isEvidenceRequired: q.isEvidenceRequired,
        conditionalOn: q.conditionalOn,
        sortOrder: q.sortOrder,
      })),
  }));

  return Response.json({
    session: {
      id: session.id,
      status: session.status,
      language: session.language,
      progressPercent: session.progressPercent,
      deadline: session.tokenExpiresAt,
    },
    vendor: { name: vendorRow?.name },
    template: {
      name: template?.name,
      estimatedMinutes: template?.estimatedMinutes,
    },
    sections: portalSections,
    responses: existingResponses.map((r) => ({
      questionId: r.questionId,
      answerText: r.answerText,
      answerChoice: r.answerChoice,
      answerNumber: r.answerNumber,
      answerDate: r.answerDate,
      answerBoolean: r.answerBoolean,
    })),
    evidence: existingEvidence.map((e) => ({
      id: e.id,
      questionId: e.questionId,
      fileName: e.fileName,
      fileSize: e.fileSize,
      fileType: e.fileType,
      uploadedAt: e.uploadedAt,
    })),
  });
}
