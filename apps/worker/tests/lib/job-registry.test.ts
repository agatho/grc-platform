// [ARCTOS-FULL-2026-08-31 / WP9 · S10-02]
//
// Regression test for "no scheduler exists". Before the fix, a repository
// search for `setInterval`, `node-cron`, `croner` or `cron.schedule` inside
// `apps/worker` returned zero hits and `X-Cron-Secret` appeared in exactly
// one file — the middleware that demands it. None of the 128 jobs ran.
//
// These assertions would have failed on the pre-fix tree at the first
// `expect`, because `lib/job-registry.ts` did not exist. They now guard
// the two ways the fix could rot:
//   * a new cron file that nobody registers (and therefore never runs);
//   * a schedule expression that does not parse (and would be dropped).

import { describe, it, expect } from "vitest";
import { readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import {
  JOB_REGISTRY,
  JOB_PATH_ALIASES,
  findJob,
} from "../../src/lib/job-registry";
import { parseCron, cronMatches, nextRunAfter } from "../../src/lib/scheduler";

const CRON_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../src/crons",
);

/** Job files that are deliberately not scheduled. */
const NOT_SCHEDULED = new Set(["automation-engine-init"]);

function cronFiles(): string[] {
  return readdirSync(CRON_DIR)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => f.slice(0, -3))
    .filter((n) => !NOT_SCHEDULED.has(n));
}

describe("job registry (S10-02)", () => {
  it("registers every cron file exactly once", () => {
    const registered = JOB_REGISTRY.map((j) => j.name);
    const files = cronFiles();

    const missing = files.filter((f) => !registered.includes(f));
    expect(
      missing,
      "cron files with no registry entry — they would never run",
    ).toEqual([]);

    const duplicates = registered.filter((n, i) => registered.indexOf(n) !== i);
    expect(duplicates, "duplicate registry entries").toEqual([]);
  });

  it("registers no job without a file", () => {
    const files = new Set(cronFiles());
    const orphans = JOB_REGISTRY.map((j) => j.name).filter(
      (n) => !files.has(n),
    );
    expect(orphans).toEqual([]);
  });

  it("has a parseable schedule for every job", () => {
    for (const job of JOB_REGISTRY) {
      expect(
        () => parseCron(job.schedule),
        `${job.name}: ${job.schedule}`,
      ).not.toThrow();
    }
  });

  it("has a callable handler for every job", () => {
    for (const job of JOB_REGISTRY) {
      expect(typeof job.run, job.name).toBe("function");
    }
  });

  it("honours the schedules WP4 fixed for the audit chain", () => {
    // ADR-011 rev.4 / S03-10, S03-12: these two are operational
    // requirements from another work package, not free choices.
    expect(findJob("daily-audit-anchor")?.schedule).toBe("5 0 * * *");
    expect(findJob("audit-chain-verify")?.schedule).toBe("0 2 * * *");
  });

  it("registers the statutory-deadline monitors the audit named", () => {
    // S10-02 listed these explicitly as "never run" in production.
    for (const name of [
      "breach-72h-monitor",
      "dsr-sla-monitor",
      "wb-deadline-monitor",
      "dora-incident-deadline-monitor",
      "nis2-deadline-monitor",
      "document-retention-purge",
      "external-share-expiry",
      "portal-session-expiry",
      "daily-audit-anchor",
    ]) {
      expect(findJob(name), name).toBeDefined();
    }
  });

  it("resolves every historic endpoint alias to a real job", () => {
    for (const [alias, target] of Object.entries(JOB_PATH_ALIASES)) {
      expect(findJob(alias)?.name, alias).toBe(target);
    }
  });

  it("does not schedule everything at the same minute", () => {
    // 129 jobs firing at 00:00 would be a self-inflicted thundering herd.
    const at = new Map<string, number>();
    for (const job of JOB_REGISTRY) {
      const key = job.schedule.split(/\s+/).slice(0, 2).join(" ");
      at.set(key, (at.get(key) ?? 0) + 1);
    }
    const worst = Math.max(...at.values());
    expect(worst).toBeLessThan(JOB_REGISTRY.length / 3);
  });
});

describe("cron expression parser", () => {
  const at = (iso: string) => new Date(iso);

  it("matches a plain minute/hour expression", () => {
    const p = parseCron("5 0 * * *");
    expect(cronMatches(p, at("2026-09-01T00:05:00Z"))).toBe(true);
    expect(cronMatches(p, at("2026-09-01T00:06:00Z"))).toBe(false);
    expect(cronMatches(p, at("2026-09-01T01:05:00Z"))).toBe(false);
  });

  it("matches step expressions", () => {
    const p = parseCron("*/15 * * * *");
    for (const m of [0, 15, 30, 45]) {
      expect(
        cronMatches(p, at(`2026-09-01T03:${String(m).padStart(2, "0")}:00Z`)),
      ).toBe(true);
    }
    expect(cronMatches(p, at("2026-09-01T03:16:00Z"))).toBe(false);
  });

  it("treats both 0 and 7 as Sunday", () => {
    const a = parseCron("0 3 * * 0");
    const b = parseCron("0 3 * * 7");
    const sunday = at("2026-09-06T03:00:00Z");
    expect(cronMatches(a, sunday)).toBe(true);
    expect(cronMatches(b, sunday)).toBe(true);
    expect(cronMatches(a, at("2026-09-07T03:00:00Z"))).toBe(false);
  });

  it("applies Vixie semantics when dom AND dow are both restricted", () => {
    // "run on the 1st OR on a Monday"
    const p = parseCron("0 2 1 * 1");
    expect(cronMatches(p, at("2026-09-01T02:00:00Z"))).toBe(true); // 1st (Tue)
    expect(cronMatches(p, at("2026-09-07T02:00:00Z"))).toBe(true); // Monday
    expect(cronMatches(p, at("2026-09-08T02:00:00Z"))).toBe(false);
  });

  it("rejects malformed expressions instead of silently dropping the job", () => {
    expect(() => parseCron("0 2 * *")).toThrow();
    expect(() => parseCron("99 2 * * *")).toThrow();
    expect(() => parseCron("0 2 * * abc")).toThrow();
    expect(() => parseCron("*/0 * * * *")).toThrow();
  });

  it("computes the next occurrence strictly after the given time", () => {
    const p = parseCron("0 2 * * *");
    const next = nextRunAfter(p, at("2026-09-01T02:00:00Z"));
    expect(next?.toISOString()).toBe("2026-09-02T02:00:00.000Z");
  });

  it("advances a monthly expression across the month boundary", () => {
    const p = parseCron("0 3 1 * *");
    const next = nextRunAfter(p, at("2026-09-15T00:00:00Z"));
    expect(next?.toISOString()).toBe("2026-10-01T03:00:00.000Z");
  });
});
