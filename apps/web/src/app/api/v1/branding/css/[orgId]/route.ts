import { db, orgBranding, organization } from "@grc/db";
import { eq } from "drizzle-orm";
import {
  computeContrastForeground,
  computeDarkModeColor,
} from "@grc/shared";

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
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;

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
    colors.darkModeAccentColor ?? computeDarkModeColor(colors.accentColor, 10);
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
      "Cache-Control": "public, max-age=3600",
    },
  });
}
