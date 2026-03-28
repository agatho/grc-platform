import { z } from "zod";

// Sprint 52: EAM UX & Unified Catalog Zod Schemas

export const catalogObjectTypeEnum = z.enum(["application", "business_capability", "it_component", "data_object", "provider", "interface"]);

export const catalogFiltersSchema = z.object({
  objectTypes: z.array(catalogObjectTypeEnum).min(1).default(["application", "business_capability", "it_component", "data_object", "provider", "interface"]),
  search: z.string().max(500).optional(),
  keywords: z.array(z.string().max(100)).max(20).optional(),
  lifecycleStatus: z.array(z.string().max(30)).max(10).optional(),
  category: z.array(z.string().max(50)).max(10).optional(),
  manufacturer: z.array(z.string().max(500)).max(10).optional(),
  functionalFit: z.array(z.string().max(20)).max(5).optional(),
  technicalFit: z.array(z.string().max(20)).max(5).optional(),
  businessCriticality: z.array(z.string().max(30)).max(5).optional(),
  personalDataProcessing: z.boolean().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(10).max(200).default(50),
  sortBy: z.string().max(50).default("name"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

export const createKeywordSchema = z.object({
  name: z.string().min(1).max(100),
  parentId: z.string().uuid().optional(),
});

export const mergeKeywordsSchema = z.object({
  sourceKeywordId: z.string().uuid(),
  targetKeywordId: z.string().uuid(),
});

export const updateHomepageLayoutSchema = z.object({
  widgetConfig: z.array(z.object({
    widgetType: z.string().max(50),
    position: z.object({
      x: z.number().int().min(0),
      y: z.number().int().min(0),
      w: z.number().int().min(1).max(12),
      h: z.number().int().min(1).max(12),
    }),
    config: z.record(z.unknown()).optional(),
  })).max(20),
});

export const updateKeywordsOnObjectSchema = z.object({
  keywords: z.array(z.string().max(100)).max(50),
});
