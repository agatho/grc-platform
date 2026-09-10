import { orgBranding, organization, withOrgReadContext } from "@grc/db";
import { eq } from "drizzle-orm";
import { computeContrastForeground, computeDarkModeColor } from "@grc/shared";
import { withErrorHandler } from "@/lib/api-wrapper";
import { problem, getRequestId } from "@/lib/api-errors";

// [ARCTOS-FULL-2026-08-31 / Welle 4b-7 · OP-116] Das Pfadsegment ging
// ungeprueft in `withOrgReadContext(orgId, …)` und von dort in
// `eq(orgBranding.orgId, orgId)` gegen eine `uuid`-Spalte. Ein Aufruf von
// `/api/v1/branding/css/foo` — und die ANMELDESEITE baut diese URL aus einem
// Abfrageparameter, den der Aufrufer setzt — endete in
// `invalid input syntax for type uuid: "foo"`, ohne Fehlerpfad, also als
// 500er mit leerem Rumpf. Ein 404 ist hier die richtige Antwort: es gibt
// keine Organisation mit dieser Kennung, und mehr darf ein
// unauthentifizierter Aufrufer an dieser Stelle ohnehin nicht erfahren.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DEFAULT_COLORS = {
  primaryColor: "#2563eb",
  secondaryColor: "#1e40af",
  accentColor: "#f59e0b",
  textColor: "#0f172a",
  backgroundColor: "#ffffff",
  darkModePrimaryColor: null as string | null,
  darkModeAccentColor: null as string | null,
};

// GET /api/v1/branding/css/:orgId -- Public CSS custom properties endpoint (cached 1h)
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;

  if (!UUID_RE.test(orgId)) {
    return problem.notFound({
      requestId: getRequestId(req),
      instance: req.url,
      detail: "No branding exists for this organization.",
    });
  }

  // #WP3-S02-05 — `org_branding` and `organization` are FORCE-RLS. This route
  // is loaded by the LOGIN page, i.e. before any session exists, so no request
  // context is established and a context-free read under `grc_app` returned
  // 0 rows — every tenant silently fell back to the default palette. The org
  // is the path parameter here, so pin it for these reads.
  return withOrgReadContext(orgId, async (db) => {
    // Resolve branding (with inheritance)
    let branding: typeof DEFAULT_COLORS | null = null;

    const brandings = await db
      .select()
      .from(orgBranding)
      .where(eq(orgBranding.orgId, orgId))
      .limit(1);

    if (brandings[0]) {
      const b = brandings[0];
      branding = {
        primaryColor: b.primaryColor,
        secondaryColor: b.secondaryColor,
        accentColor: b.accentColor,
        textColor: b.textColor,
        backgroundColor: b.backgroundColor,
        darkModePrimaryColor: b.darkModePrimaryColor,
        darkModeAccentColor: b.darkModeAccentColor,
      };

      // If inheriting, resolve parent
      if (b.inheritFromParent) {
        const orgs = await db
          .select({ parentOrgId: organization.parentOrgId })
          .from(organization)
          .where(eq(organization.id, orgId))
          .limit(1);

        if (orgs[0]?.parentOrgId) {
          const parentBrandings = await db
            .select()
            .from(orgBranding)
            .where(eq(orgBranding.orgId, orgs[0].parentOrgId))
            .limit(1);

          if (parentBrandings[0]) {
            const pb = parentBrandings[0];
            branding = {
              primaryColor: pb.primaryColor,
              secondaryColor: pb.secondaryColor,
              accentColor: pb.accentColor,
              textColor: pb.textColor,
              backgroundColor: pb.backgroundColor,
              darkModePrimaryColor: pb.darkModePrimaryColor,
              darkModeAccentColor: pb.darkModeAccentColor,
            };
          }
        }
      }
    }

    const colors = branding ?? DEFAULT_COLORS;

    // Auto-compute foreground colors based on WCAG contrast
    const primaryFg = computeContrastForeground(colors.primaryColor);
    const secondaryFg = computeContrastForeground(colors.secondaryColor);
    const accentFg = computeContrastForeground(colors.accentColor);

    // Auto-compute dark mode colors if not explicitly set
    const darkPrimary =
      colors.darkModePrimaryColor ??
      computeDarkModeColor(colors.primaryColor, 15);
    const darkAccent =
      colors.darkModeAccentColor ??
      computeDarkModeColor(colors.accentColor, 10);
    const darkPrimaryFg = computeContrastForeground(darkPrimary);
    const darkAccentFg = computeContrastForeground(darkAccent);

    const css = `/* ARCTOS Brand CSS -- org ${orgId} -- generated ${new Date().toISOString()} */
:root {
  --brand-primary: ${colors.primaryColor};
  --brand-secondary: ${colors.secondaryColor};
  --brand-accent: ${colors.accentColor};
  --brand-text: ${colors.textColor};
  --brand-background: ${colors.backgroundColor};
  --brand-primary-foreground: ${primaryFg};
  --brand-secondary-foreground: ${secondaryFg};
  --brand-accent-foreground: ${accentFg};
}

.dark {
  --brand-primary: ${darkPrimary};
  --brand-accent: ${darkAccent};
  --brand-primary-foreground: ${darkPrimaryFg};
  --brand-accent-foreground: ${darkAccentFg};
  --brand-text: #f1f5f9;
  --brand-background: #0f172a;
}

@media (prefers-color-scheme: dark) {
  :root:not(.light) {
    --brand-primary: ${darkPrimary};
    --brand-accent: ${darkAccent};
    --brand-primary-foreground: ${darkPrimaryFg};
    --brand-accent-foreground: ${darkAccentFg};
    --brand-text: #f1f5f9;
    --brand-background: #0f172a;
  }
}
`;

    return new Response(css, {
      headers: {
        "Content-Type": "text/css",
        // [ARCTOS-FULL-2026-08-31 / WP12 · S12-11] Was `public, max-age=3600`.
        //
        // `public` marks a response that sits behind the auth middleware
        // (`/api/v1/branding/**` is not on the public allowlist) as storable by
        // SHARED caches — a CDN, a corporate forward proxy. There is no
        // cross-tenant leak here (the orgId is part of the path and therefore
        // part of every RFC-compliant cache key, and the body even repeats it
        // literally), which is why this is Low and not High. The semantics
        // were nonetheless wrong, and "no leak because the cache key happens
        // to contain the tenant" is not a control anyone should rely on.
        //
        // `private` keeps the browser-side caching that the endpoint exists
        // for — the login page fetches it on every visit — while removing the
        // shared-cache permission. `Vary: Cookie` is deliberate: the response
        // does not depend on the cookie today, but stating it prevents a
        // future personalised variant from being served from a stale entry.
        "Cache-Control": "private, max-age=3600",
        Vary: "Cookie",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
});
