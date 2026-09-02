/**
 * A seeded pseudo-random source.
 *
 * `Math.random()` is unusable here: a property test that cannot be replayed is
 * a test that reports "something broke" and nothing else. Everything random in
 * these tools comes from this generator, and every failure report carries the
 * seed that produced it, so `RNG(seed)` reconstructs the exact sequence.
 *
 * mulberry32 — 32 bits of state, one multiply-xorshift round. It is not
 * cryptographic and does not need to be; it needs to be short, dependency-free
 * and identical on every machine, which it is.
 */

export class Rng {
  private state: number;

  constructor(readonly seed: number) {
    this.state = seed >>> 0;
  }

  /** Uniform in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform integer in [min, max]. */
  int(min: number, max: number): number {
    if (max < min) return min;
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Uniform element of a non-empty array. Throws only on an empty array. */
  pick<T>(values: readonly T[]): T {
    if (values.length === 0) throw new Error("pick() on an empty array");
    return values[this.int(0, values.length - 1)] as T;
  }

  /** Pick by weight; weights need not sum to one. */
  weighted<T>(entries: readonly (readonly [T, number])[]): T {
    const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
    let threshold = this.next() * total;
    for (const [value, weight] of entries) {
      threshold -= weight;
      if (threshold <= 0) return value;
    }
    return entries[entries.length - 1]![0];
  }

  bool(probability = 0.5): boolean {
    return this.next() < probability;
  }
}

/**
 * Names that have historically broken BPMN round-trips: XML metacharacters,
 * non-ASCII, a line break, a soft hyphen, an emoji, whitespace-only, empty, and
 * one long enough to force a label to wrap.
 */
export const AWKWARD_NAMES: readonly string[] = [
  "",
  " ",
  "Freigabe",
  "Prüfung & Freigabe",
  "a < b > c",
  "Anführung \"doppelt\" und 'einfach'",
  "Zeile eins\nZeile zwei",
  "Ver­trags­prüfung",
  "Rückstellung 🇩🇪 prüfen",
  "Ünïcödé Ähnlichkeitsprüfung mit sehr langem Namen der garantiert umbrechen muss",
  "]]> CDATA-Ende mitten im Text",
  "&amp; schon entitiert",
  "\t führendes Tab",
];
