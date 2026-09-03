// db-role-guard.ts
//
// [ARCTOS-FULL-2026-08-31 / WP9 · S01-09 (from WP2), S10-01]
//
// WP2 added `assertRuntimeRoleIsolation()` in `packages/db`: a process that
// connects privileged in production exits unless
// `ARCTOS_ALLOW_PRIVILEGED_DB=true` is set. The worker legitimately needs
// BYPASSRLS — it runs cross-org system jobs — so it sets that flag. But the
// flag is coarse: it permits BYPASSRLS *and* full SUPERUSER alike, and the
// worker was connecting as the superuser `grc`.
//
// That distinction is not academic. S10-01 (Critical) was arbitrary SQL from
// a continuous-audit rule executed on the worker's pool: as `grc` that meant
// `COPY … TO PROGRAM`, `pg_read_file()` and `ALTER SYSTEM`; as `grc_worker`
// (BYPASSRLS, NOSUPERUSER, NOCREATEDB, NOCREATEROLE) the same injection
// reaches nothing but ordinary DML. WP2 provisioned that role in
// `deploy/provision-grc-app.sh`; this guard is what makes the switch stick,
// so a future compose edit that points the worker back at `grc` fails the
// boot instead of silently re-arming the blast radius.

import { checkRuntimeRoleIsolation } from "@grc/db";
import { emitCronEvent } from "./cron-instrument";

import { log } from "./logger";
export interface WorkerRoleVerdict {
  role: string;
  isSuperuser: boolean;
  canBypassRls: boolean;
  ok: boolean;
}

/**
 * Verify the worker's database role.
 *
 * Rules:
 *   * SUPERUSER is never acceptable in production — the process exits.
 *     `ARCTOS_ALLOW_PRIVILEGED_DB` does NOT override this; it exists to
 *     permit BYPASSRLS, which is a different and much smaller grant.
 *   * BYPASSRLS without SUPERUSER is the intended configuration.
 *   * Neither (i.e. plain `grc_app`) is allowed too — the cross-org jobs
 *     would see zero rows, but that is a functional decision for the
 *     operator, not a security defect, so it is a warning.
 */
export async function assertWorkerDbRole(): Promise<WorkerRoleVerdict> {
  const check = await checkRuntimeRoleIsolation();
  const verdict: WorkerRoleVerdict = {
    role: check.role,
    isSuperuser: check.isSuperuser,
    canBypassRls: check.canBypassRls,
    ok: !check.isSuperuser,
  };

  if (check.isSuperuser) {
    const detail =
      `[worker] FATAL: connected as "${check.role}", which is a PostgreSQL ` +
      `SUPERUSER. The worker needs BYPASSRLS for its cross-org system jobs, ` +
      `not superuser rights: superuser additionally grants COPY … TO PROGRAM, ` +
      `pg_read_file(), ALTER SYSTEM and ownership of every object, none of ` +
      `which any cron job uses — and all of which a defect on this pool ` +
      `(S10-01) would inherit. Point DATABASE_URL at the role grc_worker ` +
      `(deploy/provision-grc-app.sh, GRC_WORKER_PASSWORD).`;
    if (process.env.NODE_ENV === "production") {
      log.fatal(detail);
      process.exit(1);
    }
    log.warn(detail.replace("FATAL", "WARNING"));
    return verdict;
  }

  if (!check.canBypassRls) {
    log.warn(
      "[worker] connected role has neither SUPERUSER nor BYPASSRLS. " +
        "Cross-org system jobs will see only rows their org context allows " +
        "(usually none). Expected role: grc_worker.",
      { role: check.role },
    );
  }

  emitCronEvent("info", {
    cron: "startup",
    phase: "db-role",
    role: check.role,
    superuser: check.isSuperuser,
    bypassRls: check.canBypassRls,
  });
  return verdict;
}
