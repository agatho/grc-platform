// BPM Overhaul Phase 7: Generate BPMN XML from a text description.

import { aiComplete, buildTextToBpmnPrompt, safeJsonParse } from "@grc/ai";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { z } from "zod";

const schema = z.object({
  description: z.string().min(5).max(4000),
  locale: z.enum(["de", "en"]).optional(),
  containsPersonalData: z.boolean().optional(),
});

interface BpmnResult {
  bpmnXml?: string;
  summary?: string;
  activities?: Array<{ name: string; type?: string; description?: string }>;
}

export async function POST(req: Request) {
  const ctx = await withAuth("admin", "process_owner", "quality_manager");
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("bpm", ctx.orgId, req.method);
  if (m) return m;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const prompt = buildTextToBpmnPrompt(
    parsed.data.description,
    parsed.data.locale ?? "de",
  );

  let response;
  try {
    response = await aiComplete({
      messages: prompt,
      maxTokens: 4000,
      temperature: 0.3,
      containsPersonalData: parsed.data.containsPersonalData,
    });
  } catch (err) {
    return Response.json(
      { error: "AI provider failure", details: (err as Error).message },
      { status: 502 },
    );
  }

  const parsedResp = safeJsonParse<BpmnResult>(response.text);
  if (!parsedResp || !parsedResp.bpmnXml) {
    return Response.json(
      {
        error: "AI returned unparseable output",
        rawSample: response.text.slice(0, 500),
      },
      { status: 502 },
    );
  }

  // Quick sanity check: must contain bpmn:definitions opening tag
  if (!/<bpmn:definitions/i.test(parsedResp.bpmnXml)) {
    return Response.json(
      {
        error: "AI output is not valid BPMN XML",
        rawSample: parsedResp.bpmnXml.slice(0, 500),
      },
      { status: 502 },
    );
  }

  return Response.json({
    data: {
      bpmnXml: parsedResp.bpmnXml,
      summary: parsedResp.summary ?? null,
      activities: parsedResp.activities ?? [],
      provider: response.provider,
      model: response.model,
    },
  });
}
