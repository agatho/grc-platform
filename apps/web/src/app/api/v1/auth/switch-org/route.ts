import { auth } from "@/auth";
import { setCurrentOrgId } from "@grc/auth/context";
import { getAccessibleOrgIds } from "@grc/auth";
import { z } from "zod";

const switchOrgSchema = z.object({ orgId: z.string().uuid() });

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = switchOrgSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 422 });
  }
  const { orgId } = parsed.data;

  // Verify user has access to the target org
  const accessible = getAccessibleOrgIds(session);
  if (!accessible.includes(orgId)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  await setCurrentOrgId(orgId);

  return Response.json({ ok: true, orgId });
}
