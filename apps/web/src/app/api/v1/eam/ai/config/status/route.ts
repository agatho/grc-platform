import { db, eamAiConfig } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/eam/ai/config/status — Is AI configured and valid?
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const config = await db
    .select()
    .from(eamAiConfig)
    .where(
      and(eq(eamAiConfig.orgId, ctx.orgId), eq(eamAiConfig.isActive, true)),
    )
    .limit(1);

  if (!config.length) {
    return Response.json({ data: { configured: false } });
  }

  const decrypted = JSON.parse(
    Buffer.from(config[0].configEncrypted, "base64").toString(),
  );

  return Response.json({
    data: {
      configured: true,
      provider: config[0].provider,
      model: decrypted.model,
      validationStatus: config[0].validationStatus,
    },
  });
}
