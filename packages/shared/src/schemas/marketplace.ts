import { z } from "zod";

// Sprint 82: Integration Marketplace — Zod schemas

// ──────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────

export const marketplaceCategoryTypeValues = [
  "connector", "framework", "template", "dashboard", "ai_prompt", "industry_pack", "workflow", "report",
] as const;

export const marketplaceListingStatusValues = [
  "draft", "pending_review", "published", "suspended", "deprecated", "rejected",
] as const;

export const marketplaceVersionStatusValues = [
  "draft", "under_review", "approved", "rejected", "deprecated",
] as const;

export const marketplaceScanStatusValues = [
  "pending", "scanning", "passed", "failed", "warning",
] as const;

// ──────────────────────────────────────────────────────────────
// Publisher CRUD
// ──────────────────────────────────────────────────────────────

export const createMarketplacePublisherSchema = z.object({
  name: z.string().min(1).max(300),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
  description: z.string().max(5000).optional(),
  websiteUrl: z.string().url().max(2000).optional(),
  logoUrl: z.string().url().max(2000).optional(),
  contactEmail: z.string().email().max(500).optional(),
});

export const updateMarketplacePublisherSchema = createMarketplacePublisherSchema.partial();

// ──────────────────────────────────────────────────────────────
// Listing CRUD
// ──────────────────────────────────────────────────────────────

export const createMarketplaceListingSchema = z.object({
  publisherId: z.string().uuid(),
  categoryId: z.string().uuid(),
  name: z.string().min(1).max(500),
  slug: z.string().min(1).max(300).regex(/^[a-z0-9-]+$/),
  summary: z.string().min(1).max(1000),
  description: z.string().max(50000).optional(),
  iconUrl: z.string().url().max(2000).optional(),
  screenshotUrls: z.array(z.string().url().max(2000)).max(10).default([]),
  tags: z.array(z.string().max(100)).max(20).default([]),
  priceType: z.enum(["free", "paid", "freemium"]).default("free"),
  priceAmount: z.number().min(0).max(99999).optional(),
  priceCurrency: z.string().length(3).default("EUR"),
  minimumVersion: z.string().max(50).optional(),
  supportUrl: z.string().url().max(2000).optional(),
  documentationUrl: z.string().url().max(2000).optional(),
});

export const updateMarketplaceListingSchema = createMarketplaceListingSchema.partial();

export const listMarketplaceListingsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  categoryId: z.string().uuid().optional(),
  categoryType: z.enum(marketplaceCategoryTypeValues).optional(),
  status: z.enum(marketplaceListingStatusValues).optional(),
  search: z.string().max(200).optional(),
  isFeatured: z.coerce.boolean().optional(),
  isVerified: z.coerce.boolean().optional(),
  priceType: z.enum(["free", "paid", "freemium"]).optional(),
  sortBy: z.enum(["created_at", "install_count", "avg_rating", "name"]).default("created_at"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const changeListingStatusSchema = z.object({
  status: z.enum(marketplaceListingStatusValues),
  reason: z.string().max(2000).optional(),
});

// ──────────────────────────────────────────────────────────────
// Version CRUD
// ──────────────────────────────────────────────────────────────

export const createMarketplaceVersionSchema = z.object({
  listingId: z.string().uuid(),
  version: z.string().min(1).max(50),
  releaseNotes: z.string().max(10000).optional(),
  packageUrl: z.string().url().max(2000).optional(),
  packageSize: z.number().int().min(0).optional(),
  checksumSha256: z.string().length(64).optional(),
  compatibilityJson: z.record(z.unknown()).default({}),
});

export const updateMarketplaceVersionSchema = createMarketplaceVersionSchema.partial().omit({ listingId: true });

// ──────────────────────────────────────────────────────────────
// Review CRUD
// ──────────────────────────────────────────────────────────────

export const createMarketplaceReviewSchema = z.object({
  listingId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(300).optional(),
  body: z.string().max(5000).optional(),
});

export const updateMarketplaceReviewSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  title: z.string().max(300).optional(),
  body: z.string().max(5000).optional(),
});

export const respondToReviewSchema = z.object({
  publisherResponse: z.string().min(1).max(5000),
});

// ──────────────────────────────────────────────────────────────
// Installation CRUD
// ──────────────────────────────────────────────────────────────

export const installListingSchema = z.object({
  listingId: z.string().uuid(),
  versionId: z.string().uuid(),
  configJson: z.record(z.unknown()).default({}),
  autoUpdate: z.boolean().default(true),
});

export const updateInstallationSchema = z.object({
  versionId: z.string().uuid().optional(),
  configJson: z.record(z.unknown()).optional(),
  autoUpdate: z.boolean().optional(),
});

// ──────────────────────────────────────────────────────────────
// Category CRUD
// ──────────────────────────────────────────────────────────────

export const createMarketplaceCategorySchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
  description: z.string().max(2000).optional(),
  categoryType: z.enum(marketplaceCategoryTypeValues),
  parentId: z.string().uuid().optional(),
  iconName: z.string().max(100).optional(),
  sortOrder: z.number().int().min(0).default(0),
});

export const listMarketplaceCategoriesQuerySchema = z.object({
  categoryType: z.enum(marketplaceCategoryTypeValues).optional(),
  isActive: z.coerce.boolean().optional(),
});

// ──────────────────────────────────────────────────────────────
// Type exports
// ──────────────────────────────────────────────────────────────

export type CreateMarketplacePublisherInput = z.infer<typeof createMarketplacePublisherSchema>;
export type CreateMarketplaceListingInput = z.infer<typeof createMarketplaceListingSchema>;
export type CreateMarketplaceVersionInput = z.infer<typeof createMarketplaceVersionSchema>;
export type CreateMarketplaceReviewInput = z.infer<typeof createMarketplaceReviewSchema>;
export type InstallListingInput = z.infer<typeof installListingSchema>;
export type CreateMarketplaceCategoryInput = z.infer<typeof createMarketplaceCategorySchema>;
