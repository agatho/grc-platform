import { db, dsr } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";
import { requireUuidParam } from "@/lib/param-validation";

// GET /api/v1/dpms/dsr/[id]/transitions
//
// Discovery for the Data Subject Request (DSGVO Art. 12-22) lifecycle.
// Status (dsr_status enum):
//   received → verified → processing → response_sent → closed
//   (rejected can come from any pre-closed state)
//
// DSR uses NAMED workflow routes (verify, respond, close) instead of
// a generic PUT /status. The discovery exposes both the status matrix
// AND each side-channel route, so the UI doesn't have to know which
// transitions go through which route.

const DSR_STATUSES = [
  "received",
  "verified",
  "processing",
  "response_sent",
  "closed",
  "rejected",
] as const;

const DSR_ALLOWED: Record<
  (typeof DSR_STATUSES)[number],
  (typeof DSR_STATUSES)[number][]
> = {
  received: ["verified", "rejected"],
  verified: ["processing", "rejected"],
  processing: ["response_sent", "rejected"],
  response_sent: ["closed"],
  closed: [],
  rejected: [],
};

const SIDE_CHANNELS: Record<
  string,
  { method: string; endpoint: string; purpose: string; bodyShape: object }
> = {
  // received → verified — identity verification of the requester.
  verify: {
    method: "POST",
    endpoint: "<replaced at runtime>",
    purpose:
      "Mark the requester's identity as verified. Body must capture the verification method (e.g. id_doc, video_call, signed_letter) for audit.",
    bodyShape: {
      verificationMethod: "<string>",
      verifiedBy: "<userId>",
      verifiedAt: "<ISO datetime, defaults to now>",
    },
  },
  // processing → response_sent — formal response delivered.
  respond: {
    method: "POST",
    endpoint: "<replaced at runtime>",
    purpose:
      "Record that a response was delivered to the data subject. Body captures the response artefact (link to file, summary, channel).",
    bodyShape: {
      responseChannel: "<email | postal | portal>",
      summary: "<string>",
      responseArtefactUrl: "<optional URL>",
    },
  },
  // response_sent → closed — case closure.
  close: {
    method: "POST",
    endpoint: "<replaced at runtime>",
    purpose:
      "Close the DSR after the response was acknowledged or the appeal window expired. Optional reason captured for audit.",
    bodyShape: {
      reason: "<optional string>",
    },
  },
};

type IdCtx = { params: Promise<{ id: string }> };

export const GET = withErrorHandler<IdCtx>(async function GET(req, { params }) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("dpms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const { id } = await params;
  requireUuidParam(id);

  const [row] = await db
    .select({ status: dsr.status })
    .from(dsr)
    .where(and(eq(dsr.id, id), eq(dsr.orgId, ctx.orgId)));

  if (!row) {
    return Response.json({ error: "DSR not found" }, { status: 404 });
  }

  // Bind each side-channel's endpoint URL to this DSR's id.
  const sideChannels = Object.fromEntries(
    Object.entries(SIDE_CHANNELS).map(([key, channel]) => [
      key,
      { ...channel, endpoint: `/api/v1/dpms/dsr/${id}/${key}` },
    ]),
  );

  return Response.json({
    data: {
      current: row.status,
      knownStatuses: DSR_STATUSES,
      allowedNext: DSR_ALLOWED[row.status] ?? [],
      // DSR doesn't use a generic PUT /status — every transition
      // goes through a named route. The "endpoint" field lists the
      // canonical entry point for the next allowed transition.
      sideChannels,
      note: "DSR transitions go through the named workflow routes (verify, respond, close), not via PUT /dsr/{id}. Each route captures additional audit metadata required by DSGVO Art. 30 record-keeping.",
    },
  });
});
