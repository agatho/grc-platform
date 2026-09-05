// [ARCTOS-FULL-2026-08-31 / Restdefekte · O-6]
//
// PostgreSQL column types that drizzle-orm has no builder for. They are needed
// because the extended schema-drift check now reports columns that exist in
// the database but not in the Drizzle schema, and "the ORM has no builder for
// it" is not a reason for a column to stay invisible to the check.
//
// `tsvector` columns in ARCTOS are all `GENERATED ALWAYS AS (…) STORED`
// (`document.search_vector`, migration 0356; `search_index.tsv`). Declaring
// them WITH `.generatedAlwaysAs(...)` is what makes them safe to model at all:
// drizzle then keeps them out of the insert/update types, so the ORM still
// cannot write them — the property the earlier "intentionally not modeled"
// comment was after — while `select()` and the drift check can finally see
// them.
//
// The TS type is `string`: postgres-js returns the driver's text rendering of
// a tsvector. Nothing in the codebase reads the value; queries match against
// it with raw `sql` fragments.

import { customType } from "drizzle-orm/pg-core";

export const tsvector = customType<{ data: string; driverData: string }>({
  dataType() {
    return "tsvector";
  },
});
