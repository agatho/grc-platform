// #SEC-F01b — Request-scoped RLS context (ADR-005 follow-up)
//
// Problem this solves
// -------------------
// After #SEC-F01 the web app connects as the non-superuser role `grc_app`
// (no BYPASSRLS), so every RLS policy of the form
//   USING (org_id = current_setting('app.current_org_id', true)::uuid)
// is actually enforced. But only routes that opted into `withReadContext` /
// `withAuditContext` (apps/web/src/lib/api.ts) set that GUC — they do it
// inside a `db.transaction` with `SET LOCAL`. The ~1.800 other route handlers
// query the shared `db` pool WITHOUT any context, so RLS filters every row
// and the UI shows nothing.
//
// This module sets the org/user context ONCE per authenticated request, on a
// connection reserved exclusively for that request, so EVERY query the request
// makes through the global `db` proxy (packages/db/src/index.ts) is scoped —
// without touching a single route handler.
//
// Mechanism
// ---------
// 1. `reserveRequestContext(ctx)` reserves one connection from a dedicated
//    pool (`requestClient` in ./index.ts), sets the `app.*` GUCs at SESSION
//    level (`is_local = false`) on it, and wraps it in its own drizzle client.
//    Session level — not `SET LOCAL` — because we deliberately do NOT hold an
//    open transaction across the whole request (that would be idle-in-
//    transaction and would block on long/streaming requests, e.g. AI-assist).
//    The connection is exclusive to this request, so a session-level GUC is
//    safe and correct.
// 2. The caller stores that client in the AsyncLocalStorage (`requestDbStorage`)
//    for the remainder of the request. The `db` proxy consults the ALS on every
//    property access: inside a request → reserved client; otherwise → base pool
//    (background jobs, worker crons, migrations, seeds — unchanged behaviour).
// 3. `releaseRequestContext(store)` scrubs the GUCs and releases the connection
//    back to the pool. Callers MUST invoke it on every exit path (see the
//    `after()` hook wired up in api.ts, and the `finally` in
//    `runWithRequestContext`).
//
// Why a SEPARATE pool (`requestClient`) and not the base pool?
// -----------------------------------------------------------
// Empirically (PostgreSQL 16): once a custom GUC has been set on a connection,
// neither `RESET app.current_org_id` nor `set_config(..., NULL, ...)` restores
// it to NULL — it becomes the empty string ''. The RLS policies cast the value
// with `::uuid`, and ''::uuid THROWS. A reserved connection returned to the
// SHARED base pool would therefore poison later context-less queries (they'd
// error instead of returning zero rows). Confining request connections to their
// own pool means the base pool never sees a poisoned connection, and every
// reserve re-sets all GUCs before the connection is used again.

import { AsyncLocalStorage } from "node:async_hooks";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { requestClient, baseClient, schema } from "./index";

export interface RequestContextInput {
  orgId: string;
  userId: string;
  userEmail?: string | null;
  userName?: string | null;
}

type ReservedConnection = Awaited<ReturnType<typeof requestClient.reserve>>;

export interface RequestDbStore {
  db: PostgresJsDatabase<typeof schema>;
  reserved: ReservedConnection;
  orgId: string;
  userId: string;
  released: boolean;
}

// One AsyncLocalStorage per process. The `db` proxy reads `getStore()` to
// decide which client to delegate to.
export const requestDbStorage = new AsyncLocalStorage<RequestDbStore>();

/** The store active for the current request, if any. */
export function getRequestStore(): RequestDbStore | undefined {
  return requestDbStorage.getStore();
}

/**
 * Reserve a connection and pin the org/user context onto it at session level.
 * Every GUC is (re)set on every reserve so a value left on the pooled
 * connection by a previous request can never bleed into this one.
 */
async function reserveAndConfigure(
  ctx: RequestContextInput,
): Promise<RequestDbStore> {
  const reserved = await requestClient.reserve();
  try {
    await reserved`SELECT
      set_config('app.current_org_id',     ${ctx.orgId},            false),
      set_config('app.current_user_id',    ${ctx.userId},           false),
      set_config('app.current_user_email', ${ctx.userEmail ?? ""},  false),
      set_config('app.current_user_name',  ${ctx.userName ?? ""},   false),
      set_config('app.audit_action_detail','',                      false),
      set_config('app.audit_reason',       '',                      false)`;

    // postgres.js reserved connections don't carry an `.options` property, but
    // drizzle's postgres-js driver reads `client.options.parsers/serializers`
    // at construction time. Borrow them from the parent pool (identical config)
    // so `drizzle(reserved, …)` can build its type parsers.
    const r = reserved as unknown as { options?: unknown };
    if (r.options === undefined) {
      r.options = (requestClient as unknown as { options: unknown }).options;
    }
    const reservedDb = drizzle(reserved, { schema });
    return {
      db: reservedDb,
      reserved,
      orgId: ctx.orgId,
      userId: ctx.userId,
      released: false,
    };
  } catch (err) {
    // Any failure after reserve() (GUC set OR drizzle construction) must
    // release the connection — otherwise the request pool leaks a slot.
    reserved.release();
    throw err;
  }
}

/**
 * Reserve + configure a request context WITHOUT entering it. Returns the store
 * and a bound `release`. The caller decides how to propagate it (enterWith in
 * api.ts, or `requestDbStorage.run` in `runWithRequestContext`).
 */
export async function reserveRequestContext(ctx: RequestContextInput): Promise<{
  store: RequestDbStore;
  release: () => Promise<void>;
}> {
  const store = await reserveAndConfigure(ctx);
  return { store, release: () => releaseRequestContext(store) };
}

/** Scrub the GUCs and return the connection to the pool. Idempotent. */
export async function releaseRequestContext(
  store: RequestDbStore,
): Promise<void> {
  if (store.released) return;
  store.released = true;
  try {
    // Best-effort scrub (PII + org id). Not strictly required — the request
    // pool is never used context-less and every reserve re-sets all GUCs — but
    // it keeps idle pooled connections free of user identity.
    await store.reserved`SELECT
      set_config('app.current_org_id',     '', false),
      set_config('app.current_user_id',    '', false),
      set_config('app.current_user_email', '', false),
      set_config('app.current_user_name',  '', false)`;
  } catch {
    // Ignore — releasing the connection is what actually matters.
  } finally {
    store.reserved.release();
  }
}

/**
 * #SEC-AUTH-BOOTSTRAP — read a user's OWN rows under the migration-0380
 * `uor_self_read` policy, WITHOUT relying on the `db` proxy, `db.transaction`,
 * or AsyncLocalStorage routing.
 *
 * Why this exists
 * ---------------
 * loadRoles / resolveAccessLogOrgId (packages/auth) and the NextAuth `session`
 * callback's fresh-role fetch (apps/web/src/auth.ts) run OUTSIDE any
 * request-scoped context — during `authorize()` and, crucially, on every
 * `/api/auth/session` read, which is served by NextAuth's own handler and is
 * NEVER wrapped by `withAuth`. Under the non-superuser runtime role `grc_app`
 * (RLS enforced) a context-less read of `user_organization_role` matches no
 * policy (both `app.current_org_id` and `app.current_user_id` are unset) and
 * returns 0 rows SILENTLY — so the session ends up with `roles: []` and every
 * data endpoint answers 400 no-org-selected. (See the empirical root-cause
 * write-up in the fix PR.)
 *
 * Mechanism (deterministic, connection-pinned)
 * --------------------------------------------
 * Reserve ONE connection from the BASE pool, set `app.current_user_id` at
 * SESSION level on THAT exact connection, build a drizzle client bound to it,
 * run `fn`, then scrub the GUC and release. Because `set_config` and the SELECT
 * both run on the same reserved connection, they are guaranteed to observe the
 * same GUC — independent of pool routing, the `db` proxy, or transaction
 * atomicity.
 *
 * BASE pool (not `requestClient`) on purpose: request-pool connections carry
 * `app.current_org_id = ''` at rest (scrubbed after each request), and the
 * `org_isolation` policy casts it as `''::uuid`, which THROWS. Base-pool
 * connections never set that GUC, so it stays NULL → `NULL::uuid` → no match,
 * no error. Under the dev/CI superuser (`grc`) RLS is bypassed and the helper
 * behaves exactly like a plain read.
 */
export async function withUserReadContext<T>(
  userId: string,
  fn: (db: PostgresJsDatabase<typeof schema>) => Promise<T>,
): Promise<T> {
  const reserved = await baseClient.reserve();
  try {
    await reserved`SELECT set_config('app.current_user_id', ${userId}, false)`;
    // drizzle's postgres-js driver reads client.options.parsers/serializers at
    // construction; reserved connections don't expose `.options`, so borrow the
    // parent pool's (identical config) — same trick as reserveAndConfigure.
    const r = reserved as unknown as { options?: unknown };
    if (r.options === undefined) {
      r.options = (baseClient as unknown as { options: unknown }).options;
    }
    const reservedDb = drizzle(reserved, { schema });
    return await fn(reservedDb);
  } finally {
    try {
      // Scrub back to '' (NULLIF-safe for uor_self_read; current_org_id is never
      // touched here, so org_isolation stays NULL-safe on the base pool).
      await reserved`SELECT set_config('app.current_user_id', '', false)`;
    } catch {
      // Ignore — releasing the connection is what actually matters.
    }
    reserved.release();
  }
}

/**
 * Wrapper form: run `fn` with an established request context and guaranteed
 * release. Use when the caller can enclose the work in a callback (tests,
 * scripts, or any future non-Next entrypoint). API routes use the enterWith +
 * `after()` path in api.ts instead, because a route handler cannot wrap "the
 * rest of itself" in a callback.
 */
export async function runWithRequestContext<T>(
  ctx: RequestContextInput,
  fn: () => Promise<T>,
): Promise<T> {
  const { store, release } = await reserveRequestContext(ctx);
  try {
    return await requestDbStorage.run(store, fn);
  } finally {
    await release();
  }
}
