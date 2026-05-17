// BPM Overhaul Phase 7: Suggest compliance framework mappings for a process.

import { db, process, processStep } from "@grc/db";
import { aiComplete, buildFrameworkMappingPrompt, safeJsonParse } from "@grc/ai";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { z } from "zod";

const schema = z.object({
  candidateFrameworks: z.array(z.string()).optional(),
  locale: z.enum(["de", "en"]).optional(),
});

const DEFAULT_FRAMEWORKS = [
  "iso-27001",
  "iso-9001",
  "iso-22301",
  "iso-27002",
  "gdpr",
  "nis2",
  "dora",
  "coso",
];

interface Mapping {
  frameworkCode: string;
  entryCode?: string;
  title?: string;
  mappingStrength?: "covers" | "partial" | "references";
  rationale?: string;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "compliance_officer", "process_owner");
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
  const candidateFrameworks =
    (body.success && body.data.candidateFrameworks?.length
      ? body.data.candidateFrameworks
      : DEFAULT_FRAMEWORKS);

  const steps = await db
    .select({ name: processStep.name })
    .from(processStep)
    .where(and(eq(processStep.processId, id), isNull(processStep.deletedAt)));

  const prompt = buildFrameworkMappingPrompt({
    processName: existing.name,
    processDescription: existing.description,
    activityNames: steps.map((s) => s.name).filter(Boolean) as string[],
    candidateFrameworks,
    locale,
  });

  let resp;
  try {
    resp = await aiComplete({ messages: prompt, maxTokens: 1800, temperature: 0.2 });
  } catch (err) {
    return Response.json(
      { error: "AI provider failure", details: (err as Error).message },
      { status: 502 },
    );
  }

  const parsed = safeJsonParse<{ mappings?: Mapping[] }>(resp.text);
  return Response.json({
    data: { suggestions: parsed?.mappings ?? [], provider: resp.provider, model: resp.model },
  });
}
