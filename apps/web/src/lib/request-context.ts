// Request context utilities — extract IP address and User-Agent from incoming requests
// Used by API routes and server actions for access logging (S1-15)

import { headers } from "next/headers";

export interface RequestInfo {
  ipAddress: string | undefined;
  userAgent: string | undefined;
}

/**
 * Extract IP address and User-Agent from the current Next.js server request.
 * Reads from `next/headers` — only works in server components, API routes,
 * and server actions (not in middleware or edge runtime).
 *
 * Prefers `x-forwarded-for` (first entry) for proxied environments,
 * falls back to `x-real-ip`.
 */
export async function getRequestInfo(): Promise<RequestInfo> {
  try {
    const hdrs = await headers();
    const ipAddress =
      hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      hdrs.get("x-real-ip") ||
      undefined;
    const userAgent = hdrs.get("user-agent") || undefined;
    return { ipAddress, userAgent };
  } catch {
    return { ipAddress: undefined, userAgent: undefined };
  }
}

/**
 * Extract IP address and User-Agent from a standard Request object.
 * Useful when you have direct access to the request (e.g., in route handlers).
 */
export function getRequestInfoFromRequest(request: Request): RequestInfo {
  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    undefined;
  const userAgent = request.headers.get("user-agent") || undefined;
  return { ipAddress, userAgent };
}
