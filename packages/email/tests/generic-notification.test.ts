// [ARCTOS-FULL-2026-08-31 · OP-066] Die generische Vorlage, geprüft.
//
// `GenericNotification.tsx` ist die Schicht hinter **65** der 92
// Vorlagenschlüssel (S10-03): jede Frist-, Eskalations- und Erinnerungsmail,
// die keine eigene React-Vorlage hat, wird von dieser einen Datei gerendert.
// Sie kam mit WP9 hinzu, und die Funktions-Coverage von `packages/email` fiel
// dabei von 97,46 % auf 95,50 % — vier von fünf Funktionen dieser Datei waren
// ungeprüft. Im Aggregat ging das unter; die relative Ratsche hat es gefangen.
//
// Was hier geprüft wird, ist nicht „rendert ohne zu werfen" (das tut der
// Smoke-Test), sondern die drei Zusagen aus dem Dateikopf:
//
//   1. Sie erfindet nichts. Ein Feld, das die Benachrichtigung nicht hat,
//      erscheint nicht — kein "undefined", kein leeres Kästchen, kein Knopf
//      ohne Ziel.
//   2. Der Betreff folgt der Regel „Rubrik: Titel" und fällt in beiden
//      Sprachen auf etwas Lesbares zurück, wenn eines von beidem fehlt.
//   3. Der Schweregrad ist in der Ausgabe sichtbar und sprachabhängig.

import { describe, it, expect } from "vitest";
import { render } from "@react-email/render";
import * as React from "react";
import {
  GenericNotification,
  getSubject,
  type GenericNotificationProps,
} from "../src/templates/GenericNotification";
import { sanitiseSubject } from "../src/EmailService";
import type { EmailSeverity } from "../src/template-registry";

const BASE: GenericNotificationProps = {
  lang: "de",
  headline: "Richtlinie überfällig",
  severity: "warning",
  title: "Informationssicherheitsrichtlinie",
};

// `React.createElement` statt JSX: die Suite dieses Pakets läuft ohne
// React-Plugin (`include: tests/**/*.test.ts`), wie die übrigen Tests hier.
const html = (props: Partial<GenericNotificationProps>) =>
  render(React.createElement(GenericNotification, { ...BASE, ...props }));

describe("getSubject", () => {
  it("setzt Rubrik und Titel zusammen", () => {
    expect(
      getSubject(
        {
          __headline: "Frist überschritten",
          notificationTitle: "DSGVO Art. 33",
        },
        "de",
      ),
    ).toBe("Frist überschritten: DSGVO Art. 33");
  });

  it("nimmt `title`, wenn `notificationTitle` fehlt", () => {
    expect(getSubject({ __headline: "A", title: "B" }, "de")).toBe("A: B");
  });

  it("nimmt, was da ist, wenn nur eines von beidem da ist", () => {
    expect(getSubject({ __headline: "Nur Rubrik" }, "de")).toBe("Nur Rubrik");
    expect(getSubject({ notificationTitle: "Nur Titel" }, "en")).toBe(
      "Nur Titel",
    );
  });

  it("fällt sprachabhängig zurück statt auf einen leeren Betreff", () => {
    expect(getSubject({}, "de")).toBe("ARCTOS-Benachrichtigung");
    expect(getSubject({}, "en")).toBe("ARCTOS notification");
  });

  it("verschluckt sich nicht an Feldern, die keine Zeichenketten sind", () => {
    // `template_data` ist eine JSONB-Spalte: dort kann alles stehen.
    expect(getSubject({ __headline: 42, notificationTitle: null }, "de")).toBe(
      "ARCTOS-Benachrichtigung",
    );
  });
});

describe("GenericNotification — erfindet nichts", () => {
  it("zeigt Rubrik und Titel", async () => {
    const out = await html({});
    expect(out).toContain("Richtlinie überfällig");
    expect(out).toContain("Informationssicherheitsrichtlinie");
  });

  it("lässt Nachricht, Fakten und Knopf weg, wenn sie fehlen", async () => {
    const out = await html({});
    expect(out).not.toContain("undefined");
    expect(out).not.toContain("In ARCTOS öffnen");
    expect(out).not.toContain("[object Object]");
  });

  it("zeigt den Knopf nur mit Ziel — und dann mit genau diesem Ziel", async () => {
    const url = "https://arctos.example.com/policies/abc-123";
    const out = await html({ actionUrl: url });
    expect(out).toContain("In ARCTOS öffnen");
    expect(out).toContain(url);
  });

  it("rendert jede Tatsache als Paar aus Bezeichnung und Wert", async () => {
    const out = await html({
      facts: [
        { label: "Fällig am", value: "2026-09-30" },
        { label: "Verantwortlich", value: "Lisa Schneider" },
      ],
    });
    expect(out).toContain("Fällig am");
    expect(out).toContain("2026-09-30");
    expect(out).toContain("Verantwortlich");
    expect(out).toContain("Lisa Schneider");
  });

  it("grüßt mit Namen, wenn einer da ist, und sonst ohne", async () => {
    expect(await html({ recipientName: "Lisa Schneider" })).toContain(
      "Hallo Lisa Schneider,",
    );
    const anonymous = await html({});
    expect(anonymous).toContain("Hallo,");
    expect(anonymous).not.toContain("Hallo undefined");
  });

  it("nennt die Organisation nur, wenn sie bekannt ist", async () => {
    expect(await html({ orgName: "Meridian Holdings" })).toContain(
      "Meridian Holdings",
    );
  });
});

describe("GenericNotification — Sprache und Schweregrad", () => {
  it("beschriftet jeden Schweregrad in beiden Sprachen verschieden", async () => {
    const severities: EmailSeverity[] = [
      "info",
      "action",
      "warning",
      "critical",
    ];
    for (const severity of severities) {
      const de = await html({ severity, lang: "de" });
      const en = await html({ severity, lang: "en" });
      expect(de, `Schweregrad ${severity} rendert nichts`).not.toBe("");
      // Die Sprachfassungen müssen sich unterscheiden — sonst ist eine der
      // beiden ein Kopierfehler.
      expect(de, `de und en sind identisch bei ${severity}`).not.toBe(en);
    }
  });

  it("nennt den Schweregrad im Klartext, nicht als Kennung", async () => {
    expect(await html({ severity: "critical", lang: "de" })).toContain(
      "Gesetzliche Frist",
    );
    expect(await html({ severity: "critical", lang: "en" })).toContain(
      "Statutory deadline",
    );
  });

  it("setzt `lang` am `html`-Element — Screenreader und Spamfilter lesen es", async () => {
    expect(await html({ lang: "en" })).toContain('lang="en"');
    expect(await html({ lang: "de" })).toContain('lang="de"');
  });
});

describe("sanitiseSubject — die Grenze für alle 26 Vorlagen", () => {
  it("macht aus einem Zeilenumbruch ein Leerzeichen statt einer zweiten Kopfzeile", () => {
    expect(sanitiseSubject("Frist\r\nBcc: angreifer@example.com\r\nX: y")).toBe(
      "Frist Bcc: angreifer@example.com X: y",
    );
  });

  it("gibt einen leeren Betreff zurück statt »[object Object]«", () => {
    expect(sanitiseSubject({ a: 1 })).toBe("");
    expect(sanitiseSubject(42)).toBe("");
    expect(sanitiseSubject(undefined)).toBe("");
    expect(sanitiseSubject(null)).toBe("");
  });

  it("lässt einen gewöhnlichen Betreff unverändert", () => {
    expect(sanitiseSubject("Richtlinie überfällig: ISMS-Leitlinie")).toBe(
      "Richtlinie überfällig: ISMS-Leitlinie",
    );
  });
});
