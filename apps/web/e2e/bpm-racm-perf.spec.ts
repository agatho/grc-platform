/**
 * BPM Overhaul Phase 2 §12.5: RACM endpoint performance probe.
 *
 * The plan demands <1s response time at 500 processes / 5000 steps. We can't
 * realistically seed that much in a single test, so we probe what's already
 * there and assert the per-process RACM call returns within an order-of-
 * magnitude budget (5s soft cap). If a smoke org has been preloaded with
 * large fixtures, the budget will be exercised more rigorously.
 */
import { test, expect } from "@playwright/test";
import { STORAGE_STATE } from "./fixtures/storage";

test.describe("BPM — RACM endpoint perf", () => {
  test.use({ storageState: STORAGE_STATE });

  test("racm aggregates within budget", async ({ request }) => {
    const list = await request.get("/api/v1/processes?limit=5");
    expect(list.ok()).toBeTruthy();
    const items = (await list.json()).data ?? [];
    // [ARCTOS-FULL-2026-08-31 / WP11 · S11-02, S11-08] Was a bare
    // `test.skip(); return;` with no reason: on an org without processes the
    // perf probe reported "skipped" and the E2E gate stayed green — the same
    // silent-skip pattern as the 526 in the API smoke. The demo seed creates
    // processes (`packages/db/src/seeds`), so an empty list is a broken
    // fixture, not a reason to pass.
    expect(
      items.length,
      "no processes in this org — the RACM perf probe cannot measure anything. " +
        "Run the demo seed (npm run db:seed:demo) before the E2E suite.",
    ).toBeGreaterThan(0);

    const samples: number[] = [];
    for (const item of items.slice(0, 5)) {
      const t0 = performance.now();
      const racm = await request.get(`/api/v1/processes/${item.id}/racm`);
      expect(racm.ok()).toBeTruthy();
      samples.push(performance.now() - t0);
    }

    const max = Math.max(...samples);
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    console.log(
      `RACM perf samples (ms): ${samples.map((s) => s.toFixed(0)).join(", ")} avg=${avg.toFixed(0)} max=${max.toFixed(0)}`,
    );

    // Soft cap — plan target is 1000ms but small dev DBs may not exercise the
    // critical path. Anything slower than 5s indicates a regression.
    expect(max).toBeLessThan(5000);
  });
});
