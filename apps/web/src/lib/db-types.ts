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

/**
 * [ARCTOS-FULL-2026-08-31 / Restarbeiten]
 *
 * Lesender Ausführungskontext. `DbTransaction` ist der richtige Typ für alles,
 * was innerhalb von `withAuditContext` / `withReadContext` schreibt. Reine
 * Lesehelfer werden aber an beiden Stellen aufgerufen — mal mit dem
 * Transaktionsobjekt, mal mit dem request-skopierten `db`-Proxy (der seinerseits
 * bereits die RLS-gebundene Verbindung liefert). Für sie ist die Menge der
 * benötigten Methoden der ehrlichere Vertrag als "genau eine der beiden
 * Klassen"; ohne ihn erzwang der Typ entweder ein `as unknown as`-Cast an jeder
 * Aufrufstelle oder ein `any` in der Signatur.
 */
export type DbReader = Pick<DbTransaction, "select" | "execute">;
