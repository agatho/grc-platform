import { withAuth } from "@/lib/api";
import { generateTemplate } from "@/lib/import-export/export-engine";
import { getSupportedEntityTypes } from "@/lib/import-export/entity-registry";

// GET /api/v1/import/templates/:entityType — Download template CSV
export async function GET(
  req: Request,
  { params }: { params: Promise<{ entityType: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { entityType } = await params;

  if (!getSupportedEntityTypes().includes(entityType)) {
    return Response.json(
      {
        error: `Unknown entity type: ${entityType}. Supported: ${getSupportedEntityTypes().join(", ")}`,
      },
      { status: 400 },
    );
  }

  try {
    const result = generateTemplate(entityType);

    return new Response(new Uint8Array(result.data), {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${result.fileName}"`,
      },
    });
  } catch (err) {
    // #SEC-LEAK-FIX: don't echo err.message back to the client; log
    // server-side so operators can grep by route + requestId.
    console.error("[import/templates] template generation failed", err);
    return Response.json(
      { error: "Failed to generate template" },
      { status: 500 },
    );
  }
}
