// [ARCTOS-FULL-2026-08-31 / Welle 4b, Strang 6 · OP-065]
// Der minimale DER-Parser aus `src/lib/asn1-der.ts` — Bereichsprüfungen.
//
// Warum diese Datei
// -----------------
// Dieser Parser liest die Antwort einer RFC-3161-Zeitstempelstelle
// (`src/lib/freetsa.ts`), also Bytes von dem, der die TLS-Verbindung
// terminiert — und beim periodischen Nachprüfen ausserdem `audit_anchor.proof`
// aus der Datenbank. Bis zum 2026-09-03 hatte er KEINE einzige
// Bereichsprüfung. `noUncheckedIndexedAccess` hat das sichtbar gemacht:
// `buf[offset]` ist jenseits des Puffers `undefined`, und JavaScript macht
// daraus im Bit-Ausdruck stillschweigend eine 0.
//
// Gemessen am 2026-09-03 gegen 01d0e4cc:
//
//   readNode(Buffer.alloc(0))                  → { tag: undefined, len: 0, end: 2 }
//   readNode([0x30])                           → { tag: 48, len: 0, end: 2 }
//   readNode([0x04, 0x10, 0x01])               → deklariert 16 Inhaltsbytes,
//                                                liefert 1, end: 18 (hinter dem Puffer)
//   readNode([0x30,0x84,0xff,0xff,0xff,0xf0])  → { len: 0, end: -10 }
//   readNode([0x30,0x80,0x01,0x02])            → BER-„indefinite length",
//                                                als Länge 0 gelesen
//
// Und der schwerste Fall, ebenfalls gemessen: `readChildren` auf einem Knoten,
// dessen Inhalt die sechs Bytes `30 84 ff 00 00 00` sind. Die Längenrechnung
// `length = (length << 8) | byte` läuft in 32 Bit MIT Vorzeichen über, das
// erste Kind meldet `end: -16777210`, und `off = child.end` setzt den Versatz
// VOR den Anfang. Von dort läuft die Schleife in Zweierschritten wieder nach
// oben — und trifft dabei exakt die 0, weil -16777210 gerade ist. Dort liest
// sie denselben Knoten erneut und springt wieder auf -16777210: eine
// Endlosschleife, die in jeder Runde einen Knoten in ein Feld schiebt. Der
// Messlauf endete mit Exit 137 (vom Kernel wegen Speichermangels beendet);
// mit einem Deckel statt des Feldes zählte er 50.000.000 Runden in 1,9 s ohne
// Aussicht auf ein Ende. Sechs Bytes genügen, um den Worker-Prozess zu töten.
//
// Alle Fälle enden jetzt in einer Ausnahme. Das ist der richtige Ausgang:
// `freetsa.ts` fängt jeden Fehler dieses Pfades und macht daraus einen
// `TimestampValidationError` — der Zeitstempel gilt dann als nicht erbracht,
// und genau das ist er auch.

import { describe, it, expect } from "vitest";
import {
  readNode,
  readChildren,
  encodeInteger,
  encodeOid,
  encodeSequence,
  encodeOctetString,
  OID_SHA256,
} from "../src/lib/asn1-der";

describe("readNode — Bereichsprüfung statt stiller Nullen", () => {
  it("lehnt einen leeren Puffer ab, statt tag: undefined zu liefern", () => {
    expect(() => readNode(Buffer.alloc(0), 0)).toThrow(/truncated node/i);
  });

  it("lehnt einen Knoten ohne Längenbyte ab", () => {
    expect(() => readNode(Buffer.from([0x30]), 0)).toThrow(/truncated node/i);
  });

  it("lehnt eine Inhaltslänge ab, die über das Pufferende hinausreicht", () => {
    // Vorher: `subarray` schnitt still ab — der Aufrufer bekam 1 statt 16
    // Bytes, ohne es zu erfahren. Bei einem `messageImprint`-Vergleich ist
    // das genau die Art Unterschied, die man nicht raten will.
    expect(() => readNode(Buffer.from([0x04, 0x10, 0x01]), 0)).toThrow(
      /declares 16 content bytes but only 1/,
    );
  });

  it("lehnt eine Längenangabe ab, deren Längenbytes selbst fehlen", () => {
    expect(() => readNode(Buffer.from([0x30, 0x82, 0x01]), 0)).toThrow(
      /truncated length field/i,
    );
  });

  it('lehnt die BER-Form „indefinite length" (0x80) ab', () => {
    // DER kennt sie nicht. Vorher wurde sie als Länge 0 gelesen — der Inhalt
    // verschwand kommentarlos.
    expect(() => readNode(Buffer.from([0x30, 0x80, 0x01, 0x02]), 0)).toThrow(
      /unsupported length encoding/i,
    );
  });

  it("lehnt mehr als vier Längenbytes ab", () => {
    const buf = Buffer.concat([
      Buffer.from([0x30, 0x85]),
      Buffer.alloc(5, 0x01),
    ]);
    expect(() => readNode(buf, 0)).toThrow(/unsupported length encoding/i);
  });

  it("rechnet vier Längenbytes vorzeichenfrei — keine negative Länge mehr", () => {
    // `0x84 ff ff ff f0` ergab über `<< 8` die int32-Zahl -16 und damit
    // `end: -10`, also ein Ende VOR dem Anfang. Jetzt ist die Länge
    // 4.294.967.280 und wird als „reicht über den Puffer hinaus" abgelehnt.
    const buf = Buffer.from([0x30, 0x84, 0xff, 0xff, 0xff, 0xf0]);
    let end: number | null = null;
    try {
      end = readNode(buf, 0).end;
    } catch {
      end = null;
    }
    expect(end).not.toBe(-10);
    expect(() => readNode(buf, 0)).toThrow(/content bytes but only/);
  });

  it("liest einen wohlgeformten Knoten unverändert", () => {
    const der = encodeOctetString(Buffer.from("hallo", "utf8"));
    const node = readNode(der, 0);
    expect(node.tag).toBe(0x04);
    expect(node.value.toString("utf8")).toBe("hallo");
    expect(node.end).toBe(der.length);
  });

  it("liest eine Länge in Langform (0x81/0x82) korrekt", () => {
    for (const n of [200, 1000, 70000]) {
      const der = encodeOctetString(Buffer.alloc(n, 0x2a));
      const node = readNode(der, 0);
      expect(node.value.length).toBe(n);
      expect(node.end).toBe(der.length);
    }
  });
});

describe("readChildren — kommt immer voran", () => {
  it("hängt sich an einer negativen Kindlänge nicht auf", () => {
    // ACHTUNG: Gegen den Stand 01d0e4cc terminiert dieser Test NICHT. Die
    // Schleife lief endlos (siehe Kopf dieser Datei: Exit 137, 50 Mio. Runden
    // ohne Ende). Er ist damit auch der Nachweis, dass der alte Stand ihn
    // nicht bestanden hat — er hätte den Testlauf selbst mitgenommen.
    const inner = Buffer.from([0x30, 0x84, 0xff, 0x00, 0x00, 0x00]);
    const node = { tag: 0x30, value: inner, end: inner.length };
    const t0 = Date.now();
    expect(() => readChildren(node)).toThrow();
    expect(Date.now() - t0).toBeLessThan(1000);
  });

  it("zerlegt eine wohlgeformte SEQUENCE in ihre Kinder", () => {
    const der = encodeSequence(
      encodeInteger(1),
      encodeOid(OID_SHA256),
      encodeOctetString(Buffer.from([0xaa, 0xbb])),
    );
    const kinder = readChildren(readNode(der, 0));
    expect(kinder.map((k) => k.tag)).toEqual([0x02, 0x06, 0x04]);
    expect(kinder[2]?.value.toString("hex")).toBe("aabb");
  });
});

describe("encodeInteger — nur nicht-negative Werte", () => {
  it("weist einen negativen Wert zurück, statt einen leeren INTEGER zu erzeugen", () => {
    // Gemessen am 2026-09-03 gegen 01d0e4cc: `encodeInteger(-1)` lieferte
    // `0200` — Tag INTEGER, Länge 0, kein Inhalt. Das ist kein ungenauer
    // Wert, das ist ungültiges DER, und es wäre erst beim Gegenüber
    // aufgefallen. Der Kommentar im Code sagt seit jeher „non-negative".
    expect(() => encodeInteger(-1)).toThrow(/non-negative/i);
    expect(() => encodeInteger(-12345n)).toThrow(/non-negative/i);
  });

  it("kodiert 0, kleine und grosse Werte wie bisher", () => {
    expect(encodeInteger(0).toString("hex")).toBe("020100");
    expect(encodeInteger(1).toString("hex")).toBe("020101");
    // Führende 0x00, damit der Wert positiv bleibt.
    expect(encodeInteger(0x80).toString("hex")).toBe("0202" + "0080");
    expect(encodeInteger(0x1234n).toString("hex")).toBe("0202" + "1234");
  });
});

describe("encodeOid — numerische Bögen", () => {
  it("weist eine OID mit nicht-numerischem Bogen zurück", () => {
    // Gemessen am 2026-09-03 gegen 01d0e4cc: `encodeOid("2.a.1")` lieferte
    // `060201` — `parseInt("a")` ist `NaN`, `NaN * 40 + NaN` ist `NaN`, und
    // `Buffer.from([NaN])` schreibt daraus stillschweigend ein 0x00. Heraus
    // kam eine syntaktisch gültige, inhaltlich falsche Kennung.
    expect(() => encodeOid("2.a.1")).toThrow(/non-numeric/i);
    expect(() => encodeOid("1.2..3")).toThrow(/non-numeric/i);
    expect(() => encodeOid("2")).toThrow(/at least two components/i);
  });

  it("kodiert die SHA-256-OID unverändert", () => {
    // 2.16.840.1.101.3.4.2.1 — RFC 5754.
    expect(encodeOid(OID_SHA256).toString("hex")).toBe(
      "0609" + "608648016503040201",
    );
  });
});
