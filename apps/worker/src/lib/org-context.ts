// org-context.ts — org-scoped unit of work for worker jobs.
//
// [ARCTOS-FULL-2026-08-31 / WP9 · S10-14]
//
// S10-14 found five attempts at setting an org context in the worker, and
// all five were wrong in one of three ways:
//
//   * `set_config('app.current_org_id', X, false)` on the SHARED base pool
//     (`calendar-digest`, `calendar-overdue-check`) — the third argument
//     `false` means SESSION-local, the statement lands on an arbitrary
//     pooled connection, and the query it was meant to scope very likely
//     runs on a different one. Worse, the GUC then stays on that
//     connection: `request-context.ts:37-45` documents that neither
//     `RESET` nor `set_config(..., NULL, ...)` restores it to NULL — it
//     becomes `''`, and `''::uuid` throws in the RLS policies. A poisoned
//     base-pool connection breaks later context-less queries.
//
//   * `set_config(..., true)` OUTSIDE a transaction (`scheduled-export`) —
//     transaction-local scope applied to an implicit single-statement
//     transaction, i.e. gone before the next statement.
//
//   * the context set AFTER the writes it was supposed to scope
//     (`document-retention-purge`, whose `INSERT INTO audit_log` ran first).
//
// Only `risk-acceptance-expiry.ts` was correct. This module is that pattern,
// named, so no job has to get it right again by hand — and it is the module
// WP6's `regulatory-relevance-scorer.ts` imports.

export { withOrgContext, withTransaction } from "./job-runtime";
