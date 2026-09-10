import { db, user } from "@grc/db";
import { eq } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { randomBytes } from "crypto";
import { hashOpaqueToken } from "@grc/auth/anonymous-token";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// POST /api/v1/calendar/ical/generate-token — Generate iCal token for current user
export const POST = withErrorHandler(async function POST(_req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  // Generate a cryptographically secure token
  const token = randomBytes(48).toString("hex"); // 96 chars

  const now = new Date();

  await db
    .update(user)
    .set({
      // #WP3-S02-20: keep the plaintext column for one rotation window (older
      // feed URLs stay usable) but authenticate against the hash from now on.
      icalToken: token,
      icalTokenHash: hashOpaqueToken(token),
      icalTokenCreatedAt: now,
    })
    .where(eq(user.id, ctx.userId));

  // Build the public URL for the iCal feed
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://arctos.local";
  const icalUrl = `${baseUrl}/api/v1/calendar/ical/${token}`;

  return Response.json(
    {
      data: {
        icalToken: token,
        icalUrl,
        createdAt: now.toISOString(),
      },
    },
    { status: 201 },
  );
});
