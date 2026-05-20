// BPM Overhaul Phase 7: diagram-optimization-hints endpoint.

import { db, process, processVersion, processStep } from "@grc/db";
import {
  aiComplete,
  buildDiagramOptimizationPrompt,
  safeJsonParse,
} from "@grc/ai";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { z } from "zod";

const schema = z.object({ locale: z.enum(["de", "en"]).optional() });

interface Hint {
  severity: "info" | "warning" | "error";
  kind: string;
  bpmnElementId?: string;
  message: string;
  rationale?: string;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "process_owner", "quality_manager");
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("bpm", ctx.orgId, req.method);
  if (m) return m;

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

  const prompt = buildDiagramOptimizationPrompt({
    processName: existing.name,
    bpmnXml: version.bpmnXml,
    activityCount,
    gatewayCount,
    locale,
  });

  let resp;
  try {
    resp = await aiComplete({
      messages: prompt,
      maxTokens: 1800,
      temperature: 0.2,
    });
  } catch (err) {
    return Response.json(
      { error: "AI provider failure", details: (err as Error).message },
      { status: 502 },
    );
  }

  const parsed = safeJsonParse<{ hints?: Hint[] }>(resp.text);
  return Response.json({
    data: {
      hints: parsed?.hints ?? [],
      provider: resp.provider,
      model: resp.model,
    },
  });
}
