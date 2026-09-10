// Sprint 13a: Branding Zod validation schemas
import { z } from "zod";

// -- Hex color validation --
const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color (#RRGGBB)");

// -- Update branding --
export const updateBrandingSchema = z.object({
  primaryColor: hexColorSchema.optional(),
  secondaryColor: hexColorSchema.optional(),
  accentColor: hexColorSchema.optional(),
  textColor: hexColorSchema.optional(),
  backgroundColor: hexColorSchema.optional(),
  darkModePrimaryColor: hexColorSchema.nullable().optional(),
  darkModeAccentColor: hexColorSchema.nullable().optional(),
  reportTemplate: z.enum(["standard", "formal", "minimal"]).optional(),
  confidentialityNotice: z.string().max(500).optional(),
  inheritFromParent: z.boolean().optional(),
  /**
   * [ARCTOS-FULL-2026-08-31 / WP12 · S12-20] UNRENDERED AND UNSANITISED.
   *
   * This field is accepted, persisted and offered in the settings form, and it
   * is rendered NOWHERE — `grep -rn "customCss|custom_css" apps packages`
   * returns only schema, persistence and form-field hits. Today that is a
   * functional defect (the user fills it in and nothing happens), not a
   * vulnerability.
   *
   * BEFORE WIRING IT UP, read this. The obvious implementation is
   * `<style dangerouslySetInnerHTML={{__html: customCss}} />`, and it turns
   * this field into an org-wide stored-injection vector in one line:
   * `</style><script>…` closes the style element and opens a script one. The
   * length cap below is not a content check. For the stakeholder portals the
   * audience is external third parties, so UI redressing is in scope too, and
   * even script-free CSS can exfiltrate data through attribute selectors with
   * `background-image: url(...)`.
   *
   * `react/no-danger` is an ERROR in apps/web/eslint.config.mjs, so the naive
   * implementation now fails the build. Wiring this field up needs, first, an
   * allow-list-based CSS sanitiser and an ADR — not a `// eslint-disable`.
   */
  customCss: z.string().max(10000).nullable().optional(),
});

export type UpdateBrandingInput = z.infer<typeof updateBrandingSchema>;

// -- Logo/favicon upload metadata --
export const uploadLogoSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileType: z.enum(["image/svg+xml", "image/png"]),
  fileSize: z
    .number()
    .int()
    .min(1)
    .max(2 * 1024 * 1024), // max 2 MB
});

export const uploadFaviconSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileType: z.enum(["image/x-icon", "image/png", "image/vnd.microsoft.icon"]),
  fileSize: z
    .number()
    .int()
    .min(1)
    .max(64 * 1024), // max 64 KB
});

// -- Dashboard layout --
export const widgetPositionSchema = z.object({
  widgetId: z.string().min(1).max(100),
  x: z.number().int().min(0).max(3),
  y: z.number().int().min(0),
  w: z.number().int().min(1).max(4),
  h: z.number().int().min(1).max(4),
  visible: z.boolean().default(true),
});

export const updateDashboardLayoutSchema = z.object({
  layoutJson: z.array(widgetPositionSchema).min(1).max(50),
});

export const setOrgDefaultLayoutSchema = z.object({
  layoutJson: z.array(widgetPositionSchema).min(1).max(50),
  roleDefault: z
    .enum([
      "admin",
      "risk_manager",
      "control_owner",
      "auditor",
      "dpo",
      "process_owner",
      "viewer",
    ])
    .optional(),
});

export type UpdateDashboardLayoutInput = z.infer<
  typeof updateDashboardLayoutSchema
>;

// -- Branding response (API output) --
export const brandingResponseSchema = z.object({
  id: z.string().uuid().optional(),
  orgId: z.string().uuid(),
  primaryColor: hexColorSchema,
  secondaryColor: hexColorSchema,
  accentColor: hexColorSchema,
  textColor: hexColorSchema,
  backgroundColor: hexColorSchema,
  logoUrl: z.string().nullable(),
  faviconUrl: z.string().nullable(),
  darkModePrimaryColor: hexColorSchema.nullable(),
  darkModeAccentColor: hexColorSchema.nullable(),
  reportTemplate: z.enum(["standard", "formal", "minimal"]),
  confidentialityNotice: z.string().nullable(),
  inheritFromParent: z.boolean(),
  isInherited: z.boolean(),
  orgName: z.string(),
  updatedAt: z.string(),
});
