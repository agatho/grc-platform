import { withAuth } from "@/lib/api";
import { parseSamlMetadataSchema } from "@grc/shared";
import { fetchAndParseSAMLMetadata } from "@grc/auth/saml";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// POST /api/v1/admin/sso/metadata — Parse SAML IdP metadata from URL
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const body = await req.json();
  const parsed = parseSamlMetadataSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const metadata = await fetchAndParseSAMLMetadata(parsed.data.metadataUrl);
    return Response.json({ data: metadata });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to parse metadata";
    return Response.json({ error: message }, { status: 422 });
  }
});
