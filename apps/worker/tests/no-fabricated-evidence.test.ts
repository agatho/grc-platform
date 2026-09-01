// [ARCTOS-FULL-2026-08-31 / WP9 · S14-02, S10-06, S10-15]
//
// The acceptance criterion for the hardest block of this work package:
// *no job persists a result it did not actually measure.*
//
// The defect was not a bug in one place — it was a pattern repeated across
// fourteen code paths, always the same shape: write a passing result, mark
// the entity complete, return success, and note the truth in a source
// comment the auditor never sees:
//
//   connector-schedule-runner   status: "pass", durationMs: Math.random()…
//   connector-health-monitor    const isHealthy = true;
//   marketplace-security-scanner  "For now: auto-pass"; const passed = true;
//   simulation-runner           meanValue: String(Math.random() * 1000000)
//   import-job-processor        counts pack items as "processed"
//   evidence-review-processor    pending → running → completed, nothing between
//   predictive-risk-trainer     active → training → active, lastTrainedAt = now
//   executive-kpi-snapshot      auditSlaCompliance: 0  // Placeholder
//   module-aware-cron           12 × `return { processed: 0 }` // TODO
//   cloud-connectors/executions passRate: "100.00", passCount = totalTests
//   connectors/[id]/test-run    status: "pass", result: { simulated: true }
//   connectors/[id]/health      healthy iff our own status column says active
//   identity-connectors/sync    complianceRate: "95.00", totalUsers: 100
//
// A test that asserts specific behaviour per path would need thirteen
// fixtures. What actually has to hold is simpler and checkable at the
// source level: none of these files may contain a persisted, fabricated
// verdict any more. That is what this suite enforces — and it fails
// loudly if someone reintroduces the pattern.

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

/** The paths S14-02, S10-06 and S10-15 named, with what must be gone. */
const CASES: Array<{ file: string; forbidden: RegExp[]; why: string }> = [
  {
    file: "apps/worker/src/crons/connector-schedule-runner.ts",
    forbidden: [/status:\s*"pass"/, /Math\.random\(\)/],
    why: "fabricated connector_test_result rows with a random duration",
  },
  {
    file: "apps/worker/src/crons/connector-health-monitor.ts",
    forbidden: [/const\s+isHealthy\s*=\s*true/, /status:\s*healthStatus/],
    why: "connector_health_check written as healthy without contacting the provider",
  },
  {
    file: "apps/worker/src/crons/marketplace-security-scanner.ts",
    forbidden: [/const\s+passed\s*=\s*true/, /scanStatus:\s*passed\s*\?/],
    why: "every marketplace plugin auto-passed its security review",
  },
  {
    file: "apps/worker/src/crons/simulation-runner.ts",
    forbidden: [/Math\.random\(\)/, /simulationRunResult/],
    why: "Monte-Carlo/VaR figures in EUR generated from Math.random()",
  },
  {
    file: "apps/worker/src/crons/import-job-processor.ts",
    forbidden: [
      /status:\s*failedCount === job\.totalItems \? "failed" : "completed"/,
    ],
    why: "import marked completed with a fabricated processed count",
  },
  {
    file: "apps/worker/src/crons/evidence-review-processor.ts",
    forbidden: [/status:\s*"completed"/],
    why: "evidence review went pending → running → completed with nothing between",
  },
  {
    file: "apps/worker/src/crons/predictive-risk-trainer.ts",
    forbidden: [/lastTrainedAt:\s*now/],
    why: "model reported a training run it never had",
  },
  {
    file: "apps/worker/src/crons/executive-kpi-snapshot.ts",
    forbidden: [
      /auditSlaCompliance:\s*0/,
      /dsrSlaCompliance:\s*0/,
      /esgCompleteness:\s*0/,
    ],
    why: "unmeasured executive KPIs persisted as 0, which reads as catastrophic",
  },
  {
    file: "apps/worker/src/lib/module-aware-cron.ts",
    forbidden: [/\/\/\s*TODO/, /return\s*\{\s*processed:\s*0\s*\}/],
    why: "12 module background processes answered success with processed: 0",
  },
  {
    file: "apps/web/src/app/api/v1/cloud-connectors/executions/route.ts",
    forbidden: [
      /passRate:\s*"100\.00"/,
      /Math\.random\(\)/,
      /lastPassRate:\s*"100\.00"/,
    ],
    why: "a complete, passed cloud test execution written without any provider call",
  },
  {
    file: "apps/web/src/app/api/v1/connectors/[id]/test-run/route.ts",
    forbidden: [/status:\s*"pass"/, /simulated:\s*true/, /Math\.random\(\)/],
    why: "one passing connector_test_result per test definition, unmeasured",
  },
  {
    file: "apps/web/src/app/api/v1/connectors/[id]/health/route.ts",
    forbidden: [/connector\.status === "active" \? "healthy"/],
    why: "connectivity derived from a status column in our own database",
  },
  {
    file: "apps/web/src/app/api/v1/identity-connectors/sync/route.ts",
    forbidden: [
      /complianceRate:\s*"95\.00"/,
      /totalUsers:\s*100/,
      /status:\s*"pass"/,
    ],
    why: "identity compliance figures were four constants in the source file",
  },
];

describe("no fabricated evidence (S14-02, S10-06, S10-15)", () => {
  for (const c of CASES) {
    it(`${c.file} no longer fabricates: ${c.why}`, () => {
      const full = join(REPO, c.file);
      expect(existsSync(full), `${c.file} missing`).toBe(true);
      const src = readFileSync(full, "utf8");
      // Comments explaining the removed code are expected and fine; only
      // executable lines are checked.
      const code = src
        .split("\n")
        .filter((l) => {
          const t = l.trim();
          return !(
            t.startsWith("//") ||
            t.startsWith("*") ||
            t.startsWith("/*")
          );
        })
        .join("\n");
      for (const pattern of c.forbidden) {
        expect(pattern.test(code), `${c.file}: ${pattern} still present`).toBe(
          false,
        );
      }
    });
  }

  it("refuses rather than persisting, via a named error type", async () => {
    const { NotImplementedEvidenceError } =
      await import("../src/lib/job-runtime");
    const err = new NotImplementedEvidenceError("probe", "detail");
    expect(err.message).toMatch(/No evidence produced/);
    expect(err.message).toMatch(/Refusing to persist an unmeasured result/);
    expect(err.capability).toBe("probe");
  });

  it("answers 501 instead of writing a result, on all four web paths", () => {
    for (const file of [
      "apps/web/src/app/api/v1/cloud-connectors/executions/route.ts",
      "apps/web/src/app/api/v1/connectors/[id]/test-run/route.ts",
      "apps/web/src/app/api/v1/connectors/[id]/health/route.ts",
      "apps/web/src/app/api/v1/identity-connectors/sync/route.ts",
    ]) {
      const src = readFileSync(join(REPO, file), "utf8");
      expect(src, file).toMatch(/status:\s*501/);
      expect(src, file).toMatch(/Not implemented/);
    }
  });

  it("keeps the module background processes honest", async () => {
    const { registerModuleCrons } =
      await import("../src/lib/module-aware-cron");
    const registry = registerModuleCrons();
    // The eight without an implementation must FAIL, not report success.
    for (const name of [
      "kri-threshold-check",
      "control-test-reminders",
      "isms-review-cycle",
      "bcms-test-scheduler",
      "dpia-review-reminders",
      "consent-expiry-check",
      "audit-plan-reminders",
      "finding-follow-up",
    ]) {
      await expect(registry[name](), name).rejects.toThrow(
        /No evidence produced/,
      );
    }
    // The four with a real implementation must be wired to it.
    for (const name of [
      "risk-review-reminders",
      "vendor-reassessment-reminders",
      "esg-data-collection",
      "case-escalation-check",
    ]) {
      expect(typeof registry[name], name).toBe("function");
    }
  });
});
