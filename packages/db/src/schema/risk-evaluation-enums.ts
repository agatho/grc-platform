// [ARCTOS-FULL-2026-08-31 / Restdefekte · O-6]
//
// The four evaluation enums used to live in `risk-evaluation.ts`, where they
// were declared but never referenced: they describe columns of the `risk`
// table (`risk.risk_object_type`, `.evaluation_phase`, `.evaluation_cycle`,
// `.evaluation_type`, migrations 843/848), and those columns were not
// declared in the Drizzle schema at all — which is exactly the drift the
// extended check now reports.
//
// Declaring them in `risk.ts` would need `risk.ts → risk-evaluation.ts`,
// while `risk-evaluation.ts` already imports `risk`. A cycle between two
// modules that both evaluate `pgEnum(...)` at module scope resolves
// differently depending on which side is imported first, and the losing side
// sees an uninitialised binding. This leaf module has no imports of its own,
// so both sides can depend on it.
//
// `risk-evaluation.ts` re-exports all four, so the public surface of
// `@grc/db` is unchanged.

import { pgEnum } from "drizzle-orm/pg-core";

export const riskObjectTypeEnum = pgEnum("risk_object_type", [
  "risk",
  "mixed_case",
  "chance",
]);

export const evaluationPhaseEnum = pgEnum("evaluation_phase", [
  "assignment",
  "gross_evaluation",
  "net_evaluation",
  "approval",
  "active",
]);

export const evaluationCycleEnum = pgEnum("evaluation_cycle", [
  "monthly",
  "quarterly",
  "semi_annual",
  "annual",
]);

export const evaluationTypeEnum = pgEnum("evaluation_type", [
  "qualitative",
  "quantitative",
]);
