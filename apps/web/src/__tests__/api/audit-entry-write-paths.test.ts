// [ARCTOS-FULL-2026-08-31 · OP-047] Die vier `audit_log`-Schreibwege ohne Test.
//
// Was war. `E2E-TRIAGE-4.md` §9 hat acht Stellen gefunden, die den Audit-Trail
// mit `tx.insert(auditLog)` direkt beschrieben haben. Migration
// `0407_audit_grants_and_migration_anchor.sql` entzieht der Laufzeitrolle
// `grc_app` genau dieses Recht (`GRANT SELECT`, dann ausdrückliches
// `REVOKE INSERT/UPDATE/DELETE`) und verweist auf die SECURITY-DEFINER-Funktion
// `write_audit_entry()`. Die acht Pfade waren seit 0407 tot: sie antworteten
// `42501 permission denied for table audit_log`, der Aufruf endete in 500, und
// die Ereignisse — wer eine kontrollierte Kopie bezogen hat, wer nach Art. 17
// DSGVO gelöscht hat, ob eine Integritätsprüfung bestanden hat, welche
// Massenänderung an Prozessen lief — fehlten vollständig im Trail. Gemessen
// wurde das erst, als eine übersprungene E2E-Datei zum ersten Mal wirklich lief.
//
// Warum diese Datei nötig ist. Nach der Reparatur gehen sechs Schreibwege durch
// `writeAuditEntry()`. Zwei davon sind gepinnt:
// `document-signature-requests.test.ts` (signature-provider) und
// `documents-upload-immutability.test.ts` (upload). Die übrigen **vier** hatte
// niemand:
//
//   * `lib/documents/controlled-copy.ts`  — jede Herausgabe aus dem DMS
//   * `documents/[id]/erase`              — die DSGVO-Löschung samt Begründung
//   * `documents/[id]/verify-integrity`   — das Ergebnis der Hash-Prüfung
//   * `processes/bulk`                    — die Massenänderung
//
// `documents-controlled-copy.test.ts` deckt den Download inhaltlich ab, mockt
// aber `drizzle-orm.sql` als `noop` und `recordControlledCopyDownload` ganz weg
// — der Audit-Schreibweg ist dort konstruktionsbedingt unsichtbar. Genau so
// konnte der Defekt acht Monate unbemerkt bleiben.
//
// Was hier geprüft wird, und warum in dieser Form. Der Nachweis muss zwei Dinge
// gleichzeitig treffen, weil der Defekt aus ihrem Zusammenspiel entstand:
//
//   1. die Zeile geht durch `write_audit_entry(...)` — also über die Funktion,
//      auf die die Laufzeitrolle EXECUTE hat, nicht über `INSERT INTO audit_log`;
//   2. sie läuft innerhalb von `withAuditContext`, denn der BEFORE-INSERT-Trigger
//      aus `0401` liest `app.current_org_id` / `app.current_user_id` von genau
//      dieser Verbindung, um Kette und Geltungsbereich zu setzen.
//
// Deshalb behält der `drizzle-orm`-Mock hier — anders als in
// `documents-controlled-copy.test.ts` — sein `sql`-Template: nur so ist der
// abgesetzte Funktionsaufruf im Test überhaupt lesbar.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";

// ── Aufzeichnung dessen, was auf der Transaktion passiert ──────────────────
/** Rohe Statements auf der Transaktion — hier landet `write_audit_entry`. */
const executed: Array<{ text: string; values: unknown[] }> = [];
/** Direkte ORM-Inserts. Muss für `audit_log` IMMER leer bleiben (0407). */
const inserted: Array<{ table: string; values: unknown }> = [];
const updated: Array<{ table: string; values: unknown }> = [];
const deleted: string[] = [];
/** Die Annotation, mit der `withAuditContext` aufgerufen wurde. */
const auditContextCalls: unknown[] = [];

function tableName(t: unknown): string {
  return (t as { __name?: string })?.__name ?? "unknown";
}

const tx = {
  select: () => ({
    from: () => ({ where: () => Promise.resolve([]) }),
  }),
  insert: (t: unknown) => ({
    values: (v: unknown) => {
      inserted.push({ table: tableName(t), values: v });
      return { returning: () => Promise.resolve([{ id: "row-1" }]) };
    },
  }),
  update: (t: unknown) => ({
    set: (v: unknown) => {
      updated.push({ table: tableName(t), values: v });
      return {
        where: () => Promise.resolve(undefined),
      };
    },
  }),
  delete: (t: unknown) => ({
    where: () => {
      deleted.push(tableName(t));
      return Promise.resolve(undefined);
    },
  }),
  execute: async (q: unknown) => {
    executed.push(q as { text: string; values: unknown[] });
    return [];
  },
};

/** Der `write_audit_entry(...)`-Aufruf, oder `undefined`. */
function auditEntryCall(): { text: string; values: unknown[] } | undefined {
  return executed.find((q) => q?.text?.includes("write_audit_entry"));
}

/** Alle `write_audit_entry(...)`-Aufrufe (bulk schreibt genau einen). */
function auditEntryCalls(): Array<{ text: string; values: unknown[] }> {
  return executed.filter((q) => q?.text?.includes("write_audit_entry"));
}

// ── Modulgrenzen ───────────────────────────────────────────────────────────
const selectQueue: unknown[][] = [];

vi.mock("@grc/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(selectQueue.shift() ?? []),
      }),
    }),
  },
  document: { __name: "document" },
  documentFile: { __name: "document_file" },
  documentVersion: { __name: "document_version" },
  workItem: { __name: "work_item" },
  process: { __name: "process" },
  userOrganizationRole: { __name: "user_organization_role" },
  auditLog: { __name: "audit_log" },
}));

vi.mock("drizzle-orm", () => {
  const noop = () => ({}) as unknown;
  // Das `sql`-Template bleibt erhalten: der Funktionsaufruf, den 0407
  // vorschreibt, ist sonst im Test nicht von einem beliebigen `execute`
  // unterscheidbar — und der ganze Punkt dieser Datei ist, ihn zu sehen.
  const sqlTag = (strings: TemplateStringsArray, ...values: unknown[]) => ({
    text: Array.isArray(strings) ? strings.join("?") : String(strings),
    values,
  });
  return { eq: noop, and: noop, isNull: noop, inArray: noop, sql: sqlTag };
});

vi.mock("@grc/auth", () => ({
  requireModule: vi.fn(async () => undefined),
}));

const ctx = {
  session: {
    user: {
      id: "user-1",
      name: "Max Mustermann",
      email: "max@example.com",
      roles: [{ orgId: "org-1", role: "admin" }],
    },
  },
  orgId: "org-1",
  userId: "user-1",
};

vi.mock("@/lib/api", () => ({
  withAuth: vi.fn(async () => ctx),
  withAuditContext: vi.fn(
    async (
      _ctx: unknown,
      fn: (t: unknown) => Promise<unknown>,
      annotation?: unknown,
    ) => {
      auditContextCalls.push(annotation ?? null);
      return fn(tx);
    },
  ),
}));

const storageDelete = vi.fn(async () => undefined);
const storageGet = vi.fn(async () => Buffer.from("inhalt"));
vi.mock("@grc/shared/lib/file-storage", async () => {
  const actual = await vi.importActual<
    typeof import("@grc/shared/lib/file-storage")
  >("@grc/shared/lib/file-storage");
  return {
    ...actual,
    getFileStorage: () => ({
      put: vi.fn(),
      get: storageGet,
      delete: storageDelete,
      exists: vi.fn(),
    }),
  };
});

import { recordControlledCopyDownload } from "@/lib/documents/controlled-copy";
import { DELETE as ERASE } from "../../app/api/v1/documents/[id]/erase/route";
import { GET as VERIFY } from "../../app/api/v1/documents/[id]/verify-integrity/route";
import { POST as BULK } from "../../app/api/v1/processes/bulk/route";

beforeEach(() => {
  executed.length = 0;
  inserted.length = 0;
  updated.length = 0;
  deleted.length = 0;
  auditContextCalls.length = 0;
  selectQueue.length = 0;
  storageDelete.mockClear();
  storageGet.mockClear();
});

/**
 * Die gemeinsame Zusicherung aller vier Pfade. Sie steht hier einmal, damit
 * ein neuer Schreibweg sie in einer Zeile übernehmen kann — und damit die
 * beiden Hälften des Befunds nie wieder getrennt geprüft werden.
 */
function expectChainedAuditEntry(actionDetail: string): void {
  const call = auditEntryCall();
  expect(
    call,
    `Die Zeile muss durch write_audit_entry() gehen: die Laufzeitrolle hat auf ` +
      `audit_log nur SELECT (Migration 0407). Ausgeführt wurde stattdessen: ` +
      JSON.stringify(executed.map((e) => e.text.slice(0, 60))),
  ).toBeDefined();
  expect(call!.values).toContain(actionDetail);
  // Der zweite Teil des Befunds: ohne `withAuditContext` fehlen
  // `app.current_org_id`/`app.current_user_id` auf der Verbindung, und der
  // Ketten-Trigger aus 0401 setzt Geltungsbereich und `previous_hash` nicht.
  expect(
    auditContextCalls.length,
    "der Schreibweg muss innerhalb von withAuditContext laufen",
  ).toBeGreaterThan(0);
  // Und niemals wieder der direkte Weg.
  expect(
    inserted.filter((i) => i.table === "audit_log"),
    "kein direktes INSERT INTO audit_log — genau daran starben die acht Pfade",
  ).toEqual([]);
}

// ───────────────────────────────────────────────────────────────────────────
describe("OP-047 · controlled-copy — jede Herausgabe aus dem DMS", () => {
  const info = {
    documentId: "doc-1",
    title: "IS-Richtlinie",
    fileName: "richtlinie.pdf",
    versionLabel: "2.0",
    sha256: "a".repeat(64),
    fileId: "file-1",
    documentStatus: "approved",
  };

  it("schreibt die gestempelte Kopie über write_audit_entry()", async () => {
    await recordControlledCopyDownload(ctx as never, {
      ...info,
      outcome: "watermarked",
    });
    expectChainedAuditEntry("controlled_copy_download");
  });

  // #S06-08: der unkontrollierte Bezug ist der forensisch wertvollere. Er war
  // vor der Reparatur der einzige, der GAR NICHT protokolliert wurde — die
  // Beweislage war invertiert.
  it("schreibt auch den ?raw=1-Bezug — mit eigenem actionDetail", async () => {
    await recordControlledCopyDownload(ctx as never, {
      ...info,
      outcome: "uncontrolled_raw",
    });
    expectChainedAuditEntry("uncontrolled_copy_download");
    const call = auditEntryCall()!;
    const metadata = call.values.find(
      (v): v is string => typeof v === "string" && v.startsWith("{"),
    );
    expect(JSON.parse(metadata!)).toMatchObject({
      outcome: "uncontrolled_raw",
      watermarked: false,
      served: true,
    });
  });

  // Eine verweigerte Herausgabe ist ein Ereignis, kein Nicht-Ereignis: sie
  // muss im Trail stehen und `served: false` tragen, sonst sieht eine spätere
  // Auswertung eine Lücke statt einer Ablehnung.
  it("schreibt die verweigerte Herausgabe mit served=false", async () => {
    await recordControlledCopyDownload(ctx as never, {
      ...info,
      outcome: "watermark_failed",
      failureReason: "encrypted",
    });
    expectChainedAuditEntry("controlled_copy_watermark_failed");
    const metadata = auditEntryCall()!.values.find(
      (v): v is string => typeof v === "string" && v.startsWith("{"),
    );
    expect(JSON.parse(metadata!)).toMatchObject({
      served: false,
      failureReason: "encrypted",
    });
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("OP-047 · DELETE /documents/:id/erase — Art. 17 DSGVO", () => {
  function docRow(over: Record<string, unknown> = {}) {
    return {
      id: "doc-1",
      orgId: "org-1",
      title: "Bewerbungsunterlagen",
      category: "hr",
      status: "approved",
      currentVersion: 2,
      legalHold: false,
      filePath: "org-1/doc-1/v2.pdf",
      workItemId: null,
      deletedAt: null,
      ...over,
    };
  }

  async function callErase(reason: string) {
    return ERASE(
      new Request("http://localhost/api/v1/documents/doc-1/erase", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason }),
      }),
      { params: Promise.resolve({ id: "doc-1" }) },
    );
  }

  it("schreibt den Löschvorgang VOR dem harten DELETE", async () => {
    selectQueue.push([docRow()]);
    selectQueue.push([{ filePath: "org-1/doc-1/v2.pdf" }]);

    const res = await callErase(
      "Betroffenenanfrage nach Art. 17 DSGVO, Ticket DSB-2026-114",
    );
    expect(res.status).toBe(200);
    expectChainedAuditEntry("gdpr_erasure");

    // Reihenfolge ist hier die Aussage: nach dem DELETE gibt es die Zeile
    // nicht mehr, deren Löschung begründet werden soll.
    const auditIndex = executed.findIndex((e) =>
      e.text.includes("write_audit_entry"),
    );
    const purgeIndex = executed.findIndex((e) =>
      e.text.includes("app.dms_signature_purge"),
    );
    expect(auditIndex).toBeGreaterThanOrEqual(0);
    expect(purgeIndex).toBeGreaterThan(auditIndex);
    expect(deleted).toContain("document");
  });

  it("trägt Begründung und Dateiliste in die Zeile", async () => {
    selectQueue.push([docRow()]);
    selectQueue.push([
      { filePath: "org-1/doc-1/v1.pdf" },
      { filePath: "org-1/doc-1/v2.pdf" },
    ]);

    await callErase("Loeschersuchen der betroffenen Person vom 2026-08-30");

    const metadata = auditEntryCall()!.values.find(
      (v): v is string => typeof v === "string" && v.includes("erasedFiles"),
    );
    const parsed = JSON.parse(metadata!) as {
      reason: string;
      erasedFiles: string[];
    };
    expect(parsed.reason).toBe(
      "Loeschersuchen der betroffenen Person vom 2026-08-30",
    );
    expect(parsed.erasedFiles.sort()).toEqual([
      "org-1/doc-1/v1.pdf",
      "org-1/doc-1/v2.pdf",
    ]);
    // Und die Annotation geht mit — `app.audit_reason` ist die einzige
    // Eingangsseite für die Begründung (OP-124).
    expect(auditContextCalls[0]).toMatchObject({
      actionDetail: "gdpr_erasure",
    });
  });

  // Die Gegenprobe zur Zusicherung: wo nicht gelöscht wird, darf auch keine
  // Löschung im Trail stehen. Ein Wächter, der immer schreibt, belegt nichts.
  it("schreibt NICHTS, wenn ein Legal Hold die Löschung verweigert", async () => {
    selectQueue.push([docRow({ legalHold: true })]);
    const res = await callErase("Versuch trotz laufendem Rechtsstreit");
    expect(res.status).toBe(422);
    expect(auditEntryCalls()).toEqual([]);
    expect(deleted).toEqual([]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("OP-047 · GET /documents/:id/verify-integrity", () => {
  const sha = (s: string) => createHash("sha256").update(s).digest("hex");

  function docRow(over: Record<string, unknown> = {}) {
    return {
      id: "doc-1",
      orgId: "org-1",
      title: "Verfahrensanweisung",
      fileName: "va.pdf",
      filePath: "org-1/doc-1/va.pdf",
      fileSha256: sha("inhalt"),
      deletedAt: null,
      ...over,
    };
  }

  async function callVerify() {
    return VERIFY(
      new Request(
        "http://localhost/api/v1/documents/doc-1/verify-integrity",
        {},
      ),
      { params: Promise.resolve({ id: "doc-1" }) },
    );
  }

  it("protokolliert die bestandene Prüfung", async () => {
    selectQueue.push([docRow()]);
    const res = await callVerify();
    expect(res.status).toBe(200);
    expect((await res.json()).data.valid).toBe(true);
    expectChainedAuditEntry("integrity_check_passed");
  });

  // Der Fall, für den die Route existiert. Wenn ausgerechnet die
  // fehlgeschlagene Integritätsprüfung nicht im Trail landet, ist die Route
  // ein Anzeigeinstrument ohne Beweiswert.
  it("protokolliert die FEHLGESCHLAGENE Prüfung mit beiden Hashes", async () => {
    selectQueue.push([docRow({ fileSha256: "b".repeat(64) })]);
    const res = await callVerify();
    expect((await res.json()).data.valid).toBe(false);
    expectChainedAuditEntry("integrity_check_failed");
    const metadata = auditEntryCall()!.values.find(
      (v): v is string => typeof v === "string" && v.includes("expectedSha256"),
    );
    expect(JSON.parse(metadata!)).toMatchObject({
      expectedSha256: "b".repeat(64),
      actualSha256: sha("inhalt"),
      valid: false,
      fileMissing: false,
    });
  });

  it("protokolliert die fehlende Datei als eigenen Ausgang", async () => {
    selectQueue.push([docRow()]);
    storageGet.mockRejectedValueOnce(new Error("ENOENT"));
    const res = await callVerify();
    expect((await res.json()).data.fileMissing).toBe(true);
    expectChainedAuditEntry("integrity_check_file_missing");
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("OP-047 · POST /processes/bulk — die Massenänderung", () => {
  const P1 = "11111111-1111-4111-8111-111111111111";
  const P2 = "22222222-2222-4222-8222-222222222222";

  function procRow(id: string, status = "draft") {
    return {
      id,
      status,
      processOwnerId: null,
      name: `Prozess ${id}`,
    };
  }

  async function callBulk(body: unknown) {
    return BULK(
      new Request("http://localhost/api/v1/processes/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  }

  it("schreibt genau EINEN Eintrag für die ganze Operation", async () => {
    selectQueue.push([procRow(P1), procRow(P2)]);
    const res = await callBulk({
      action: "change_department",
      processIds: [P1, P2],
      department: "Einkauf",
    });
    expect(res.status).toBe(200);
    // Die Zusicherung ist "einer", nicht "mindestens einer": eine
    // Massenoperation ist ein Vorgang mit einer Kennung, keine n Vorgänge.
    // Ein Eintrag je Zeile würde den Trail fluten und die Zusammengehörigkeit
    // verlieren.
    expect(auditEntryCalls()).toHaveLength(1);
    expectChainedAuditEntry("bulk_change_department");
  });

  it("zählt Erfolge und Fehlschläge in derselben Zeile", async () => {
    // Nur einer der beiden Prozesse existiert in dieser Organisation.
    selectQueue.push([procRow(P1)]);
    const ids = [P1, P2];
    const res = await callBulk({
      action: "delete",
      processIds: ids,
    });
    const body = (await res.json()) as {
      data: { succeeded: number; failed: number };
    };
    expect(body.data).toMatchObject({ succeeded: 1, failed: 1 });

    const metadata = auditEntryCall()!.values.find(
      (v): v is string =>
        typeof v === "string" && v.includes("bulk_operation_id"),
    );
    const parsed = JSON.parse(metadata!) as {
      succeeded: number;
      failed: number;
      processIds: string[];
      bulk_operation_id: string;
    };
    // Die Zeile muss den TATSÄCHLICHEN Ausgang tragen. Stünde dort die Zahl
    // der angeforderten statt der geänderten Zeilen, behauptete der Trail eine
    // Änderung, die nie stattgefunden hat.
    expect(parsed.succeeded).toBe(1);
    expect(parsed.failed).toBe(1);
    expect(parsed.processIds).toEqual(ids);
    expect(parsed.bulk_operation_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("schreibt auch dann, wenn KEINE Zeile geändert werden konnte", async () => {
    // Kein Prozess gefunden: die Operation ist trotzdem passiert und der
    // Versuch gehört in den Trail. Ein Trail, der nur Erfolge kennt, ist als
    // Nachweis wertlos.
    selectQueue.push([]);
    const res = await callBulk({
      action: "change_status",
      processIds: [P1],
      status: "published",
    });
    expect(res.status).toBe(200);
    expectChainedAuditEntry("bulk_change_status");
    const metadata = auditEntryCall()!.values.find(
      (v): v is string => typeof v === "string" && v.includes("succeeded"),
    );
    expect(JSON.parse(metadata!)).toMatchObject({ succeeded: 0, failed: 1 });
  });
});
