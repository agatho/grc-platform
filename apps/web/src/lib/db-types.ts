/**
 * [ARCTOS-FULL-2026-08-31 / WP12 · S14-19] The drizzle transaction type.
 *
 * `withAuditContext`, `withReadContext` and the six `*-gates.ts` modules all
 * declared their transaction parameter as `tx: any`, which erased the type of
 * every query executed inside a mutation — the widest `any` surface in the
 * application layer after the session payload.
 *
 * Inferring it from `db.transaction` rather than importing a drizzle-internal
 * generic keeps it correct across drizzle upgrades and across changes to the
 * schema type parameter: there is exactly one definition and it is derived
 * from the object the callback actually receives.
 */
import { db } from "@grc/db";

export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
