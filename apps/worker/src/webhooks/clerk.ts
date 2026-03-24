import type { Context } from "hono";
// Sprint 1: Clerk webhook handler (S1-05, S1-06, S1-15)
// Processes: user.created, user.updated, user.deleted, session.created

export async function clerkWebhook(c: Context) {
  // TODO: Verify svix signature
  // TODO: Parse event type
  // TODO: Sync user table
  // TODO: Write access_log entry
  return c.json({ received: true });
}
