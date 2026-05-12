import { alias308 } from "@/lib/api-redirect";
export function GET(req: Request) {
  return alias308(req, "/api/v1/admin/scim");
}
export const POST = GET;
export const PUT = GET;
export const DELETE = GET;
