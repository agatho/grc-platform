import { db, apiUsageLog } from "@grc/db";
import { withAuth } from "@/lib/api";
import { z } from "zod";

const executeSchema = z.object({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  path: z.string().min(1).max(500),
  headers: z.record(z.string(), z.string()).default({}),
  queryParams: z.record(z.string(), z.string()).default({}),
  body: z.string().max(50000).optional(),
});

// POST /api/v1/playground/execute — Execute API request from playground
export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const body = executeSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const startTime = Date.now();

  try {
    const baseUrl = new URL(req.url).origin;
    const targetUrl = new URL(body.data.path, baseUrl);
    Object.entries(body.data.queryParams).forEach(([k, v]) => {
      targetUrl.searchParams.set(k, v);
    });

    const fetchOpts: RequestInit = {
      method: body.data.method,
      headers: {
        "Content-Type": "application/json",
        ...body.data.headers,
      },
    };

    if (body.data.body && ["POST", "PUT", "PATCH"].includes(body.data.method)) {
      fetchOpts.body = body.data.body;
    }

    const response = await fetch(targetUrl.toString(), fetchOpts);
    const responseBody = await response.text();
    const responseTimeMs = Date.now() - startTime;

    // Log the usage
    await db.insert(apiUsageLog).values({
      orgId: ctx.orgId,
      method: body.data.method,
      path: body.data.path,
      statusCode: response.status,
      responseTimeMs,
      requestSize: body.data.body?.length ?? 0,
      responseSize: responseBody.length,
    });

    return Response.json({
      data: {
        statusCode: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseBody,
        responseTimeMs,
      },
    });
  } catch (error) {
    const responseTimeMs = Date.now() - startTime;
    return Response.json(
      {
        data: {
          statusCode: 0,
          headers: {},
          body: error instanceof Error ? error.message : "Request failed",
          responseTimeMs,
        },
      },
      { status: 200 },
    );
  }
}
