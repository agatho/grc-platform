// #NIGHT-013: /api/v1/dpms/transfer-impact-assessments → 308 to /tia.
// Wave 4 added the UI redirect (page.tsx); the API was still 404.

import { alias308 } from "@/lib/api-redirect";
export function GET(req: Request) {
  return alias308(req, "/api/v1/dpms/tia");
}
export const POST = GET;
export const PUT = GET;
export const DELETE = GET;
