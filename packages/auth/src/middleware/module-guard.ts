// Sprint 1.3: Module guard for Next.js API route handlers.
// Called inside route handlers to check module accessibility.

import * as moduleConfigCache from "../cache/module-config-cache";
import type { ModuleKey } from "@grc/shared";

/**
 * Check if a module is accessible for the given org.
 * Returns null if allowed, or a Response if blocked.
 * - disabled/maintenance → 404 (don't reveal module exists)
 * - preview + non-GET method → 403
 * - enabled/preview GET → null (allowed)
 */
export async function requireModule(
  moduleKey: ModuleKey,
  orgId: string,
  method: string = "GET",
): Promise<Response | null> {
  const config = await moduleConfigCache.get(orgId, moduleKey);

  if (
    !config ||
    config.uiStatus === "disabled" ||
    config.uiStatus === "maintenance"
  ) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  if (config.uiStatus === "preview" && method !== "GET") {
    return Response.json(
      { error: "Module in preview mode — read-only access" },
      { status: 403 },
    );
  }

  return null; // allowed
}
