import { z } from "zod";

// ── Sprint 60: Mobile Application ──

// Device Registration
export const registerDeviceSchema = z.object({
  deviceToken: z.string().min(1).max(500),
  platform: z.enum(["ios", "android"]),
  deviceModel: z.string().max(100).optional(),
  osVersion: z.string().max(50).optional(),
  appVersion: z.string().max(20).optional(),
  biometricEnabled: z.boolean().default(false),
});

export const updateDeviceSchema = z.object({
  deviceToken: z.string().min(1).max(500).optional(),
  appVersion: z.string().max(20).optional(),
  biometricEnabled: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

// Push Notification
export const sendPushNotificationSchema = z.object({
  userId: z.string().uuid(),
  title: z.string().min(1).max(255),
  body: z.string().max(2000).optional(),
  data: z.record(z.unknown()).default({}),
  category: z
    .enum(["general", "task", "approval", "alert", "incident", "finding"])
    .default("general"),
  priority: z.enum(["low", "normal", "high", "critical"]).default("normal"),
});

export const bulkSendPushSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(100),
  title: z.string().min(1).max(255),
  body: z.string().max(2000).optional(),
  data: z.record(z.unknown()).default({}),
  category: z
    .enum(["general", "task", "approval", "alert", "incident", "finding"])
    .default("general"),
  priority: z.enum(["low", "normal", "high", "critical"]).default("normal"),
});

// Offline Sync
export const syncRequestSchema = z.object({
  deviceId: z.string().uuid(),
  entityType: z.string().min(1).max(50),
  lastSyncVersion: z.number().int().min(0).default(0),
  pendingChanges: z
    .array(
      z.object({
        action: z.enum(["create", "update", "delete"]),
        entityId: z.string().uuid().optional(),
        data: z.record(z.unknown()),
        timestamp: z.string().datetime(),
      }),
    )
    .max(100)
    .default([]),
});

// Mobile Session
export const createMobileSessionSchema = z.object({
  deviceId: z.string().uuid(),
  biometricToken: z.string().max(500).optional(),
});

// QR/Barcode Scan
export const assetScanSchema = z.object({
  scanType: z.enum(["qr", "barcode"]),
  scanData: z.string().min(1).max(1000),
  deviceId: z.string().uuid(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;
export type UpdateDeviceInput = z.infer<typeof updateDeviceSchema>;
export type SendPushNotificationInput = z.infer<
  typeof sendPushNotificationSchema
>;
export type BulkSendPushInput = z.infer<typeof bulkSendPushSchema>;
export type SyncRequestInput = z.infer<typeof syncRequestSchema>;
export type CreateMobileSessionInput = z.infer<
  typeof createMobileSessionSchema
>;
export type AssetScanInput = z.infer<typeof assetScanSchema>;
