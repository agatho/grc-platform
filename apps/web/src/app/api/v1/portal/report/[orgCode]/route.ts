// POST /api/v1/portal/report/:orgCode — Submit whistleblower report (public, no auth)
// GET  /api/v1/portal/report/:orgCode — Load org info for report form

import {
  wbReport,
  wbCase,
  wbAnonymousMailbox,
  withOrgReadContext,
} from "@grc/db";
import { resolveOrgByCode } from "@grc/auth/anonymous-token";
import { submitReportSchema } from "@grc/shared";
import {
  encrypt,
  hashIp,
  generateMailboxToken,
  isWbCryptoConfigured,
} from "@grc/shared";
import { sql } from "drizzle-orm";

interface RouteParams {
  params: Promise<{ orgCode: string }>;
}

// GET — Org info for report form
export async function GET(_req: Request, { params }: RouteParams) {
  const { orgCode } = await params;

  // #WP3-S02-05 — `organization` is FORCE-RLS and this endpoint is anonymous by
  // design (HinSchG §16: requiring a session would identify the reporter). A
  // context-free read under `grc_app` returned 0 rows, so the legally mandated
  // reporting channel answered "Organization not found" for every valid org
  // code. Resolve through the narrow SECURITY DEFINER helper (migration 0412).
  const org = await resolveOrgByCode(orgCode);

  if (!org) {
    return Response.json({ error: "Organization not found" }, { status: 404 });
  }

  return Response.json({
    data: {
      orgId: org.id,
      orgName: org.name,
      orgCode,
      categories: [
        "fraud",
        "corruption",
        "discrimination",
        "privacy",
        "environmental",
        "health_safety",
        "other",
      ],
    },
  });
}

// POST — Submit report
export async function POST(req: Request, { params }: RouteParams) {
  const { orgCode } = await params;

  // #WP3-S02-05 — see GET above: the org must be resolved before any RLS
  // context can exist.
  const org = await resolveOrgByCode(orgCode);

  if (!org) {
    return Response.json({ error: "Organization not found" }, { status: 404 });
  }

  const body = submitReportSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // #WP8-S07-19.5 — ohne WB_ENCRYPTION_KEY wirft `encrypt()` erst mitten im
  // Vorgang, nachdem die hinweisgebende Person ihre Meldung bereits
  // abgesetzt hat, und die Antwort ist ein nichtssagender 500. Der nach
  // HinSchG §12 vorgeschriebene Meldekanal ist dann unbemerkt tot. Die
  // Prüfung steht bewusst NACH Organisations- und Eingabevalidierung: ein
  // beliebiger Aufrufer soll den Konfigurationszustand nicht erfragen
  // können.
  if (!isWbCryptoConfigured()) {
    console.error(
      "[portal/report] SECURITY: WB_ENCRYPTION_KEY is not configured — " +
        "the whistleblowing intake channel is refusing reports instead of " +
        "storing them unencrypted or losing them (HinSchG §12).",
    );
    return Response.json(
      {
        error:
          "The reporting channel is temporarily unavailable. Please contact the reporting office directly.",
      },
      { status: 503 },
    );
  }

  const now = new Date();
  const tokenExpires = new Date(now.getTime() + 6 * 30 * 24 * 60 * 60 * 1000); // ~6 months
  const acknowledgeDeadline = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const responseDeadline = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // ~3 months

  // Generate tokens
  const reportToken = generateMailboxToken();
  const mailboxToken = generateMailboxToken();

  // Encrypt sensitive fields
  const encryptedDescription = encrypt(body.data.description);
  const encryptedEmail = body.data.contactEmail
    ? encrypt(body.data.contactEmail)
    : null;

  // Hash IP for duplicate detection
  const ip =
    req.headers.get("x-forwarded-for") ||
    req.headers.get("x-real-ip") ||
    "unknown";
  // #WP8-S07-02 — HMAC statt ungesalzenem SHA-256, mit Mandanten-
  // Diskriminator: Duplikaterkennung innerhalb der Organisation bleibt,
  // die Verknuepfbarkeit ueber Mandanten hinweg entfaellt.
  const ipHashed = hashIp(ip, org.id);

  // Generate case number: WB-YYYY-NNN
  const year = now.getFullYear();

  // #WP3-S02-05 — everything below writes FORCE-RLS tables (`wb_report`,
  // `wb_case`, `wb_anonymous_mailbox`). The org is now known, so the whole
  // block runs on a connection pinned to it; without that the insert was
  // rejected by the tenant policy and the tip was silently lost.
  const result = await withOrgReadContext(org.id, async (db) => {
    const countResult = await db.execute(
      sql`SELECT COUNT(*) as cnt FROM wb_case WHERE org_id = ${org.id} AND EXTRACT(YEAR FROM created_at) = ${year}`,
    );
    const count = Number((countResult as any)[0]?.cnt ?? 0) + 1;
    const caseNumber = `WB-${year}-${String(count).padStart(3, "0")}`;

    // Create report, case, and mailbox in transaction
    return db.transaction(async (tx) => {
      const [report] = await tx
        .insert(wbReport)
        .values({
          orgId: org.id,
          reportToken,
          tokenExpiresAt: tokenExpires,
          category: body.data.category,
          description: encryptedDescription,
          contactEmail: encryptedEmail,
          language: body.data.language,
          ipHash: ipHashed,
          submittedAt: now,
          createdAt: now,
        })
        .returning();

      const [wbCaseRow] = await tx
        .insert(wbCase)
        .values({
          orgId: org.id,
          reportId: report!.id,
          caseNumber,
          status: "received",
          priority: "medium",
          acknowledgeDeadline,
          responseDeadline,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      await tx.insert(wbAnonymousMailbox).values({
        reportId: report!.id,
        token: mailboxToken,
        expiresAt: tokenExpires,
      });

      return { reportId: report!.id, caseId: wbCaseRow!.id, caseNumber };
    });
  });

  return Response.json(
    {
      data: {
        mailboxToken,
        caseNumber: result.caseNumber,
        tokenExpiresAt: tokenExpires.toISOString(),
      },
    },
    { status: 201 },
  );
}
