// GET /api/v1/isms/reviews/[id]/export/pdf
//
// Beschluss-Protokoll der Management-Bewertung (ISO 27001 9.3.3) als PDF:
// Titel, Datum, Zeitraum, Teilnehmer, alle Review-Punkte mit Beschlüssen
// und verlinkten Maßnahmen, Unterschriftenzeile. Nutzt die pdfkit-basierte
// Struktur-PDF-Infrastruktur (lib/pdf.ts) — kein neues Package.

import {
  db,
  managementReview,
  managementReviewItem,
  workItem,
  organization,
  user,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, asc, inArray } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { renderStructuredPdfResponse, type PdfSection } from "@/lib/pdf";

const CATEGORY_LABELS: Record<string, string> = {
  previous_actions: "Maßnahmen aus dem letzten Review",
  context_changes: "Änderungen im Kontext",
  risks: "Risikolage",
  findings: "Nichtkonformitäten & Findings",
  audits: "Auditergebnisse",
  control_effectiveness: "Kontroll-Wirksamkeit",
  incidents: "Sicherheitsvorfälle",
  documents: "Dokumentenlenkung",
  kpis: "Kennzahlen",
  improvement: "Verbesserung",
  other: "Sonstiges",
};

const STATUS_LABELS: Record<string, string> = {
  planned: "Geplant",
  in_progress: "In Bearbeitung",
  completed: "Abgeschlossen",
  cancelled: "Abgebrochen",
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const reviewRows = await db
    .select()
    .from(managementReview)
    .where(
      and(eq(managementReview.id, id), eq(managementReview.orgId, ctx.orgId)),
    );
  const review = reviewRows[0];
  if (!review) {
    return Response.json({ error: "Review not found" }, { status: 404 });
  }

  const participantIds = review.participantIds ?? [];
  const personIds = [
    ...new Set(
      [review.chairId, ...participantIds].filter((v): v is string =>
        Boolean(v),
      ),
    ),
  ];

  const [orgRows, personRows, itemRows] = await Promise.all([
    db
      .select({ name: organization.name })
      .from(organization)
      .where(eq(organization.id, ctx.orgId)),
    personIds.length > 0
      ? db
          .select({ id: user.id, name: user.name, email: user.email })
          .from(user)
          .where(inArray(user.id, personIds))
      : Promise.resolve(
          [] as Array<{ id: string; name: string | null; email: string }>,
        ),
    db
      .select({
        category: managementReviewItem.category,
        content: managementReviewItem.content,
        decision: managementReviewItem.decision,
        actionElementId: workItem.elementId,
        actionName: workItem.name,
        actionStatus: workItem.status,
      })
      .from(managementReviewItem)
      .leftJoin(
        workItem,
        eq(managementReviewItem.actionWorkItemId, workItem.id),
      )
      .where(
        and(
          eq(managementReviewItem.orgId, ctx.orgId),
          eq(managementReviewItem.reviewId, id),
        ),
      )
      .orderBy(
        asc(managementReviewItem.sortOrder),
        asc(managementReviewItem.createdAt),
      ),
  ]);

  const personById = new Map(personRows.map((p) => [p.id, p]));
  const displayName = (uid: string): string => {
    const p = personById.get(uid);
    return p?.name || p?.email || uid;
  };

  const chairName = review.chairId ? displayName(review.chairId) : "—";
  const participantNames = participantIds.map((pid) => displayName(pid));

  const sections: PdfSection[] = [];

  sections.push({
    heading: "Rahmendaten",
    kpis: [
      { label: "Review-Datum", value: review.reviewDate },
      { label: "Status", value: STATUS_LABELS[review.status] ?? review.status },
      { label: "Review-Punkte", value: itemRows.length },
      {
        label: "Beschlüsse",
        value: itemRows.filter((i) => (i.decision ?? "").trim().length > 0)
          .length,
      },
    ],
    table: {
      headers: ["Feld", "Wert"],
      rows: [
        ["Leitung (Vorsitz)", chairName],
        [
          "Teilnehmer",
          participantNames.length > 0 ? participantNames.join(", ") : "—",
        ],
        [
          "Review-Zeitraum",
          review.periodStart || review.periodEnd
            ? `${review.periodStart ?? "—"} bis ${review.periodEnd ?? review.reviewDate}`
            : "seit letztem abgeschlossenen Review",
        ],
        ["Nächstes Review", review.nextReviewDate ?? "—"],
        [
          "Abgeschlossen am",
          review.completedAt
            ? new Date(review.completedAt).toLocaleString("de-DE")
            : "—",
        ],
      ],
    },
  });

  if (review.description) {
    sections.push({ heading: "Beschreibung", paragraph: review.description });
  }

  sections.push({
    heading: "Feststellungen und Beschlüsse (ISO 27001 9.3.3)",
    table: {
      headers: ["#", "Kategorie", "Feststellung", "Beschluss", "Maßnahme"],
      rows:
        itemRows.length > 0
          ? itemRows.map((item, i) => [
              i + 1,
              CATEGORY_LABELS[item.category] ?? item.category,
              item.content,
              item.decision ?? "—",
              item.actionElementId
                ? `${item.actionElementId} ${item.actionName ?? ""} (${item.actionStatus ?? ""})`
                : "—",
            ])
          : [["—", "—", "Keine Review-Punkte erfasst", "—", "—"]],
    },
  });

  if (review.minutes) {
    sections.push({ heading: "Protokollnotizen", paragraph: review.minutes });
  }

  sections.push({
    heading: "Unterschriften",
    paragraph:
      "Das Protokoll wurde geprüft und die Beschlüsse werden durch die " +
      "oberste Leitung getragen (ISO/IEC 27001:2022, Kapitel 9.3).",
    notes: [
      `Ort, Datum: _______________________________`,
      `Vorsitz (${chairName}): _______________________________`,
      `Protokollführung: _______________________________`,
    ],
  });

  return renderStructuredPdfResponse(
    {
      title: `Management-Review-Protokoll: ${review.title}`,
      subtitle: `Management-Bewertung nach ISO/IEC 27001 Kapitel 9.3 — ${review.reviewDate}`,
      orgName: orgRows[0]?.name,
      generatedAt: new Date(),
      sections,
    },
    `management_review_${review.reviewDate}`,
  );
}
