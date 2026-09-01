// BPM Overhaul Phase 7: diagram-optimization-hints endpoint.
//
// [ARCTOS-FULL-2026-08-31 / WP6 · S05-06, S05-09, S05-10, S05-11, S05-12]
// Der im Audit genannte Beispielfall: `severity: "kritisch!!!"` und eine
// erfundene `bpmnElementId` wurden unverändert an die BPMN-Oberfläche
// durchgereicht, die daraufhin ein nicht existierendes Element markierte.
// `severity` ist jetzt ein Enum, und Hinweise mit einer Element-ID, die
// im übermittelten XML nicht vorkommt, werden serverseitig verworfen.

import { db, process, processVersion, processStep } from "@grc/db";
import {
  aiCompleteGoverned,
  buildDiagramOptimizationPrompt,
  diagramHintsSchema,
  safeJsonParse,
} from "@grc/ai";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { z } from "zod";
import {
  aiRateLimit,
  aiErrorResponse,
  aiJson,
} from "../../../../ai/_shared/ai-route";

const schema = z.object({ locale: z.enum(["de", "en"]).optional() });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "process_owner", "quality_manager");
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("bpm", ctx.orgId, req.method);
  if (m) return m;

  // 6 KB BPMN-XML je Aufruf — eigener, engerer Eimer.
  const limited = await aiRateLimit(ctx.userId, {
    bucket: "bpmn-optimize",
    capacity: 10,
    windowSeconds: 600,
  });
  if (limited) return limited;

  const { id } = await params;
  const [existing] = await db
    .select({ id: process.id, name: process.name })
    .from(process)
    .where(
      and(
        eq(process.id, id),
        eq(process.orgId, ctx.orgId),
        isNull(process.deletedAt),
      ),
    );
  if (!existing)
    return Response.json({ error: "Process not found" }, { status: 404 });

  const body = schema.safeParse(await req.json().catch(() => ({})));
  const locale = body.success ? (body.data.locale ?? "de") : "de";

  const [version] = await db
    .select({ bpmnXml: processVersion.bpmnXml })
    .from(processVersion)
    .where(
      and(eq(processVersion.processId, id), eq(processVersion.isCurrent, true)),
    )
    .limit(1);
  if (!version?.bpmnXml) {
    return Response.json({ error: "No current BPMN version" }, { status: 404 });
  }

  const steps = await db
    .select({ stepType: processStep.stepType })
    .from(processStep)
    .where(and(eq(processStep.processId, id), isNull(processStep.deletedAt)));
  const activityCount = steps.filter((s) =>
    ["task", "subprocess", "call_activity"].includes(s.stepType as string),
  ).length;
  const gatewayCount = steps.filter((s) => s.stepType === "gateway").length;

  const excerpt = version.bpmnXml.slice(0, 6000);

  try {
    const result = await aiCompleteGoverned({
      feature: "bpm.optimize_diagram",
      orgId: ctx.orgId,
      userId: ctx.userId,
      entityType: "process",
      entityId: existing.id,
      messages: buildDiagramOptimizationPrompt({
        processName: existing.name,
        bpmnXml: excerpt,
        activityCount,
        gatewayCount,
        locale,
      }),
      maxTokens: 1800,
      temperature: 0.2,
      parse: (raw) => safeJsonParse(raw),
      outputSchema: diagramHintsSchema,
    });

    // Element-IDs, die im übermittelten Ausschnitt nicht vorkommen, sind
    // erfunden. Sie werden entfernt, der Hinweis selbst bleibt erhalten.
    const hints = result.data.hints.map((h) =>
      h.bpmnElementId && !excerpt.includes(h.bpmnElementId)
        ? { ...h, bpmnElementId: null, elementIdDiscarded: true }
        : h,
    );

    return aiJson(
      { hints, provider: result.provider, model: result.model },
      result.disclosure,
    );
  } catch (err) {
    return aiErrorResponse(err);
  }
}
