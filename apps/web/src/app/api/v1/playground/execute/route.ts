import { db, apiUsageLog } from "@grc/db";
import { withAuth } from "@/lib/api";
import { z } from "zod";

// #SEC-HIGH-SSRF: the `path` is fed into `new URL(path, base)`. When
// `path` is itself an absolute URL (starts with "http://" or
// "https://"), the URL constructor IGNORES the base and uses `path`
// directly — admin can target arbitrary internal hosts, cloud-
// metadata endpoints (169.254.169.254), localhost services, etc.
// The Zod refine below blocks anything that doesn't start with "/".
// That keeps the playground useful (callers test their own API
// endpoints) while shutting the SSRF door.
const executeSchema = z.object({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  path: z
    .string()
    .min(1)
    .max(500)
    // #SEC-HIGH-SSRF (F-A): reject absolute URLs, protocol-relative "//host",
    // AND backslash variants. The WHATWG URL parser normalizes "\" → "/" for
    // http(s), so "/\evil.com" would otherwise pass startsWith checks and
    // resolve host=evil.com. Belt: forbid any backslash outright. Suspenders:
    // a same-origin assertion after URL construction below.
    .refine(
      (p) => p.startsWith("/") && !p.startsWith("//") && !p.includes("\\"),
      {
        message:
          "path must be a relative URL beginning with '/' — absolute URLs, " +
          "protocol-relative URLs and backslash escapes are blocked (SSRF prevention)",
      },
    ),
  headers: z
    .record(z.string(), z.string())
    // #S04-08: bound the map so the allowlist loop below cannot be used
    // as a CPU sink.
    .refine((h) => Object.keys(h).length <= 20, {
      message: "At most 20 headers are allowed",
    })
    .default({}),
  queryParams: z.record(z.string(), z.string()).default({}),
  body: z.string().max(50000).optional(),
});

// #S04-08: headers the playground may forward to same-origin API routes.
// Deliberately excludes every header the platform itself trusts:
// authorization, cookie, x-forwarded-*, x-real-ip, host, origin, referer,
// and the internal x-org-id / x-user-id style signals.
const FORWARDABLE_HEADERS = new Set([
  "content-type",
  "accept",
  "accept-language",
  "if-match",
  "if-none-match",
  "x-request-id",
  "x-idempotency-key",
]);

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
    // #SEC-HIGH-SSRF (F-A): hard same-origin gate. The playground only ever
    // proxies the app's own API; anything that resolves off-origin (via any
    // parser normalization trick) is refused before fetch().
    if (targetUrl.origin !== baseUrl) {
      return Response.json(
        {
          error:
            "path must resolve to a same-origin relative URL (SSRF prevention)",
        },
        { status: 422 },
      );
    }
    Object.entries(body.data.queryParams).forEach(([k, v]) => {
      targetUrl.searchParams.set(k, v);
    });

    // #S04-08 (ARCTOS-FULL-2026-08-31, Low): the proxy forwarded ANY
    // caller-supplied header to the app's own API routes. That let an admin
    // inject `X-Forwarded-For` (spoofing the client IP seen by rate limiting
    // and IP allowlists), `Authorization` / `Cookie` (acting as another
    // principal against internal routes), or `Host`. Not SSRF — the
    // same-origin gate above already closed that — but a real header-
    // injection primitive against the platform's own trust signals.
    //
    // Allowlist instead of blocklist: only headers a playground user
    // legitimately needs to vary survive. Everything else is dropped, and
    // the caller is told which ones so the UI can explain it.
    const forwarded: Record<string, string> = {};
    const rejectedHeaders: string[] = [];
    for (const [name, value] of Object.entries(body.data.headers)) {
      if (FORWARDABLE_HEADERS.has(name.toLowerCase())) {
        forwarded[name] = value;
      } else {
        rejectedHeaders.push(name);
      }
    }

    const fetchOpts: RequestInit = {
      method: body.data.method,
      headers: {
        "Content-Type": "application/json",
        ...forwarded,
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
        // #S04-08: make the drop visible instead of silently ignoring it.
        ...(rejectedHeaders.length > 0 ? { rejectedHeaders } : {}),
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
