// POST /api/v1/dpms/ropa/[id]/dpia-check
//
// Sprint 3.1: DPIA-Trigger-Check gemaess Art. 35 + EDPB WP 248 (Katalog #10).
//
// Body: { flags: DpiaCriteriaFlags }
// Returns: { flagCount, dpiaRequired, suggestion }
//
// Der Check kann pro RoPA-Entry persistiert werden (in `metadata` oder
// spaeter dedicated `ropa_dpia_assessment`-Tabelle). Heute nur live-
// compute + Suggestion.

import { db, ropaEntry } from "@grc/db";
import { requireModule } from "@grc/auth";
import { countDpiaFlags, isDpiaRequired, type DpiaCriteriaFlags } from "@grc/shared";
import { and, eq } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string }> };

const flagsSchema = z.object({
  systematicMonitoring: z.boolean().default(false),
  specialCategories: z.boolean().default(false),
  largeScale: z.boolean().default(false),
  dataMatching: z.boolean().default(false),
  vulnerableSubjects: z.boolean().default(false),
  innovativeTech: z.boolean().default(false),
  denyRightExercise: z.boolean().default(false),
  automatedDecisionLegal: z.boolean().default(false),
  biometricGenetic: z.boolean().default(false),
});

const bodySchema = z.object({
  flags: flagsSchema,
});

export async function POST(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await withAuth("admin", "dpo", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dpms", ctx.orgId, "POST");
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  // RoPA muss existieren
  const [ropa] = await db
    .select({ id: ropaEntry.id })
    .from(ropaEntry)
    .where(and(eq(ropaEntry.id, id), eq(ropaEntry.orgId, ctx.orgId)));
  if (!ropa) {
    return Response.json({ error: "RoPA not found" }, { status: 404 });
  }

  const flags = parsed.data.flags as DpiaCriteriaFlags;
  const count = countDpiaFlags(flags);
  const required = isDpiaRequired(flags);

  let suggestion: string;
  if (count === 0) {
    suggestion = "Kein DPIA-Trigger erkannt. Normale RoPA-Dokumentation ausreichend.";
  } else if (count === 1) {
    suggestion =
      "Ein Flag erkannt. DPIA empfohlen aber nicht zwingend. Konsultiere DPO fuer Einzelfall-Entscheidung.";
  } else {
    suggestion = `${count} Flags erkannt. DPIA-PFLICHT gemaess Art. 35(3) + EDPB WP 248. DPIA muss VOR Processing-Start erstellt werden.`;
  }

  return Response.json({
    data: {
      ropaId: id,
      flags,
      flagCount: count,
      dpiaRequired: required,
      suggestion,
      nextSteps: required
        ? [
            {
              step: "create_dpia",
              label: "DPIA anlegen",
              endpoint: `/api/v1/dpms/dpia`,
              body: { ropaEntryId: id },
            },
          ]
        : [],
    },
  });
}
