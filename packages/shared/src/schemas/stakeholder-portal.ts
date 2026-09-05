import { z } from "zod";

// Sprint 83: External Stakeholder Portals — Zod schemas

export const portalTypeValues = [
  "vendor",
  "auditor",
  "board_member",
  "whistleblower",
  "custom",
] as const;

export const portalSessionStatusValues = [
  "active",
  "expired",
  "revoked",
  "completed",
] as const;

export const portalQuestionnaireStatusValues = [
  "not_started",
  "in_progress",
  "submitted",
  "reviewed",
  "accepted",
  "rejected",
] as const;

// ──────────────────────────────────────────────────────────────
// Portal Config CRUD
// ──────────────────────────────────────────────────────────────

export const createPortalConfigSchema = z.object({
  portalType: z.enum(portalTypeValues),
  name: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  requireMfa: z.boolean().default(true),
  sessionTimeoutMinutes: z.number().int().min(5).max(1440).default(60),
  allowedLanguages: z
    .array(z.string().max(5))
    .min(1)
    .max(10)
    .default(["de", "en"]),
  accessPermissions: z.array(z.string().max(200)).max(50).default([]),
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
  customCss: z.string().max(50000).optional(),
  welcomeMessage: z.string().max(5000).optional(),
  privacyPolicyUrl: z.string().url().max(2000).optional(),
});

export const updatePortalConfigSchema = createPortalConfigSchema
  .partial()
  .omit({ portalType: true });

export const listPortalConfigsQuerySchema = z.object({
  portalType: z.enum(portalTypeValues).optional(),
  isActive: z.coerce.boolean().optional(),
});

// ──────────────────────────────────────────────────────────────
// Portal Session CRUD
// ──────────────────────────────────────────────────────────────

export const createPortalSessionSchema = z.object({
  portalConfigId: z.string().uuid(),
  externalEmail: z.string().email().max(500),
  externalName: z.string().max(300).optional(),
  externalOrg: z.string().max(300).optional(),
  language: z.enum(["de", "en"]).default("de"),
  expiresInHours: z.number().int().min(1).max(720).default(24),
});

export const listPortalSessionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  portalConfigId: z.string().uuid().optional(),
  status: z.enum(portalSessionStatusValues).optional(),
  email: z.string().max(500).optional(),
});

// ──────────────────────────────────────────────────────────────
// Questionnaire Response
// ──────────────────────────────────────────────────────────────

export const submitQuestionnaireResponseSchema = z.object({
  answersJson: z.record(z.unknown()),
  progressPct: z.number().int().min(0).max(100),
});

export const reviewQuestionnaireSchema = z.object({
  status: z.enum(["accepted", "rejected"]),
  reviewNotes: z.string().max(5000).optional(),
});

// ──────────────────────────────────────────────────────────────
// Evidence Upload
// ──────────────────────────────────────────────────────────────

export const stakeholderPortalEvidenceUploadSchema = z.object({
  sessionId: z.string().uuid(),
  fileName: z.string().min(1).max(500),
  fileSize: z.number().int().min(1).max(104857600),
  mimeType: z.string().max(200),
  storagePath: z.string().max(2000),
  checksumSha256: z.string().length(64).optional(),
  entityType: z.string().max(100).optional(),
  entityId: z.string().uuid().optional(),
  description: z.string().max(2000).optional(),
});

// ──────────────────────────────────────────────────────────────
// Portal Branding
// ──────────────────────────────────────────────────────────────

export const upsertPortalBrandingSchema = z.object({
  portalConfigId: z.string().uuid(),
  logoUrl: z.string().url().max(2000).optional(),
  faviconUrl: z.string().url().max(2000).optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .default("#2563EB"),
  secondaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .default("#1E40AF"),
  fontFamily: z.string().max(200).default("Inter"),
  headerHtml: z.string().max(10000).optional(),
  footerHtml: z.string().max(10000).optional(),
});

// ──────────────────────────────────────────────────────────────
// Type exports
// ──────────────────────────────────────────────────────────────

export type CreatePortalConfigInput = z.infer<typeof createPortalConfigSchema>;
export type CreatePortalSessionInput = z.infer<
  typeof createPortalSessionSchema
>;
export type UpsertPortalBrandingInput = z.infer<
  typeof upsertPortalBrandingSchema
>;
