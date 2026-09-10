// [ARCTOS-FULL-2026-08-31 · OP-066] Die Auflösung anonymer Zugangstoken,
// geprüft.
//
// `src/anonymous-token.ts` kam mit WP3 hinzu (Befund S02-05) und hatte **keinen
// einzigen Test** — elf Funktionen, null davon abgedeckt. Das ist der Grund,
// aus dem die Funktions-Coverage von `packages/auth` von 62,50 % auf 59,09 %
// gefallen ist; im Aggregat ging es unter, weil dort gleichzeitig
// `packages/bpmn` mit 89 % dazukam. Genau dafür steht die **relative** Ratsche
// neben den absoluten Böden.
//
// Was diese Datei prüft, ist nicht die SQL-Funktion — die liegt in Migration
// 0412 und wird von den RLS-Suiten gegen eine echte Datenbank geprüft. Hier
// steht die Schicht darüber: die Abbildung der Zeile auf das Ergebnisobjekt,
// und vor allem **das Verhalten im Fehlerfall**. Jede dieser Funktionen
// entscheidet, ob ein anonymer Aufrufer hereinkommt. Eine, die bei einer
// unerwarteten Zeile etwas Wahrheitsgemäßes zurückgibt statt `null`, ist ein
// Authentifizierungsloch.

import { describe, it, expect, vi, beforeEach } from "vitest";

const execute = vi.fn();
const withOrgReadContext = vi.fn();

vi.mock("@grc/db", () => ({
  db: {
    get execute() {
      return execute;
    },
  },
  get withOrgReadContext() {
    return withOrgReadContext;
  },
}));

import {
  hashOpaqueToken,
  resolveInvitationToken,
  resolveScimTokenHash,
  touchScimToken,
  resolveDdSessionTokenHash,
  resolveWbMailboxToken,
  resolveOrgByCode,
  resolveIcalTokenHash,
  consumeSamlAssertionId,
  withAnonymousTokenContext,
} from "../src/anonymous-token";

/** `db.execute` liefert je nach Treiber ein Array oder `{ rows }`. */
const rows = (r: unknown[]) => execute.mockResolvedValueOnce(r);
const wrapped = (r: unknown[]) => execute.mockResolvedValueOnce({ rows: r });

beforeEach(() => {
  execute.mockReset();
  withOrgReadContext.mockReset();
});

describe("hashOpaqueToken", () => {
  it("ist SHA-256 in Hex und damit 64 Zeichen lang", () => {
    expect(hashOpaqueToken("scim_abc")).toMatch(/^[a-f0-9]{64}$/);
  });

  it("ist deterministisch und unterscheidet verschiedene Token", () => {
    expect(hashOpaqueToken("a")).toBe(hashOpaqueToken("a"));
    expect(hashOpaqueToken("a")).not.toBe(hashOpaqueToken("b"));
  });
});

describe("callResolver — beide Ergebnisformen des Treibers", () => {
  it("liest ein nacktes Array", async () => {
    rows([{ id: "i1", org_id: "o1" }]);
    await expect(resolveDdSessionTokenHash("h")).resolves.toEqual({
      id: "i1",
      orgId: "o1",
    });
  });

  it("liest ein `{ rows: [...] }`", async () => {
    wrapped([{ id: "i2", org_id: "o2" }]);
    await expect(resolveDdSessionTokenHash("h")).resolves.toEqual({
      id: "i2",
      orgId: "o2",
    });
  });

  it("gibt `null` zurück, wenn die Funktion keine Zeile liefert", async () => {
    rows([]);
    await expect(resolveDdSessionTokenHash("h")).resolves.toBeNull();
  });

  it("gibt `null` zurück, wenn das Ergebnis weder Array noch `rows` ist", async () => {
    execute.mockResolvedValueOnce({});
    await expect(resolveDdSessionTokenHash("h")).resolves.toBeNull();
  });
});

describe("resolveInvitationToken", () => {
  const row = {
    id: "inv-1",
    org_id: "org-1",
    email: "neu@example.com",
    role: "auditor",
    line_of_defense: "second",
    status: "pending",
    expires_at: "2026-12-31T00:00:00.000Z",
    invited_by: "user-1",
  };

  it("bildet die Zeile vollständig ab", async () => {
    rows([row]);
    await expect(resolveInvitationToken("t")).resolves.toEqual({
      id: "inv-1",
      orgId: "org-1",
      email: "neu@example.com",
      role: "auditor",
      lineOfDefense: "second",
      status: "pending",
      expiresAt: new Date("2026-12-31T00:00:00.000Z"),
      invitedBy: "user-1",
    });
  });

  it("verweigert eine Rolle, die die TS-Union nicht kennt — fail closed", async () => {
    // Der DB-Enum und die Union werden von Migration 0410 in Gleichschritt
    // gehalten (S02-14). Driftet einer, darf keine unbekannte Rolle vergeben
    // werden — auch nicht als Zeichenkette durchgereicht.
    rows([{ ...row, role: "superadmin" }]);
    await expect(resolveInvitationToken("t")).resolves.toBeNull();
  });

  it("macht aus fehlender Verteidigungslinie und fehlendem Einlader `null`", async () => {
    rows([{ ...row, line_of_defense: null, invited_by: null }]);
    const result = await resolveInvitationToken("t");
    expect(result?.lineOfDefense).toBeNull();
    expect(result?.invitedBy).toBeNull();
  });

  it("gibt `null` zurück, wenn der Token nicht auflöst", async () => {
    rows([]);
    await expect(resolveInvitationToken("unbekannt")).resolves.toBeNull();
  });
});

describe("resolveScimTokenHash", () => {
  it("meldet `isActive` nur bei echtem `true`, nicht bei etwas Wahrheitsgemäßem", async () => {
    rows([{ id: "s1", org_id: "o1", is_active: "t" }]);
    const result = await resolveScimTokenHash("h");
    // `"t"` ist in JavaScript truthy. Ein `!!row.is_active` hätte hier einen
    // deaktivierten Token als aktiv gemeldet, sobald der Treiber Booleans als
    // Zeichenketten liefert.
    expect(result?.isActive).toBe(false);
  });

  it("bildet Ablauf und Widerruf als Datum ab, wenn gesetzt", async () => {
    rows([
      {
        id: "s1",
        org_id: "o1",
        is_active: true,
        expires_at: "2027-01-01T00:00:00.000Z",
        revoked_at: "2026-06-01T00:00:00.000Z",
      },
    ]);
    const result = await resolveScimTokenHash("h");
    expect(result?.expiresAt).toEqual(new Date("2027-01-01T00:00:00.000Z"));
    expect(result?.revokedAt).toEqual(new Date("2026-06-01T00:00:00.000Z"));
  });

  it("lässt Ablauf und Widerruf `null`, wenn sie fehlen", async () => {
    rows([{ id: "s1", org_id: "o1", is_active: true }]);
    const result = await resolveScimTokenHash("h");
    expect(result?.expiresAt).toBeNull();
    expect(result?.revokedAt).toBeNull();
  });

  it("gibt `null` zurück, wenn der Hash nicht auflöst", async () => {
    rows([]);
    await expect(resolveScimTokenHash("h")).resolves.toBeNull();
  });
});

describe("touchScimToken", () => {
  it("aktualisiert den Zeitstempel", async () => {
    execute.mockResolvedValueOnce([]);
    await touchScimToken("s1");
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("wirft nicht, wenn der Zeitstempel scheitert — S02-15", async () => {
    // Ein fehlgeschlagenes `last_used_at` brach die Authentifizierung NACH
    // erfolgreicher Tokenprüfung mit 500 ab. Der Zeitstempel ist Buchführung,
    // kein Auth-Schritt.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    execute.mockRejectedValueOnce(new Error("db down"));
    await expect(touchScimToken("s1")).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("verträgt auch einen geworfenen Nicht-Error", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    execute.mockRejectedValueOnce("kaputt");
    await expect(touchScimToken("s1")).resolves.toBeUndefined();
    warn.mockRestore();
  });
});

describe("resolveWbMailboxToken", () => {
  it("bildet Postfach, Meldung und Organisation ab", async () => {
    rows([
      {
        id: "mb-1",
        report_id: "rep-1",
        org_id: "org-9",
        expires_at: "2026-10-01T00:00:00.000Z",
      },
    ]);
    await expect(resolveWbMailboxToken("t")).resolves.toEqual({
      id: "mb-1",
      reportId: "rep-1",
      orgId: "org-9",
      expiresAt: new Date("2026-10-01T00:00:00.000Z"),
    });
  });

  it("gibt `null` zurück statt eines leeren Postfachs", async () => {
    rows([]);
    await expect(resolveWbMailboxToken("t")).resolves.toBeNull();
  });
});

describe("resolveOrgByCode", () => {
  it("bildet die Organisation ab und macht aus fehlendem Kurznamen `null`", async () => {
    rows([{ id: "o1", name: "Meridian Holdings", short_name: null }]);
    await expect(resolveOrgByCode("MERIDIAN")).resolves.toEqual({
      id: "o1",
      name: "Meridian Holdings",
      shortName: null,
    });
  });

  it("gibt `null` für einen unbekannten Code zurück", async () => {
    rows([]);
    await expect(resolveOrgByCode("GIBTESNICHT")).resolves.toBeNull();
  });
});

describe("resolveIcalTokenHash", () => {
  it("bildet Nutzer und Organisation ab", async () => {
    rows([{ user_id: "u1", org_id: "o1" }]);
    await expect(resolveIcalTokenHash("h")).resolves.toEqual({
      userId: "u1",
      orgId: "o1",
    });
  });

  it("gibt `null` zurück, wenn der Feed-Token nicht auflöst", async () => {
    rows([]);
    await expect(resolveIcalTokenHash("h")).resolves.toBeNull();
  });
});

describe("consumeSamlAssertionId — Replay-Schutz S02-23", () => {
  const expires = new Date("2026-09-03T00:00:00.000Z");

  it("meldet `true` für eine neue Assertion-ID", async () => {
    rows([{ fresh: true }]);
    await expect(
      consumeSamlAssertionId("id-1", "org-1", expires),
    ).resolves.toBe(true);
  });

  it("meldet `false` für einen Replay", async () => {
    rows([{ fresh: false }]);
    await expect(
      consumeSamlAssertionId("id-1", "org-1", expires),
    ).resolves.toBe(false);
  });

  it("meldet `false`, wenn gar keine Zeile kommt — fail closed", async () => {
    rows([]);
    await expect(
      consumeSamlAssertionId("id-1", "org-1", expires),
    ).resolves.toBe(false);
  });

  it("meldet `false` bei etwas Wahrheitsgemäßem, das nicht `true` ist", async () => {
    // Der Anmeldevorgang darf nicht davon abhängen, wie der Treiber Booleans
    // serialisiert. `"f"` ist truthy — ein `!!row.fresh` hätte hier einen
    // Replay durchgelassen.
    rows([{ fresh: "f" }]);
    await expect(
      consumeSamlAssertionId("id-1", "org-1", expires),
    ).resolves.toBe(false);
  });
});

describe("withAnonymousTokenContext", () => {
  it("reicht Organisation, Rumpf und Optionen an `withOrgReadContext` durch", async () => {
    withOrgReadContext.mockImplementation(
      async (_org: string, fn: (db: unknown) => Promise<unknown>) =>
        fn("scoped-db"),
    );
    const body = vi.fn(async (scoped: unknown) => `sah ${String(scoped)}`);

    const result = await withAnonymousTokenContext("org-1", body, {
      userId: "u1",
    });

    expect(result).toBe("sah scoped-db");
    expect(withOrgReadContext).toHaveBeenCalledWith("org-1", body, {
      userId: "u1",
    });
  });

  it("reicht einen Fehler des Rumpfs durch, statt ihn zu verschlucken", async () => {
    withOrgReadContext.mockRejectedValueOnce(new Error("RLS: no rows"));
    await expect(
      withAnonymousTokenContext("org-1", async () => "nie"),
    ).rejects.toThrow("RLS: no rows");
  });
});
