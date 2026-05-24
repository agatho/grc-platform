// Sprint 60: Worker — Process queued push notifications
import { db, pushNotification, deviceRegistration } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";

export const processPushNotifications = withCronInstrumentation(
  "push-notification-sender",
  async (): Promise<void> => {
    const queued = await db
      .select()
      .from(pushNotification)
      .where(eq(pushNotification.status, "queued"))
      .limit(100);

    for (const notif of queued) {
      try {
        if (notif.deviceId) {
          const [device] = await db
            .select()
            .from(deviceRegistration)
            .where(eq(deviceRegistration.id, notif.deviceId));

          if (device && device.isActive) {
            await db
              .update(pushNotification)
              .set({ status: "sent", sentAt: new Date() })
              .where(eq(pushNotification.id, notif.id));
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
  },
);
