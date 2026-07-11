// Load org branding (org_branding, Migration 0024 + 0329) for report
// headers/footers: org name, primary color, confidentiality notice and
// logo file (uploaded to public/uploads/branding/{orgId}/logo.png via
// POST /organizations/[id]/branding/logo).

import { db, organization, orgBranding } from "@grc/db";
import { eq } from "drizzle-orm";
import { existsSync } from "fs";
import { join } from "path";
import { DEFAULT_PRIMARY_COLOR, type ReportBranding } from "./core";

const UPLOAD_ROOT = join(process.cwd(), "public", "uploads");

export async function loadReportBranding(
  orgId: string,
): Promise<ReportBranding> {
  const [row] = await db
    .select({
      orgName: organization.name,
      primaryColor: orgBranding.primaryColor,
      confidentialityNotice: orgBranding.confidentialityNotice,
      logoPath: orgBranding.logoPath,
    })
    .from(organization)
    .leftJoin(orgBranding, eq(orgBranding.orgId, organization.id))
    .where(eq(organization.id, orgId))
    .limit(1);

  let logoFilePath: string | null = null;
  if (row?.logoPath) {
    const candidate = join(UPLOAD_ROOT, row.logoPath);
    // Guard against path traversal in a tampered logo_path value.
    if (candidate.startsWith(UPLOAD_ROOT) && existsSync(candidate)) {
      logoFilePath = candidate;
    }
  }

  return {
    orgName: row?.orgName ?? "ARCTOS",
    primaryColor: row?.primaryColor ?? DEFAULT_PRIMARY_COLOR,
    confidentialityNotice: row?.confidentialityNotice ?? null,
    logoFilePath,
  };
}
