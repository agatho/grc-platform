// [ARCTOS-FULL-2026-08-31 · OP-083] Die Anmeldeabfrage auf `user`.
//
// `lookupUserByEmail` ist die Kapsel, die Migration 0455/0456 möglich gemacht
// hat: bis dahin las der Anmeldepfad `user` per E-Mail über den kontextlosen
// Basis-Pool, und damit das unter `grc_app` überhaupt etwas zurückgab, trug die
// `user`-Policy aus 0392 eine dritte Disjunktion — „oder die Verbindung trägt
// gar keinen Kontext". Der Preis war das gesamte Nutzerverzeichnis ALLER
// Mandanten auf jeder kontextlosen Verbindung.
//
// Die SQL-Funktion selbst prüfen die RLS-Suiten gegen eine echte Datenbank
// (`packages/db/tests/rls/user-table-contextless.test.ts`). Hier steht die
// Schicht darüber — und die ist sicherheitsrelevant, weil sie entscheidet, was
// aus einer Zeile wird, die nicht so aussieht wie erwartet. Eine Abbildung, die
// bei einer unerwarteten Zeile etwas Wahrheitsgemäßes liefert, ist an dieser
// Stelle ein Anmeldeloch.

import { describe, it, expect, vi, beforeEach } from "vitest";

const execute = vi.fn();

vi.mock("@grc/db", () => ({
  db: {
    get execute() {
      return execute;
    },
  },
  withUserReadContext: vi.fn(),
  user: {},
  userOrganizationRole: {},
  accessLog: {},
  ssoConfig: {},
}));

import { lookupUserByEmail } from "../src/providers";

const ROW = {
  id: "u-1",
  email: "anna@example.com",
  name: "Anna Beispiel",
  language: "en",
  password_hash: "$2b$12$abcdefghijklmnopqrstuv",
  is_active: true,
  must_change_password: false,
};

beforeEach(() => execute.mockReset());

describe("lookupUserByEmail — beide Ergebnisformen des Treibers", () => {
  it("liest ein nacktes Array", async () => {
    execute.mockResolvedValueOnce([ROW]);
    await expect(lookupUserByEmail("anna@example.com")).resolves.toMatchObject({
      id: "u-1",
      email: "anna@example.com",
    });
  });

  it("liest ein `{ rows: [...] }`", async () => {
    execute.mockResolvedValueOnce({ rows: [ROW] });
    await expect(lookupUserByEmail("anna@example.com")).resolves.toMatchObject({
      id: "u-1",
    });
  });

  it("gibt `null` zurück, wenn die Funktion keine Zeile liefert", async () => {
    execute.mockResolvedValueOnce([]);
    await expect(
      lookupUserByEmail("gibtsnicht@example.com"),
    ).resolves.toBeNull();
  });

  it("gibt `null` zurück, wenn das Ergebnis weder Array noch `rows` ist", async () => {
    execute.mockResolvedValueOnce({});
    await expect(lookupUserByEmail("anna@example.com")).resolves.toBeNull();
  });
});

describe("lookupUserByEmail — die Abbildung, auf die sich der Anmeldepfad verlässt", () => {
  it("reicht genau die Anmeldefelder durch", async () => {
    execute.mockResolvedValueOnce([ROW]);
    await expect(lookupUserByEmail("anna@example.com")).resolves.toEqual({
      id: "u-1",
      email: "anna@example.com",
      name: "Anna Beispiel",
      language: "en",
      passwordHash: "$2b$12$abcdefghijklmnopqrstuv",
      isActive: true,
      mustChangePassword: false,
    });
  });

  it("meldet `isActive` nur bei echtem `true`", async () => {
    // Der Treiber kann Booleans als Zeichenketten liefern; `"f"` ist in
    // JavaScript truthy. Ein `!!row.is_active` hätte hier ein DEAKTIVIERTES
    // Konto als aktiv gemeldet — und `credentialsProvider` lässt genau darauf
    // die Anmeldung zu.
    execute.mockResolvedValueOnce([{ ...ROW, is_active: "f" }]);
    await expect(lookupUserByEmail("anna@example.com")).resolves.toMatchObject({
      isActive: false,
    });
  });

  it("meldet `mustChangePassword` nur bei echtem `true`", async () => {
    // Andere Richtung, gleicher Grund: ein `"f"`, das als `true` durchginge,
    // sperrte einen gültigen Anmelder in den Passwortwechsel.
    execute.mockResolvedValueOnce([{ ...ROW, must_change_password: "f" }]);
    await expect(lookupUserByEmail("anna@example.com")).resolves.toMatchObject({
      mustChangePassword: false,
    });
  });

  it('macht aus einem fehlenden Passwort-Hash `null`, nicht `"undefined"`', async () => {
    // `found?.passwordHash` ist im Anmeldepfad die Weiche zum Timing-Ausgleich.
    // Ein Hash, der die Zeichenkette "undefined" wäre, ginge in `compare()` —
    // ein Vergleich gegen einen ungültigen Hash statt eines bewussten
    // Fehlschlags.
    execute.mockResolvedValueOnce([{ ...ROW, password_hash: null }]);
    const row = await lookupUserByEmail("anna@example.com");
    expect(row?.passwordHash).toBeNull();

    execute.mockResolvedValueOnce([
      { id: "u-2", email: "b@example.com", is_active: true },
    ]);
    const sparse = await lookupUserByEmail("b@example.com");
    expect(sparse?.passwordHash).toBeNull();
  });

  it('setzt Vorgaben für Name und Sprache, statt `"null"` anzuzeigen', async () => {
    execute.mockResolvedValueOnce([{ ...ROW, name: null, language: null }]);
    await expect(lookupUserByEmail("anna@example.com")).resolves.toMatchObject({
      name: "",
      language: "de",
    });
  });

  it("gibt genau eine Zeile zurück, auch wenn die Funktion mehrere lieferte", async () => {
    // Die SQL-Funktion ist auf eine Zeile begrenzt. Sollte sie das je nicht
    // mehr sein, darf die Anmeldung nicht die zweite Identität nehmen.
    execute.mockResolvedValueOnce([ROW, { ...ROW, id: "u-999" }]);
    await expect(lookupUserByEmail("anna@example.com")).resolves.toMatchObject({
      id: "u-1",
    });
  });
});

describe("lookupUserByEmail — die Abfrage selbst", () => {
  it("ruft die gekapselte Funktion und nicht die Tabelle", async () => {
    execute.mockResolvedValueOnce([ROW]);
    await lookupUserByEmail("anna@example.com");
    expect(execute).toHaveBeenCalledTimes(1);
    // Der SQL-Wrapper von drizzle traegt die Fragmente in `queryChunks`;
    // geprueft wird, dass der Funktionsname darin vorkommt und keine nackte
    // `FROM "user"`-Abfrage.
    const text = JSON.stringify(execute.mock.calls[0]![0]);
    expect(text).toContain("auth_lookup_user_by_email");
  });

  it("reicht die Adresse als Parameter, nicht als eingebauten Text", async () => {
    execute.mockResolvedValueOnce([]);
    const boshaft = 'a\'; DROP TABLE "user"; --';
    await lookupUserByEmail(boshaft);

    // drizzle setzt die Abfrage aus `queryChunks` zusammen: `StringChunk`s
    // sind SQL-TEXT, alles andere sind eingesetzte Werte, die der Dialekt
    // später bindet. Der Nachweis, auf den es ankommt, ist deshalb nicht
    // „irgendwo steht der Wert", sondern: der SQL-Text ist unverändert und
    // enthält von der Eingabe kein Zeichen.
    const chunks = (execute.mock.calls[0]![0] as { queryChunks: unknown[] })
      .queryChunks;
    const sqlText = chunks
      .filter(
        (c): c is { value: string[] } =>
          typeof c === "object" &&
          c !== null &&
          Array.isArray((c as { value?: unknown }).value),
      )
      .flatMap((c) => c.value)
      .join("");
    const werte = chunks.filter((c) => typeof c === "string");

    expect(sqlText).toBe("SELECT * FROM public.auth_lookup_user_by_email()");
    expect(sqlText).not.toContain("DROP TABLE");
    expect(werte).toEqual([boshaft]);
  });
});
