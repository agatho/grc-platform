import { z } from "zod";

// Sprint 4b: Catalog & Framework Layer schemas

const catalogObjectTypeValues = [
  "it_system",
  "application",
  "role",
  "department",
  "location",
  "vendor",
  "standard",
  "regulation",
  "custom",
] as const;
const methodologyTypeValues = [
  "iso_31000",
  "coso_erm",
  "fair",
  "custom",
] as const;
const enforcementLevelValues = [
  "optional",
  "recommended",
  "mandatory",
] as const;

// ─── General Catalog Entry CRUD ──────────────────────────────

export const createGeneralCatalogEntrySchema = z.object({
  objectType: z.enum(catalogObjectTypeValues),
  name: z.string().min(1).max(500),
  description: z.string().optional(),
  status: z.string().max(50).default("active"),
  lifecycleStart: z.string().optional(),
  lifecycleEnd: z.string().optional(),
  ownerId: z.string().uuid().optional(),
  metadataJson: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).default([]),
});

export const updateGeneralCatalogEntrySchema = z.object({
  name: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  status: z.string().max(50).optional(),
  lifecycleStart: z.string().nullable().optional(),
  lifecycleEnd: z.string().nullable().optional(),
  ownerId: z.string().uuid().nullable().optional(),
  metadataJson: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
});

// ─── Methodology ──────────────────────────────────────────────

export const setMethodologySchema = z.object({
  methodology: z.enum(methodologyTypeValues).default("iso_31000"),
  matrixSize: z.number().int().min(3).max(10).default(5),
  fairCurrency: z.string().max(10).default("EUR"),
  fairSimulationRuns: z.number().int().min(100).max(1000000).default(10000),
  riskAppetiteThreshold: z.number().int().min(1).max(100).optional(),
  customLabelsJson: z.record(z.unknown()).optional(),
});

// ─── Activate Catalog ─────────────────────────────────────────

export const activateCatalogSchema = z.object({
  catalogType: z.enum(["risk", "control"]),
  catalogId: z.string().uuid(),
  enforcementLevel: z.enum(enforcementLevelValues).default("optional"),
  isMandatoryFromParent: z.boolean().default(false),
});

// ─── Lifecycle Phase ──────────────────────────────────────────

export const createLifecyclePhaseSchema = z.object({
  entityType: z.string().min(1).max(100),
  entityId: z.string().uuid(),
  phaseName: z.string().min(1).max(100),
  startDate: z.string().min(1),
  endDate: z.string().optional(),
  notes: z.string().optional(),
});

// ─── Custom Catalog Entry (risk/control) ──────────────────────

export const createCustomCatalogEntrySchema = z.object({
  catalogId: z.string().uuid(),
  parentEntryId: z.string().uuid().optional(),
  code: z.string().min(1).max(50),
  titleDe: z.string().min(1).max(500),
  titleEn: z.string().max(500).optional(),
  descriptionDe: z.string().optional(),
  descriptionEn: z.string().optional(),
  level: z.number().int().min(1).max(4),
  sortOrder: z.number().int().default(0),
  metadataJson: z.record(z.unknown()).optional(),
});

// ─── Catalog Browser Query ────────────────────────────────────

export const catalogBrowserQuerySchema = z.object({
  catalogType: z.enum(["risk", "control"]).optional(),
  catalogId: z.string().uuid().optional(),
  level: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1).max(4))
    .optional(),
  parentEntryId: z.string().uuid().optional(),
  search: z.string().max(200).optional(),
  page: z.string().transform(Number).pipe(z.number().int().min(1)).default("1"),
  limit: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1).max(200))
    .default("50"),
});
