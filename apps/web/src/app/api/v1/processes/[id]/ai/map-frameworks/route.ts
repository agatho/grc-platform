// BPM Overhaul Phase 7: Suggest compliance framework mappings for a process.
// [ARCTOS-FULL-2026-08-31 / WP6 · S05-06, S05-09, S05-10, S05-11, S05-12]

import { db, process, processStep } from "@grc/db";
import {
  aiCompleteGoverned,
  buildFrameworkMappingPrompt,
  frameworkMappingsSchema,
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

const schema = z.object({
  candidateFrameworks: z.array(z.string().max(120)).max(40).optional(),
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

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "compliance_officer", "process_owner");
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("bpm", ctx.orgId, req.method);
  if (m) return m;

  const limited = await aiRateLimit(ctx.userId);
  if (limited) return limited;

  const { id } = await params;
  const [existing] = await db
    .select({
      id: process.id,
      name: process.name,
      description: process.description,
    })
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
  const candidateFrameworks =
    body.success && body.data.candidateFrameworks?.length
      ? body.data.candidateFrameworks
      : DEFAULT_FRAMEWORKS;

  const steps = await db
    .select({ name: processStep.name })
    .from(processStep)
    .where(and(eq(processStep.processId, id), isNull(processStep.deletedAt)));

  try {
    const result = await aiCompleteGoverned({
      feature: "bpm.map_frameworks",
      orgId: ctx.orgId,
      userId: ctx.userId,
      entityType: "process",
      entityId: existing.id,
      messages: buildFrameworkMappingPrompt({
        processName: existing.name,
        processDescription: existing.description,
        activityNames: steps.map((s) => s.name).filter(Boolean) as string[],
        candidateFrameworks,
        locale,
      }),
      maxTokens: 1800,
      temperature: 0.2,
      parse: (raw) => safeJsonParse(raw),
      outputSchema: frameworkMappingsSchema,
    });

    return aiJson(
      {
        suggestions: result.data.mappings,
        provider: result.provider,
        model: result.model,
      },
      result.disclosure,
    );
  } catch (err) {
    return aiErrorResponse(err);
  }
}
