/**
 * Performance measurement with a budget that fails the build.
 *
 * Plan §6.8 states the budget as a table of estimates "to be calibrated in
 * AP2/AP3". This module is that calibration plus the enforcement: it measures
 * the largest corpus diagram (`synth-large-flat-process`, 556 elements) on both
 * engines and fails when a number leaves its envelope.
 *
 * Three things this deliberately does *not* pretend to be:
 *
 *  - **A benchmark.** The numbers come from a shared CI machine under jsdom.
 *    They are useful as an order of magnitude and as a change detector, not as
 *    a specification of what a user will feel in a browser.
 *  - **A microbenchmark.** Each measurement runs the whole operation a few
 *    times and takes the median, which is enough to see a 2× regression and not
 *    enough to see a 5% one. A budget that fails on 5% noise is a budget that
 *    gets deleted within a month.
 *  - **A memory profile.** `heapUsed` deltas without a forced collection are
 *    an upper bound with a wide error bar. The number is recorded because
 *    §6.8 asks for it and because a tenfold change would still be visible;
 *    `--expose-gc` makes it meaningful and the runner says whether it was on.
 *
 * The budget below is set at roughly three times the measured median, so that
 * it catches a regression in kind (an accidental O(n²), a synchronous re-layout
 * per element) and tolerates a slow machine.
 */

export interface Measurement {
  readonly label: string;
  /** Median of `samples` runs, in milliseconds. */
  readonly medianMs: number;
  readonly minMs: number;
  readonly maxMs: number;
  readonly samples: number;
  /** Heap growth over the whole measurement in MB; approximate, see above. */
  readonly heapDeltaMb: number;
}

export interface BudgetEntry {
  readonly label: string;
  readonly maxMs?: number;
  readonly maxHeapMb?: number;
  /** Why this number and not another. */
  readonly rationale: string;
}

/** True when the process was started with `--expose-gc`. */
export function canForceGc(): boolean {
  return typeof (globalThis as { gc?: unknown }).gc === "function";
}

function forceGc(): void {
  const gc = (globalThis as { gc?: () => void }).gc;
  if (typeof gc === "function") gc();
}

function heapMb(): number {
  return process.memoryUsage().heapUsed / (1024 * 1024);
}

/** Run `fn` `samples` times and report the median wall time and heap growth. */
export async function measure(
  label: string,
  fn: () => Promise<unknown> | unknown,
  samples = 5,
): Promise<Measurement> {
  // One untimed warm-up: the first call pays for module loading, JIT and the
  // moddle registry, none of which a user pays per diagram.
  await fn();

  forceGc();
  const heapBefore = heapMb();
  const times: number[] = [];
  for (let i = 0; i < samples; i += 1) {
    const start = performance.now();
    await fn();
    times.push(performance.now() - start);
  }
  const heapAfter = heapMb();
  const sorted = [...times].sort((a, b) => a - b);

  return {
    label,
    medianMs: sorted[Math.floor(sorted.length / 2)] ?? 0,
    minMs: sorted[0] ?? 0,
    maxMs: sorted[sorted.length - 1] ?? 0,
    samples,
    heapDeltaMb: Math.max(0, heapAfter - heapBefore),
  };
}

export interface BudgetViolation {
  readonly label: string;
  readonly measured: number;
  readonly budget: number;
  readonly unit: "ms" | "MB";
}

export function checkBudget(
  measurements: readonly Measurement[],
  budget: readonly BudgetEntry[],
): BudgetViolation[] {
  const byLabel = new Map(measurements.map((m) => [m.label, m]));
  const out: BudgetViolation[] = [];
  for (const entry of budget) {
    const measurement = byLabel.get(entry.label);
    if (!measurement) continue;
    if (entry.maxMs !== undefined && measurement.medianMs > entry.maxMs) {
      out.push({
        label: entry.label,
        measured: measurement.medianMs,
        budget: entry.maxMs,
        unit: "ms",
      });
    }
    if (
      entry.maxHeapMb !== undefined &&
      measurement.heapDeltaMb > entry.maxHeapMb
    ) {
      out.push({
        label: entry.label,
        measured: measurement.heapDeltaMb,
        budget: entry.maxHeapMb,
        unit: "MB",
      });
    }
  }
  return out;
}

/** A table for the log and the report. */
export function formatMeasurements(
  measurements: readonly Measurement[],
): string {
  const rows = measurements.map(
    (m) =>
      `  ${m.label.padEnd(38)} ${m.medianMs.toFixed(1).padStart(9)} ms  ` +
      `(min ${m.minMs.toFixed(1)}, max ${m.maxMs.toFixed(1)}, n=${m.samples})  ` +
      `heap +${m.heapDeltaMb.toFixed(1)} MB`,
  );
  return rows.join("\n");
}
