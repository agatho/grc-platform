import {
  db,
  auditChecklist,
  auditChecklistItem,
  audit,
  user,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, asc } from "drizzle-orm";
import { withAuth } from "@/lib/api";

type RouteParams = {
  params: Promise<{ id: string; checklistId: string }>;
};

// GET /api/v1/audit-mgmt/audits/[id]/checklists/[checklistId]/export
//
// Liefert die vollständige Checkliste inkl. aller ISO-19011-Arbeitspapier-
// Felder als CSV-Download. Audit-Teams brauchen das für Report-Anhänge,
// externe Zertifizierer und Archivierung nach ISO 17021-1 § 9.5.
//
// Format: UTF-8 BOM + CRLF (Excel-kompatibel), semicolon-separated, jedes
// Feld in Quotes (doppelte Quotes escaped). methodEntries werden als
// JSON-String in einer Spalte serialisiert — Excel öffnet das lesbar,
// Analysten können es bei Bedarf nachparsen.
//
// Query-Parameter: `format=csv` (default) oder `format=json` für
// maschinenlesbaren Export.
export async function GET(req: Request, { params }: RouteParams) {
  const { id, checklistId } = await params;
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const format = url.searchParams.get("format") === "json" ? "json" : "csv";

  // 1. Checklist + Audit laden
  const [row] = await db
    .select({
      checklistId: auditChecklist.id,
      checklistName: auditChecklist.name,
      auditId: audit.id,
      auditTitle: audit.title,
      auditType: audit.auditType,
      auditStatus: audit.status,
      leadAuditor: user.name,
      plannedStart: audit.plannedStart,
      plannedEnd: audit.plannedEnd,
    })
    .from(auditChecklist)
    .leftJoin(audit, eq(auditChecklist.auditId, audit.id))
    .leftJoin(user, eq(audit.leadAuditorId, user.id))
    .where(
      and(
        eq(auditChecklist.id, checklistId),
        eq(auditChecklist.auditId, id),
        eq(auditChecklist.orgId, ctx.orgId),
      ),
    );

  if (!row) {
    return Response.json({ error: "Checklist not found" }, { status: 404 });
  }

  // 2. Items laden
  const items = await db
    .select()
    .from(auditChecklistItem)
    .where(
      and(
        eq(auditChecklistItem.checklistId, checklistId),
        eq(auditChecklistItem.orgId, ctx.orgId),
      ),
    )
    .orderBy(asc(auditChecklistItem.sortOrder));

  if (format === "json") {
    return Response.json({ data: { meta: row, items } });
  }

  // 3. CSV generieren
  const csvEscape = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s =
      typeof v === "string"
        ? v
        : typeof v === "object"
          ? JSON.stringify(v)
          : String(v);
    // Semicolon ist unser Separator — Excel-DE friendly. Quote + escape.
    return '"' + s.replace(/"/g, '""') + '"';
  };

  const headerCols = [
    "Nr",
    "Kriterium",
    "Frage",
    "Erwartete Evidenz",
    "Ergebnis",
    "Risiko-Rating",
    "Auditor-Notizen",
    "Korrekturmaßnahmen-Vorschlag",
    "Frist (Remediation)",
    "Methoden-Entries (JSON)",
    "Erfasst am",
  ];

  const lines: string[] = [];
  // Metadaten-Header
  lines.push(csvEscape(`Audit: ${row.auditTitle ?? "?"}`) + ";" + csvEscape(`Typ: ${row.auditType ?? ""}`));
  lines.push(csvEscape(`Checkliste: ${row.checklistName}`) + ";" + csvEscape(`Lead-Auditor: ${row.leadAuditor ?? ""}`));
  lines.push(
    csvEscape(`Geplant: ${row.plannedStart ?? ""} – ${row.plannedEnd ?? ""}`) +
      ";" +
      csvEscape(`Status: ${row.auditStatus ?? ""}`),
  );
  lines.push(""); // Leerzeile
  lines.push(headerCols.map(csvEscape).join(";"));

  for (const item of items) {
    const cells = [
      item.sortOrder ?? "",
      item.criterionReference ?? "",
      item.question,
      item.expectedEvidence ?? "",
      item.result ?? "",
      item.riskRating ?? "",
      item.notes ?? "",
      item.correctiveActionSuggestion ?? "",
      item.remediationDeadline ?? "",
      item.methodEntries ?? [],
      item.completedAt ?? "",
    ];
    lines.push(cells.map(csvEscape).join(";"));
  }

  // UTF-8 BOM für Excel + CRLF
  const csv = "\uFEFF" + lines.join("\r\n") + "\r\n";

  const filename = `audit-${row.auditId}-checklist-${checklistId.slice(0, 8)}.csv`;
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
