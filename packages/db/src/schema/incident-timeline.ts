// Sprint 55: Asset Risk Recommendation Schema (Drizzle ORM)
// Note: incident_timeline_entry already exists in isms.ts (Sprint 5a)
// This file only adds the asset_type_risk_recommendation table

import { pgTable, uuid, varchar, boolean, unique } from "drizzle-orm/pg-core";

// ──────────────────────────────────────────────────────────────
// asset_type_risk_recommendation — Mapping asset types to risks
// ──────────────────────────────────────────────────────────────

export const assetTypeRiskRecommendation = pgTable(
  "asset_type_risk_recommendation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assetType: varchar("asset_type", { length: 50 }).notNull(),
    riskCatalogEntryId: uuid("risk_catalog_entry_id").notNull(),
    isDefaultSelected: boolean("is_default_selected").default(true),
  },
  (table) => [
    unique("atrr_type_entry_uniq").on(
      table.assetType,
      table.riskCatalogEntryId,
    ),
  ],
);
