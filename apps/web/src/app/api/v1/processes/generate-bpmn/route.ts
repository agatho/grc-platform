import { generateBpmnSchema } from "@grc/shared";
import { validateBpmnXml } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import Anthropic from "@anthropic-ai/sdk";

// In-memory rate limit: 10 requests per hour per user
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT) {
    return false;
  }

  entry.count++;
  return true;
}

const SYSTEM_PROMPT = `You are a BPMN 2.0 expert. Generate valid BPMN 2.0 XML based on the process description provided.

Requirements:
- Output ONLY valid BPMN 2.0 XML, no markdown, no explanation
- Include proper namespace declarations (bpmn, bpmndi, dc, di)
- Include a BPMNDiagram element with proper layout coordinates
- Every element must have a corresponding BPMNShape or BPMNEdge in the diagram
- Use meaningful element IDs and names
- Include start event, end event, tasks, and gateways as appropriate
- Use sequence flows to connect all elements
- Layout should be left-to-right with proper spacing (x increments of ~180, y centered around 200)
- Tasks should be 100x80, events 36x36, gateways 50x50
- Ensure the XML is well-formed and parseable`;

// POST /api/v1/processes/generate-bpmn — AI generate BPMN
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "process_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = generateBpmnSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Rate limit check
  if (!checkRateLimit(ctx.userId)) {
    return Response.json(
      {
        error: "Rate limit exceeded",
        message: "Maximum 10 BPMN generation requests per hour. Please try again later.",
      },
      { status: 429 },
    );
  }

  const { name, description, industry } = body.data;

  try {
    const anthropic = new Anthropic();

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Generate a BPMN 2.0 XML diagram for the following process:

Process Name: ${name}
Industry: ${industry}
Description: ${description}

Generate a complete, valid BPMN 2.0 XML with proper diagram layout coordinates. Output ONLY the XML, nothing else.`,
        },
      ],
    });

    // Extract text content from response
    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return Response.json(
        { error: "AI did not return text content" },
        { status: 500 },
      );
    }

    let bpmnXml = textBlock.text.trim();

    // Strip markdown code fences if present
    if (bpmnXml.startsWith("```")) {
      bpmnXml = bpmnXml
        .replace(/^```(?:xml)?\n?/, "")
        .replace(/\n?```$/, "")
        .trim();
    }

    // Validate the generated XML
    const validation = validateBpmnXml(bpmnXml);
    if (!validation.valid) {
      return Response.json(
        {
          error: "Generated BPMN XML failed validation",
          validationErrors: validation.errors,
          bpmnXml, // Return it anyway so the user can fix it
        },
        { status: 422 },
      );
    }

    return Response.json({
      data: {
        bpmnXml,
        processName: name,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return Response.json(
      { error: `AI generation failed: ${message}` },
      { status: 500 },
    );
  }
}
