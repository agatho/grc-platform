// notify-dedupe-key.test.ts — [ARCTOS-FULL-2026-08-31 · OP-105]
//
// Der Befund war nicht „der Schlüssel ist unschön", sondern: eine Erinnerung,
// deren Titel herunterzählt, wird jeden Tag erneut zugestellt, obwohl das
// Dedup-Fenster eine Woche ist. Beides steht hier als Test.

import { describe, it, expect } from "vitest";
import { deriveDedupeKey } from "../../src/lib/notify";

type Werte = Parameters<typeof deriveDedupeKey>[0];

function meldung(over: Partial<Werte> = {}): Werte {
  return {
    userId: "11111111-1111-4111-8111-111111111111",
    orgId: "22222222-2222-4222-8222-222222222222",
    type: "deadline_approaching",
    entityType: "dd_session",
    entityId: "33333333-3333-4333-8333-333333333333",
    title: "DD reminder: Contoso — 7 days remaining",
    templateKey: "dd_session_reminder",
    ...over,
  } as Werte;
}

const MONTAG = new Date("2026-09-07T08:00:00Z");
const DIENSTAG = new Date("2026-09-08T08:00:00Z");

describe("deriveDedupeKey", () => {
  it("bleibt gleich, wenn nur der Titel herunterzählt (OP-105)", () => {
    const montag = deriveDedupeKey(meldung(), "week", MONTAG);
    const dienstag = deriveDedupeKey(
      meldung({ title: "DD reminder: Contoso — 6 days remaining" }),
      "week",
      DIENSTAG,
    );
    expect(dienstag).toBe(montag);
  });

  it("bleibt gleich, wenn nur die Dringlichkeitsstufe im Titel wechselt", () => {
    const warnung = deriveDedupeKey(
      meldung({ title: "[WARNING] ISMS NC: NC-1 Kennwortrichtlinie" }),
      "day",
      MONTAG,
    );
    const ueberfaellig = deriveDedupeKey(
      meldung({ title: "[CRITICAL_OVERDUE] ISMS NC: NC-1 Kennwortrichtlinie" }),
      "day",
      MONTAG,
    );
    expect(ueberfaellig).toBe(warnung);
  });

  it("trennt weiterhin, was verschieden gemeint ist", () => {
    // Zwei Fristen desselben Hinweisgeberfalls an dieselbe Person: gleiche
    // Entität, gleicher Typ, verschiedene Vorlage.
    const bestaetigung = deriveDedupeKey(
      meldung({
        entityType: "wb_case",
        templateKey: "wb_acknowledge_reminder",
        title: "Whistleblowing: WB-7 — acknowledgment deadline approaching",
      }),
      "day",
      MONTAG,
    );
    const antwort = deriveDedupeKey(
      meldung({
        entityType: "wb_case",
        templateKey: "wb_response_reminder",
        title: "Whistleblowing: WB-7 — 3-month response deadline approaching",
      }),
      "day",
      MONTAG,
    );
    expect(antwort).not.toBe(bestaetigung);
  });

  it("trennt weiterhin nach Entität, Empfänger und Fenster", () => {
    const basis = deriveDedupeKey(meldung(), "week", MONTAG);
    expect(
      deriveDedupeKey(meldung({ entityId: "andere" }), "week", MONTAG),
    ).not.toBe(basis);
    expect(
      deriveDedupeKey(meldung({ userId: "andere" }), "week", MONTAG),
    ).not.toBe(basis);
    // Nächste Kalenderwoche: neuer Schlüssel, die Erinnerung darf wiederkommen.
    expect(
      deriveDedupeKey(meldung(), "week", new Date("2026-09-15T08:00:00Z")),
    ).not.toBe(basis);
  });

  it("fällt ohne templateKey auf den Titel zurück — dort lieber einmal zu viel", () => {
    const ohne = meldung({ templateKey: null });
    const a = deriveDedupeKey(ohne, "week", MONTAG);
    const b = deriveDedupeKey(
      { ...ohne, title: "anderer Titel" } as Werte,
      "week",
      MONTAG,
    );
    expect(a).not.toBe(b);
  });

  it("liefert null bei dedupeWindow 'none'", () => {
    expect(deriveDedupeKey(meldung(), "none", MONTAG)).toBeNull();
  });
});
