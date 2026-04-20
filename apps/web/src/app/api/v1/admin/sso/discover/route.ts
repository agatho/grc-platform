import { withAuth } from "@/lib/api";
import { discoverOidcSchema } from "@grc/shared";
import { discoverOIDCEndpoints } from "@grc/auth/oidc";

// POST /api/v1/admin/sso/discover — Discover OIDC endpoints from URL
export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const body = await req.json();
  const parsed = discoverOidcSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const discovery = await discoverOIDCEndpoints(parsed.data.discoveryUrl);
    return Response.json({ data: discovery });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to discover OIDC endpoints";
    return Response.json({ error: message }, { status: 422 });
  }
}
