import { db, asset } from "@grc/db";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";

interface EffectiveCia {
  confidentiality: number | null;
  integrity: number | null;
  availability: number | null;
  authenticity: number | null;
  reliability: number | null;
  protectionGoalClass: number | null;
  inherited: boolean;
  inheritedFrom?: string;
}

const MAX_PARENT_DEPTH = 3;

// GET /api/v1/assets/:id/effective-cia — CIA values with parent chain inheritance
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  // Fetch the asset itself
  const [target] = await db
    .select({
      id: asset.id,
      orgId: asset.orgId,
      parentAssetId: asset.parentAssetId,
      defaultConfidentiality: asset.defaultConfidentiality,
      defaultIntegrity: asset.defaultIntegrity,
      defaultAvailability: asset.defaultAvailability,
      defaultAuthenticity: asset.defaultAuthenticity,
      defaultReliability: asset.defaultReliability,
      protectionGoalClass: asset.protectionGoalClass,
    })
    .from(asset)
    .where(
      and(
        eq(asset.id, id),
        eq(asset.orgId, ctx.orgId),
        isNull(asset.deletedAt),
      ),
    );

  if (!target) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // If own values are set, return those directly
  if (hasCiaValues(target)) {
    const result: EffectiveCia = {
      confidentiality: target.defaultConfidentiality,
      integrity: target.defaultIntegrity,
      availability: target.defaultAvailability,
      authenticity: target.defaultAuthenticity,
      reliability: target.defaultReliability,
      protectionGoalClass: target.protectionGoalClass,
      inherited: false,
    };
    return Response.json({ data: result });
  }

  // Walk up parent chain (max 3 levels) to find inherited values
  let currentParentId = target.parentAssetId;
  let depth = 0;

  while (currentParentId && depth < MAX_PARENT_DEPTH) {
    const [parent] = await db
      .select({
        id: asset.id,
        parentAssetId: asset.parentAssetId,
        defaultConfidentiality: asset.defaultConfidentiality,
        defaultIntegrity: asset.defaultIntegrity,
        defaultAvailability: asset.defaultAvailability,
        defaultAuthenticity: asset.defaultAuthenticity,
        defaultReliability: asset.defaultReliability,
        protectionGoalClass: asset.protectionGoalClass,
      })
      .from(asset)
      .where(
        and(
          eq(asset.id, currentParentId),
          eq(asset.orgId, ctx.orgId),
          isNull(asset.deletedAt),
        ),
      );

    if (!parent) break;

    if (hasCiaValues(parent)) {
      const pgc =
        parent.defaultConfidentiality != null &&
        parent.defaultIntegrity != null &&
        parent.defaultAvailability != null
          ? Math.max(
              parent.defaultConfidentiality,
              parent.defaultIntegrity,
              parent.defaultAvailability,
            )
          : parent.protectionGoalClass;

      const result: EffectiveCia = {
        confidentiality: parent.defaultConfidentiality,
        integrity: parent.defaultIntegrity,
        availability: parent.defaultAvailability,
        authenticity: parent.defaultAuthenticity,
        reliability: parent.defaultReliability,
        protectionGoalClass: pgc,
        inherited: true,
        inheritedFrom: parent.id,
      };
      return Response.json({ data: result });
    }

    currentParentId = parent.parentAssetId;
    depth++;
  }

  // No CIA values found anywhere in the chain
  const result: EffectiveCia = {
    confidentiality: null,
    integrity: null,
    availability: null,
    authenticity: null,
    reliability: null,
    protectionGoalClass: null,
    inherited: false,
  };
  return Response.json({ data: result });
}

/** Check if an asset has at least one core CIA value set (C, I, or A). */
function hasCiaValues(row: {
  defaultConfidentiality: number | null;
  defaultIntegrity: number | null;
  defaultAvailability: number | null;
}): boolean {
  return (
    row.defaultConfidentiality != null ||
    row.defaultIntegrity != null ||
    row.defaultAvailability != null
  );
}
