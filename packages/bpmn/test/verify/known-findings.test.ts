/**
 * Guards on the findings registry itself.
 *
 * `known-findings.ts` is the one place in these tools where a failure is allowed
 * to pass. That makes it the one place most likely to rot: an entry added in a
 * hurry, a reproduction that stopped reproducing, a note that says "flaky". The
 * checks below are cheap and they are the reason the registry can be trusted at
 * all.
 *
 * What they cannot check is whether an entry is still *true*. That is what the
 * loud console warning in the property suite is for: an entry whose defect was
 * fixed shows up as a hit count that dropped to zero, and the next person to
 * read the report deletes it.
 */

import { describe, expect, it } from "vitest";
import {
  allKnown,
  KNOWN_FINDINGS,
  lookupFinding,
  RESOLVED_FINDINGS,
} from "./known-findings.js";
import { DIVERGENCE_RULES } from "../../src/verify/shadow.js";

describe("known-findings registry", () => {
  it("gives every entry an owner, a reproduction and a note", () => {
    for (const finding of [...KNOWN_FINDINGS, ...RESOLVED_FINDINGS]) {
      expect(finding.id, "a finding without an id cannot be matched").not.toBe(
        "",
      );
      expect(
        finding.repro.length,
        `${finding.id}: a finding without a reproduction is a rumour`,
      ).toBeGreaterThan(20);
      expect(
        finding.note.length,
        `${finding.id}: a finding without an explanation cannot be acted on`,
      ).toBeGreaterThan(40);
    }
  });

  it("has no duplicate ids", () => {
    const ids = [...KNOWN_FINDINGS, ...RESOLVED_FINDINGS].map(
      (finding) => finding.id,
    );
    expect(new Set(ids).size, `duplicate ids: ${ids.join(", ")}`).toBe(
      ids.length,
    );
  });

  it("matches only what is listed — and the list is empty", () => {
    // Der schärfste Zustand, den dieses Register haben kann: `allKnown`
    // antwortet für **jede** Kennung `false`, also zählt jeder Befund des
    // Eigenschaftslaufs als echter Befund — auch ohne `PROPERTY_STRICT=1`.
    expect(allKnown([]), "an empty failure must never count as known").toBe(
      false,
    );
    expect(allKnown(["ref/boundary-attached-to"])).toBe(false);
    expect(lookupFinding("something/new")).toBeUndefined();
    expect(lookupFinding("ref/boundary-attached-to")).toBeUndefined();
  });

  it("keeps a fix and a regression test on every resolved entry", () => {
    // Ein Eintrag darf nur dann in die Erledigt-Liste, wenn nachlesbar ist,
    // **wo** er behoben wurde — sonst ist „erledigt" eine Behauptung.
    for (const finding of RESOLVED_FINDINGS) {
      expect(
        finding.fixedIn.length,
        `${finding.id}: „behoben" ohne Fundstelle ist keine Angabe`,
      ).toBeGreaterThan(20);
    }
    expect(RESOLVED_FINDINGS.length).toBeGreaterThan(0);
  });

  it("keeps the count of open engine defects visible", () => {
    // Not an assertion about the number — it will change. An assertion that the
    // number is *reported*, so that nobody has to go looking for it.
    const byOwner: Record<string, number> = {};
    for (const finding of KNOWN_FINDINGS) {
      byOwner[`${finding.owner}/${finding.verdict}`] =
        (byOwner[`${finding.owner}/${finding.verdict}`] ?? 0) + 1;
    }
    console.info(
      `[known-findings] open=${String(KNOWN_FINDINGS.length)} ` +
        `${JSON.stringify(byOwner)} resolved=${String(RESOLVED_FINDINGS.length)}`,
    );
    // Ausdrücklich **keine** untere Schranke: null offene Befunde ist das
    // Ziel, nicht ein Fehler des Registers.
    expect(KNOWN_FINDINGS.length).toBeGreaterThanOrEqual(0);
  });

  it("keeps the shadow divergence rules explained too", () => {
    for (const rule of DIVERGENCE_RULES) {
      expect(
        rule.reason.length,
        `divergence rule ${String(rule.match)} has no reason; a verdict without one is a shrug`,
      ).toBeGreaterThan(40);
    }
    const open = DIVERGENCE_RULES.filter(
      (rule) => rule.verdict === "ours-wrong",
    );
    console.info(
      `[known-findings] ${open.length} divergence class(es) classified ours-wrong; plan §5.6 ` +
        "criterion 2 requires this to be zero before bpmn-js may be removed.",
    );
  });
});
