// Sprint 60: Worker — Process queued push notifications
import { db, pushNotification, deviceRegistration } from "@grc/db";
import { eq, and } from "drizzle-orm";

export async function processPushNotifications(): Promise<void> {
  // Get queued notifications
  const queued = await db
    .select()
    .from(pushNotification)
    .where(eq(pushNotification.status, "queued"))
    .limit(100);

  for (const notif of queued) {
    try {
      // Get device info
      if (notif.deviceId) {
        const [device] = await db
          .select()
          .from(deviceRegistration)
          .where(eq(deviceRegistration.id, notif.deviceId));

        if (device && device.isActive) {
          // In production, this would call APNs (iOS) or FCM (Android)
          // For now, mark as sent
          await db
            .update(pushNotification)
            .set({ status: "sent", sentAt: new Date() })
            .where(eq(pushNotification.id, notif.id));

          console.log(
            `[push-sender] Sent notification ${notif.id} to device ${device.platform}`,
          );
        } else {
          await db
            .update(pushNotification)
            .set({
              status: "failed",
              errorMessage: "Device not found or inactive",
            })
            .where(eq(pushNotification.id, notif.id));
        }
      }
    } catch (err) {
      await db
        .update(pushNotification)
        .set({
          status: "failed",
          errorMessage: err instanceof Error ? err.message : "Unknown error",
        })
        .where(eq(pushNotification.id, notif.id));
    }
  }
}
