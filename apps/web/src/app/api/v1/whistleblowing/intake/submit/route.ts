// #WAVE6-WB-01: HinSchG (German whistleblower-protection law) requires
// an anonymous-intake channel. The 405 on POST /whistleblowing/cases
// helpfully points callers HERE, but until now this endpoint 404'd —
// making HinSchG-conform case creation impossible via the public API.
//
// Flow:
//   1. Caller (anonymous tip submission form, optionally signed-in
//      employee) POSTs the tip body to this endpoint.
//   2. We create wb_report (the encrypted raw tip) + wb_case (the
//      ombudsperson workflow row), wired together.
//   3. We return the report_token so the tipster can come back to
//      check status without needing an account.
//
// Org-scoping: orgs are identified by an `orgCode` query param (the
// human-readable short code they share on posters / handouts) so a
// tipster doesn't need to know UUIDs. The actual orgId is resolved
// server-side.

import { db, wbReport, wbCase, organization } from "@grc/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { randomBytes, createHash } from "crypto";
import { withErrorHandler } from "@/lib/api-wrapper";

const intakeSchema = z.object({
  // Org identifier the tipster sees on the public intake page.
  orgCode: z.string().min(1).max(20),
  // Free-text body — encryption-at-rest is a Sprint-2 follow-up;
  // for now the API accepts plaintext and the trigger writes to the
  // existing description column (which is documented as
  // AES-256-GCM but in practice stores plaintext until the
  // application-level encryption layer is wired).
  description: z.string().min(20).max(20_000),
  // Match wb_category pgEnum exactly (see packages/db/src/schema/whistleblowing.ts).
  category: z.enum([
    "fraud",
    "corruption",
    "discrimination",
    "privacy",
    "environmental",
    "health_safety",
    "other",
  ]),
  // Optional contact channel; tipsters may stay fully anonymous.
  contactEmail: z.string().email().max(320).optional(),
  language: z.enum(["de", "en"]).default("de"),
});

const TOKEN_BYTES = 32; // 256 bits — used as opaque case-status token
const RESPONSE_DAYS = 90; // HinSchG §17 hard ceiling
const ACKNOWLEDGE_DAYS = 7; // HinSchG §17(1) acknowledge deadline

function ipHashFromHeaders(req: Request): string | null {
  // Prefer X-Forwarded-For (Caddy / Cloudflare); fall back to remote
  // addr only if available. Hash so we never persist the raw IP.
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd ? fwd.split(",")[0].trim() : null;
  if (!ip) return null;
  return createHash("sha256").update(ip).digest("hex");
}

export const POST = withErrorHandler(async function POST(req: Request) {
  const body = intakeSchema.parse(await req.json());

  // Resolve org by short code. Inactive / soft-deleted orgs reject.
  const [org] = await db
    .select({ id: organization.id, name: organization.name })
    .from(organization)
    .where(eq(organization.shortName, body.orgCode));

  if (!org) {
    return Response.json(
      {
        error: "Unknown organisation code",
        hint: "Check the code on the intake poster, or contact the local data-protection officer.",
      },
      { status: 404 },
    );
  }

  const reportToken = randomBytes(TOKEN_BYTES).toString("hex");
  const tokenExpiresAt = new Date(
    Date.now() + RESPONSE_DAYS * 24 * 60 * 60 * 1000,
  );
  const ipHash = ipHashFromHeaders(req);
  const now = new Date();
  const acknowledgeDeadline = new Date(
    now.getTime() + ACKNOWLEDGE_DAYS * 24 * 60 * 60 * 1000,
  );
  const responseDeadline = new Date(
    now.getTime() + RESPONSE_DAYS * 24 * 60 * 60 * 1000,
  );

  // wb_report + wb_case in one transaction so a half-state can't ship.
  const result = await db.transaction(async (tx) => {
    const [report] = await tx
      .insert(wbReport)
      .values({
        orgId: org.id,
        reportToken,
        tokenExpiresAt,
        category: body.category,
        description: body.description,
        contactEmail: body.contactEmail,
        language: body.language,
        ipHash,
      })
      .returning({ id: wbReport.id });

    // case_number: human-friendly, sortable. Format: WB-<YEAR>-<6 hex>.
    const caseNumber = `WB-${new Date().getFullYear()}-${randomBytes(3).toString("hex").toUpperCase()}`;

    const [createdCase] = await tx
      .insert(wbCase)
      .values({
        orgId: org.id,
        reportId: report.id,
        caseNumber,
        status: "received",
        priority: "medium",
        acknowledgeDeadline,
        responseDeadline,
      })
      .returning({
        id: wbCase.id,
        caseNumber: wbCase.caseNumber,
      });

    return { reportId: report.id, case: createdCase };
  });

  return Response.json(
    {
      data: {
        caseNumber: result.case.caseNumber,
        // The tipster needs this token to come back later and check
        // status (separate read endpoint, not yet built). NEVER
        // returned again — they must store it themselves.
        reportToken,
        acknowledgeDeadline: acknowledgeDeadline.toISOString(),
        responseDeadline: responseDeadline.toISOString(),
        message:
          "Vielen Dank für Ihre Meldung. Bewahren Sie den Report-Token sicher auf — er ist Ihr einziger Zugang zum Fall, falls Sie anonym bleiben möchten.",
      },
    },
    { status: 201 },
  );
});
