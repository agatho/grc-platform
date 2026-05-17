// BPM Overhaul Phase 7: Suggest controls for a process.

import { db, process, processStep, control } from "@grc/db";
import { aiComplete, buildControlSuggestionPrompt, safeJsonParse } from "@grc/ai";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { z } from "zod";

const schema = z.object({ locale: z.enum(["de", "en"]).optional() });

interface Suggestion {
  title: string;
  controlType?: string;
  automationLevel?: string;
  description?: string;
  addressesRisks?: string[];
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "process_owner", "control_owner");
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("bpm", ctx.orgId, req.method);
  if (m) return m;

  const { id } = await params;
  const [existing] = await db
    .select({ id: process.id, name: process.name, description: process.description })
    .from(process)
    .where(and(eq(process.id, id), eq(process.orgId, ctx.orgId), isNull(process.deletedAt)));
  if (!existing) return Response.json({ error: "Process not found" }, { status: 404 });

  const body = schema.safeParse(await req.json().catch(() => ({})));
  const locale = body.success ? body.data.locale ?? "de" : "de";

  const steps = await db
    .select({ name: processStep.name })
    .from(processStep)
    .where(and(eq(processStep.processId, id), isNull(processStep.deletedAt)));

  const linkedRisks = await db.execute(sql`
    SELECT DISTINCT r.title
    FROM risk r
    WHERE r.deleted_at IS NULL
      AND r.org_id = ${ctx.orgId}
      AND r.id IN (
        SELECT risk_id FROM process_risk WHERE process_id = ${id}
        UNION
        SELECT psr.risk_id FROM process_step_risk psr
        JOIN process_step ps ON ps.id = psr.process_step_id
        WHERE ps.process_id = ${id}
      )
  `);

  const linkedControls = await db.execute(sql`
    SELECT DISTINCT c.title
    FROM control c
    WHERE c.deleted_at IS NULL
      AND c.org_id = ${ctx.orgId}
      AND c.id IN (
        SELECT control_id FROM process_control WHERE process_id = ${id}
        UNION
        SELECT psc.control_id FROM process_step_control psc
        JOIN process_step ps ON ps.id = psc.process_step_id
        WHERE ps.process_id = ${id}
      )
  `);

  const prompt = buildControlSuggestionPrompt({
    processName: existing.name,
    processDescription: existing.description,
    activityNames: steps.map((s) => s.name).filter(Boolean) as string[],
    linkedRiskTitles: (linkedRisks as any[]).map((r) => r.title),
    existingControlTitles: (linkedControls as any[]).map((c) => c.title),
    locale,
  });

  let resp;
  try {
    resp = await aiComplete({ messages: prompt, maxTokens: 1500, temperature: 0.4 });
  } catch (err) {
    return Response.json(
      { error: "AI provider failure", details: (err as Error).message },
      { status: 502 },
    );
  }

  const parsed = safeJsonParse<{ controls?: Suggestion[] }>(resp.text);
  return Response.json({
    data: { suggestions: parsed?.controls ?? [], provider: resp.provider, model: resp.model },
  });
}
