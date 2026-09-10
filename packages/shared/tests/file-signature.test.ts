// [ARCTOS-FULL-2026-08-31 / Welle 4c · OP-069] Magic-Byte-Prüfung von Uploads.
//
// Warum diese Datei
// -----------------
// `packages/shared/src/lib/file-signature.ts` ist die Antwort auf #S04-06:
// die MIME-Prüfung beim Upload vertraute dem vom Client geschickten
// `Content-Type`, also durfte beliebiger Inhalt als `application/pdf`
// gespeichert und später mit genau diesem `Content-Type` wieder ausgeliefert
// werden. Der Modulkopf beschreibt die Gegenmassnahme im Detail.
//
// Gemessen am 2026-09-03: von den vier Funktionen dieses Moduls war KEINE
// gedeckt, und im ganzen Repository gab es keine einzige Testdatei, die es
// berührt — obwohl es an zwei lebenden Stellen hängt
// (`api/v1/documents/[id]/upload/route.ts` und
// `lib/import-export/file-parser.ts`). Eine Sicherheitskontrolle, deren
// Wirkung nie nachgemessen wurde, ist eine Behauptung.
//
// Geprüft wird deshalb die Zusage, nicht die Implementierung:
//   * der GESCHNÜFFELTE Typ entscheidet, nicht der deklarierte;
//   * ausführbarer Inhalt wird abgelehnt, egal was die Allowlist sagt;
//   * ein ZIP-Container gilt nur als das, was der Aufrufer erlaubt hat;
//   * „unbekannt" ist ohne `allowUnknownForText` eine Ablehnung.

import { describe, it, expect } from "vitest";
import {
  sniffFileType,
  looksLikeText,
  verifyUploadSignature,
  MAGIC_BYTE_SIGNATURES,
  ALWAYS_FORBIDDEN_MIMES,
} from "../src/lib/file-signature";

/** Erzeugt einen Puffer aus Bytes plus etwas Füllung dahinter. */
function bytes(head: number[], fill = 64): Uint8Array {
  const b = new Uint8Array(head.length + fill);
  b.set(head, 0);
  b.fill(0x41, head.length); // 'A'
  return b;
}

const PDF = bytes([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
const ZIP = bytes([0x50, 0x4b, 0x03, 0x04]);
const PNG = bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ELF = bytes([0x7f, 0x45, 0x4c, 0x46]);
const PE = bytes([0x4d, 0x5a, 0x90, 0x00]);
const SHELL = new TextEncoder().encode("#!/bin/sh\nrm -rf /\n");
const CSV = new TextEncoder().encode("id;titel;status\n1;Risiko A;offen\n");

const XLSX =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// ---------------------------------------------------------------------------
describe("sniffFileType", () => {
  it("erkennt PDF, ZIP und PNG an den führenden Bytes", () => {
    expect(sniffFileType(PDF)?.mime).toBe("application/pdf");
    expect(sniffFileType(ZIP)?.mime).toBe("application/zip");
    expect(sniffFileType(PNG)?.mime).toBe("image/png");
  });

  it("erkennt WEBP trotz der vier Platzhalter-Bytes in der Signatur", () => {
    // RIFF <4 Byte Länge> WEBP — die Länge ist beliebig; ohne
    // Platzhalter-Behandlung würde kein einziges WEBP erkannt.
    const webp = bytes([
      0x52, 0x49, 0x46, 0x46, 0x2a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]);
    expect(sniffFileType(webp)?.mime).toBe("image/webp");
  });

  it("erkennt ein RIFF, das KEIN WEBP ist, nicht als WEBP", () => {
    // RIFF....WAVE — dieselben ersten vier Bytes, anderer Container. Ein
    // Platzhalter zu viel, und diese Datei käme als Bild durch.
    const wav = bytes([
      0x52, 0x49, 0x46, 0x46, 0x2a, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
    ]);
    expect(sniffFileType(wav)).toBeNull();
  });

  it("meldet null für Inhalte ohne Signatur (CSV, Text, XML)", () => {
    expect(sniffFileType(CSV)).toBeNull();
    expect(sniffFileType(new TextEncoder().encode("<svg/>"))).toBeNull();
  });

  it("meldet null für einen Puffer, der kürzer ist als die Signatur", () => {
    // Ein abgeschnittenes „%PD" ist kein PDF; ohne die Längenprüfung würde
    // hier über das Pufferende hinaus verglichen.
    expect(sniffFileType(new Uint8Array([0x25, 0x50, 0x44]))).toBeNull();
    expect(sniffFileType(new Uint8Array([]))).toBeNull();
  });

  it("erkennt jede Signatur der Tabelle auch wieder — die Tabelle ist widerspruchsfrei", () => {
    // Schützt gegen die schleichende Fehlerform „eine kurze Signatur wird vor
    // eine längere gestellt und verdeckt sie": jede Signatur muss sich selbst
    // auf denselben MIME-Typ zurück abbilden.
    for (const sig of MAGIC_BYTE_SIGNATURES) {
      const probe = bytes(sig.bytes.map((b) => b ?? 0x00));
      const hit = sniffFileType(probe);
      expect(
        hit,
        `Signatur ${sig.label} wurde gar nicht erkannt`,
      ).not.toBeNull();
      expect(hit!.mime, `Signatur ${sig.label} wird verdeckt`).toBe(sig.mime);
    }
  });
});

// ---------------------------------------------------------------------------
describe("looksLikeText", () => {
  it("hält CSV und UTF-8 mit Umlauten für Text", () => {
    expect(looksLikeText(CSV)).toBe(true);
    expect(looksLikeText(new TextEncoder().encode("Grüße, Ärger, Öl"))).toBe(
      true,
    );
  });

  it("hält alles mit einem NUL-Byte für binär", () => {
    expect(looksLikeText(new Uint8Array([0x41, 0x00, 0x42]))).toBe(false);
  });

  it("hält einen Binärstrom ohne NUL für binär", () => {
    const bin = new Uint8Array(200);
    for (let i = 0; i < bin.length; i++) bin[i] = 0x01 + (i % 7);
    expect(looksLikeText(bin)).toBe(false);
  });

  it("betrachtet nur die Stichprobe am Anfang", () => {
    // Die Signatur des Aufrufs verspricht `sampleSize`; ohne Wirkung wäre die
    // Zusage falsch. Textkopf + Binärschwanz, Stichprobe nur über den Kopf.
    const buf = new Uint8Array(200);
    buf.fill(0x41, 0, 100);
    buf.fill(0x01, 100);
    expect(looksLikeText(buf, 100)).toBe(true);
    expect(looksLikeText(buf, 200)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe("verifyUploadSignature — der geschnüffelte Typ entscheidet", () => {
  it("weist ein PNG ab, das sich als PDF ausgibt — genau der Befund S04-06", () => {
    const res = verifyUploadSignature(PNG, {
      allowedMimes: ["application/pdf"],
      declaredMime: "application/pdf",
    });
    expect(res.ok).toBe(false);
    expect(res.detectedMime).toBe("image/png");
    expect(res.reason).toMatch(/not in the allowed list/);
  });

  it("gibt bei Erfolg den geschnüffelten Typ zur Speicherung zurück, nicht den deklarierten", () => {
    const res = verifyUploadSignature(PNG, {
      allowedMimes: ["image/png"],
      declaredMime: "application/pdf", // gelogen
    });
    expect(res.ok).toBe(true);
    expect(res.detectedMime).toBe("image/png");
  });

  it.each([
    ["ELF-Binary", ELF],
    ["Windows-PE", PE],
    ["Shell-Skript", SHELL],
  ])("lehnt %s ab, auch wenn sein Typ auf der Allowlist steht", (_n, buf) => {
    const sniffed = sniffFileType(buf)!;
    expect(ALWAYS_FORBIDDEN_MIMES.has(sniffed.mime)).toBe(true);
    const res = verifyUploadSignature(buf, {
      // Der Aufrufer erlaubt den Typ ausdrücklich — die harte Sperre muss
      // trotzdem greifen, sonst wäre sie keine.
      allowedMimes: [sniffed.mime, "application/pdf"],
      declaredMime: "application/pdf",
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/Executable content detected/);
  });

  it("akzeptiert einen ZIP-Container als xlsx, wenn der Aufrufer xlsx erlaubt", () => {
    const res = verifyUploadSignature(ZIP, {
      allowedMimes: [XLSX],
      declaredMime: XLSX,
    });
    expect(res.ok).toBe(true);
    expect(res.detectedMime).toBe(XLSX);
  });

  it("lehnt denselben ZIP-Container ab, wenn nur PDF erlaubt ist", () => {
    const res = verifyUploadSignature(ZIP, {
      allowedMimes: ["application/pdf"],
      declaredMime: XLSX,
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/ZIP container/);
  });

  it("lehnt ein ZIP ab, dessen deklarierter Typ zwar OOXML ist, aber nicht erlaubt", () => {
    const res = verifyUploadSignature(ZIP, {
      allowedMimes: ["image/png"],
      declaredMime: XLSX,
    });
    expect(res.ok).toBe(false);
  });

  it("akzeptiert ein ZIP als ZIP, wenn application/zip selbst erlaubt ist", () => {
    const res = verifyUploadSignature(ZIP, {
      allowedMimes: ["application/zip"],
      declaredMime: "",
    });
    expect(res.ok).toBe(true);
    expect(res.detectedMime).toBe("application/zip");
  });

  it("lehnt Unbekanntes ohne allowUnknownForText ab", () => {
    const res = verifyUploadSignature(CSV, {
      allowedMimes: ["text/csv"],
      declaredMime: "text/csv",
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/no recognisable file signature/);
  });

  it("lässt CSV mit allowUnknownForText durch und behält den erlaubten deklarierten Typ", () => {
    const res = verifyUploadSignature(CSV, {
      allowedMimes: ["text/csv"],
      declaredMime: "text/csv",
      allowUnknownForText: true,
    });
    expect(res.ok).toBe(true);
    expect(res.detectedMime).toBe("text/csv");
  });

  it("fällt bei allowUnknownForText auf text/plain zurück, wenn der deklarierte Typ nicht erlaubt ist", () => {
    // Sonst würde ein nicht erlaubter, frei gewählter Content-Type über den
    // Textpfad doch noch in die Datenbank wandern.
    const res = verifyUploadSignature(CSV, {
      allowedMimes: ["text/csv"],
      declaredMime: "application/pdf",
      allowUnknownForText: true,
    });
    expect(res.ok).toBe(true);
    expect(res.detectedMime).toBe("text/plain");
  });

  it("lehnt binären Inhalt ohne Signatur auch mit allowUnknownForText ab", () => {
    const bin = new Uint8Array(200);
    for (let i = 0; i < bin.length; i++) bin[i] = 0x01 + (i % 7);
    const res = verifyUploadSignature(bin, {
      allowedMimes: ["text/csv"],
      allowUnknownForText: true,
    });
    expect(res.ok).toBe(false);
  });

  it("lehnt ein Shell-Skript auch auf dem Textpfad ab — es hat eine Signatur", () => {
    // `#!` ist eine erkannte Signatur, also läuft die Prüfung NICHT in den
    // Unbekannt-Zweig, sondern in die harte Sperre. Ohne die Signatur wäre
    // ein Skript reiner Text und käme durch.
    const res = verifyUploadSignature(SHELL, {
      allowedMimes: ["text/csv"],
      declaredMime: "text/csv",
      allowUnknownForText: true,
    });
    expect(res.ok).toBe(false);
    expect(res.detectedMime).toBe("text/x-shellscript");
  });
});
