import { auth } from "@/auth";
import { setCurrentOrgId } from "@grc/auth/context";
import { getAccessibleOrgIds } from "@grc/auth";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { orgId } = body;

  if (!orgId || typeof orgId !== "string") {
    return Response.json({ error: "orgId is required" }, { status: 400 });
  }

  // Verify user has access to the target org
  const accessible = getAccessibleOrgIds(session);
  if (!accessible.includes(orgId)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  await setCurrentOrgId(orgId);

  return Response.json({ ok: true, orgId });
}
