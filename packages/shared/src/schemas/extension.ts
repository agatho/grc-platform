import { z } from "zod";

// ── Sprint 58: Extension und Plugin Architecture ──

// Plugin
export const createPluginSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9_-]+$/),
  name: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  version: z.string().min(1).max(50),
  author: z.string().max(255).optional(),
  authorUrl: z.string().url().max(500).optional(),
  repositoryUrl: z.string().url().max(500).optional(),
  category: z
    .enum([
      "general",
      "compliance",
      "risk",
      "reporting",
      "integration",
      "automation",
      "security",
      "analytics",
    ])
    .default("general"),
  tags: z.array(z.string().max(50)).max(20).default([]),
  iconUrl: z.string().url().max(500).optional(),
  entryPoint: z.string().min(1).max(500),
  executionMode: z.enum(["wasm", "isolated", "native"]).default("wasm"),
  permissions: z.array(z.string().max(100)).max(50).default([]),
  configSchema: z.record(z.unknown()).default({}),
  minPlatformVersion: z.string().max(20).optional(),
  maxPlatformVersion: z.string().max(20).optional(),
});

export const updatePluginSchema = createPluginSchema
  .partial()
  .omit({ key: true });

// Plugin Installation
export const installPluginSchema = z.object({
  pluginId: z.string().uuid(),
  config: z.record(z.unknown()).default({}),
  hookBindings: z
    .array(
      z.object({
        hookKey: z.string().max(150),
        priority: z.number().int().min(0).max(1000).default(100),
        enabled: z.boolean().default(true),
      }),
    )
    .max(100)
    .default([]),
});

export const updatePluginInstallationSchema = z.object({
  config: z.record(z.unknown()).optional(),
  hookBindings: z
    .array(
      z.object({
        hookKey: z.string().max(150),
        priority: z.number().int().min(0).max(1000).default(100),
        enabled: z.boolean().default(true),
      }),
    )
    .max(100)
    .optional(),
});

// Plugin Setting
export const updatePluginSettingSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.unknown(),
  isSecret: z.boolean().default(false),
});

export const bulkUpdatePluginSettingsSchema = z.object({
  settings: z
    .array(
      z.object({
        key: z.string().min(1).max(100),
        value: z.unknown(),
        isSecret: z.boolean().default(false),
      }),
    )
    .min(1)
    .max(100),
});

// Marketplace
export const createMarketplaceListingSchema = z.object({
  pluginId: z.string().uuid(),
  title: z.string().min(1).max(255),
  shortDescription: z.string().max(500).optional(),
  longDescription: z.string().max(10000).optional(),
  screenshots: z.array(z.string().url().max(500)).max(10).default([]),
  pricingModel: z
    .enum(["free", "freemium", "paid", "subscription"])
    .default("free"),
  priceMonthly: z.number().int().min(0).optional(),
  priceYearly: z.number().int().min(0).optional(),
});

export const updateMarketplaceListingSchema = createMarketplaceListingSchema
  .partial()
  .omit({ pluginId: true });

export type CreatePluginInput = z.infer<typeof createPluginSchema>;
export type UpdatePluginInput = z.infer<typeof updatePluginSchema>;
export type InstallPluginInput = z.infer<typeof installPluginSchema>;
export type UpdatePluginInstallationInput = z.infer<
  typeof updatePluginInstallationSchema
>;
export type UpdatePluginSettingInput = z.infer<
  typeof updatePluginSettingSchema
>;
export type CreateMarketplaceListingInput = z.infer<
  typeof createMarketplaceListingSchema
>;
export type UpdateMarketplaceListingInput = z.infer<
  typeof updateMarketplaceListingSchema
>;
