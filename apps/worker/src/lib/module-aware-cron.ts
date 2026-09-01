/**
 * Module-aware background process registry.
 *
 * Each entry corresponds to a `background_processes` value defined in the
 * `module_definition` table. These processes run regardless of `ui_status`
 * — data pipelines should never stop because a module is hidden in the UI.
 *
 * [ARCTOS-FULL-2026-08-31 / WP9 · S10-15]
 *
 * All twelve entries used to be a `// TODO` returning `{ processed: 0 }`,
 * exposed as `POST /crons/modules/<name>` and answering
 * `{"success":true,"cron":"…","processed":0}` forever. The audit's scenario:
 * an operator wires a scheduler against `/crons/modules/consent-expiry-check`
 * — the name is published in `module_definition` as a DPMS background
 * process — and the endpoint reports success every time while expiring
 * consents are never checked. Neither the response nor the log hinted that a
 * TODO sat behind it.
 *
 * Two changes:
 *
 *   * Four of the twelve had a fully implemented cron under a different
 *     name. They now DELEGATE to it, so the module-level name does what it
 *     says instead of nothing.
 *   * The remaining eight THROW. A 500 plus a `job_run` row with
 *     `status='failed'` is an honest answer; `{"success":true,
 *     "processed":0}` is not. Implementing them is product work; until then
 *     the platform must not claim the pipeline ran.
 */

import { processRiskReviewReminders } from "../crons/risk-review-reminder";
import { processVendorReassessmentMonitor } from "../crons/vendor-reassessment-monitor";
import { processEsgCollectionReminder } from "../crons/esg-collection-reminder";
import { processWbDeadlineMonitor } from "../crons/wb-deadline-monitor";
import { NotImplementedEvidenceError } from "./job-runtime";

interface CronResult {
  processed: number;
}

type CronHandler = () => Promise<CronResult>;

/**
 * A module background process whose implementation does not exist. Fails
 * loudly rather than reporting a successful no-op.
 */
function notImplemented(name: string, module: string): CronHandler {
  return async () => {
    throw new NotImplementedEvidenceError(
      `module background process "${name}" (${module})`,
      "Declared in module_definition, implemented nowhere. It reports " +
        "failure instead of a successful no-op so a scheduler wired against " +
        "it does not read as green.",
    );
  };
}

/** Adapt a full cron handler to the `{ processed }` shape of this registry. */
function delegate(handler: () => Promise<unknown>): CronHandler {
  return async () => {
    const result = (await handler()) as { processed?: number } | undefined;
    return { processed: result?.processed ?? 0 };
  };
}

// ── Registry ─────────────────────────────────────────────────────────

const cronRegistry: Record<string, CronHandler> = {
  // Delegated to their real implementations.
  "risk-review-reminders": delegate(processRiskReviewReminders),
  "vendor-reassessment-reminders": delegate(processVendorReassessmentMonitor),
  "esg-data-collection": delegate(processEsgCollectionReminder),
  "case-escalation-check": delegate(processWbDeadlineMonitor),

  // Declared in module_definition, not implemented anywhere.
  "kri-threshold-check": notImplemented("kri-threshold-check", "ERM"),
  "control-test-reminders": notImplemented("control-test-reminders", "ICS"),
  "isms-review-cycle": notImplemented("isms-review-cycle", "ISMS"),
  "bcms-test-scheduler": notImplemented("bcms-test-scheduler", "BCMS"),
  "dpia-review-reminders": notImplemented("dpia-review-reminders", "DPMS"),
  "consent-expiry-check": notImplemented("consent-expiry-check", "DPMS"),
  "audit-plan-reminders": notImplemented("audit-plan-reminders", "Audit"),
  "finding-follow-up": notImplemented("finding-follow-up", "Audit"),
};

/**
 * Register all module background processes and log the count.
 * Returns the registry so the worker can expose individual endpoints.
 */
export function registerModuleCrons(): Record<string, CronHandler> {
  console.log(
    `[ModuleCrons] Registered ${Object.keys(cronRegistry).length} background processes`,
  );
  return cronRegistry;
}
