// [ARCTOS-FULL-2026-08-31 · Abnahme Welle 2] Der Schrumpfer.
//
// ── Warum diese Datei existiert ──────────────────────────────────────
//
// `shrinkSequence` und die Berichtsformatierer laufen **nur, wenn ein
// Eigenschaftstest fehlschlägt**. Die Eigenschaftstests sind grün — 0 von
// 3.000 Folgen rot —, also ist dieser Code in keinem einzigen grünen Lauf
// jemals ausgeführt worden. Gemessen: 12 der 21 Funktionen in
// `src/verify/property.ts` ohne Abdeckung, darunter `shrinkSequence`,
// `simplifications`, `sameFailure`, `violationKey` und `formatFailure`.
//
// Das ist dieselbe Klasse, die dieser Audit wiederholt gefunden hat, und hier
// ist sie besonders teuer: Der Schrumpfer ist das Werkzeug, auf das sich ein
// Entwickler an genau dem Tag verlässt, an dem eine Eigenschaft zum ersten Mal
// wirklich bricht. Ist er defekt, liefert der erste echte Fehlschlag einen
// falschen oder unbrauchbaren Minimalfall — und die Suche beginnt bei einer
// Zehn-Schritt-Folge statt bei einem Schritt.
//
// ── Warum ein Doppel und nicht die echte Engine ──────────────────────
//
// `shrinkSequence` nimmt den Läufer als Parameter. Was hier geprüft wird, ist
// **die Schrumpflogik**, nicht die Engine: welche Kandidaten sie bildet, wann
// sie einen Fehlschlag als „denselben" akzeptiert, und ob sie ihren
// Versuchshaushalt einhält. Ein Doppel, das eine bekannte Bedingung als
// Fehlschlag meldet, macht genau diese Fragen beantwortbar — mit der echten
// Engine wären sie es nicht, weil dort kein Fehlschlag zum Schrumpfen da ist.

import { describe, expect, it } from "vitest";
import {
  shrinkSequence,
  type SequenceFailure,
  type SequenceResult,
} from "../../src/verify/property";
import type { Operation } from "../../src/verify/operations";

// [ARCTOS-FULL-2026-08-31 · OP-011] `kind: "index"` gibt es nicht.
// `CandidateKind` (src/verify/operations.ts) führt fünf Werte — `container`,
// `activity`, `flowNode`, `lane`, `removable` —, und keiner davon heißt so.
// Der Typprüfer hat das gemeldet, seit die Datei entstand (Welle 2, c635a97);
// `npx tsc --noEmit` war in diesem Paket dadurch dauerhaft rot, und damit war
// das Tor für jeden folgenden Fehler blind. Behoben ist der DEFEKT, nicht die
// Erwartung: `flowNode` ist die Kategorie, in der ein `move` tatsächlich
// auflöst. Am Verhalten des Tests ändert das nichts — `shrinkSequence` sieht
// die Kategorie nie an —, an seiner Aussagekraft schon.
const ref = (n: number) => ({ kind: "flowNode" as const, index: n });

const move = (n: number, dx: number, dy: number): Operation => ({
  kind: "move",
  target: ref(n),
  dx,
  dy,
});

const rename = (n: number, name: string): Operation => ({
  kind: "rename",
  target: ref(n),
  name,
});

const FEHLSCHLAG: SequenceFailure = {
  step: 0,
  phase: "step",
  violations: [
    {
      id: "di-shape-bounds",
      message: "Bounds fehlen",
      elementId: "Task_1",
    } as never,
  ],
  message: "Bounds fehlen",
};

const ok = (ops: readonly Operation[]): SequenceResult => ({
  ok: true,
  trace: ops.map((operation, index) => ({
    index,
    operation,
    outcome: "applied" as const,
    resolved: [],
  })),
});

const rot = (ops: readonly Operation[]): SequenceResult => ({
  ok: false,
  trace: ops.map((operation, index) => ({
    index,
    operation,
    outcome: "applied" as const,
    resolved: [`Task_${String(index)}`],
  })),
  failure: FEHLSCHLAG,
});

/**
 * Ein Läufer, der genau dann rot meldet, wenn die Folge eine bestimmte
 * Operation enthält. Zählt seine Aufrufe mit.
 */
function laeuferMit(bedingung: (ops: readonly Operation[]) => boolean) {
  const gesehen: Operation[][] = [];
  const run = (ops: readonly Operation[]): Promise<SequenceResult> => {
    gesehen.push([...ops]);
    return Promise.resolve(bedingung(ops) ? rot(ops) : ok(ops));
  };
  return { run, gesehen };
}

describe("shrinkSequence — der Minimalfall", () => {
  it("streicht alles, was den Fehlschlag nicht trägt", async () => {
    // Zehn Operationen, der Fehlschlag hängt allein an `rename(3, "boom")`.
    const ops: Operation[] = [
      move(0, 10, 10),
      move(1, 20, 0),
      rename(2, "irrelevant"),
      rename(3, "boom"),
      move(4, 5, 5),
      move(5, 0, 7),
      rename(6, "auch egal"),
      move(7, 1, 1),
      move(8, 2, 2),
      rename(9, "egal"),
    ];
    const { run } = laeuferMit((cand) =>
      cand.some((o) => o.kind === "rename" && o.name === "boom"),
    );

    const result = await shrinkSequence(ops, FEHLSCHLAG, run);

    expect(result.ops).toHaveLength(1);
    expect(result.ops[0]).toMatchObject({ kind: "rename", name: "boom" });
  });

  it("halbiert dabei auch den Auswahlindex, solange der Fehlschlag bleibt", async () => {
    // Gemessen beim Schreiben dieses Tests: aus `rename(#3, "boom")` wird
    // `rename(#1, "boom")`. Das ist Absicht und steht im Code begründet —
    // die Auflösung eines Index geschieht modulo der Kandidatenzahl, ein
    // kleinerer Index liest sich besser und trifft meist dasselbe Element.
    // Der Test hält es fest, weil es sonst wie ein Fehler des Schrumpfers
    // aussieht: der Bericht nennt eine andere Nummer als der Lauf.
    const ops: Operation[] = [rename(3, "boom")];
    const { run } = laeuferMit((cand) =>
      cand.some((o) => o.kind === "rename" && o.name === "boom"),
    );

    const result = await shrinkSequence(ops, FEHLSCHLAG, run);

    expect(result.ops[0]).toMatchObject({
      kind: "rename",
      name: "boom",
      target: { kind: "flowNode", index: 1 },
    });
  });

  it("vereinfacht die verbliebene Operation, ohne den Fehlschlag zu verlieren", async () => {
    // Der Fehlschlag hängt an der Operation, nicht an ihren Zahlen: dann muss
    // `move(dx, dy)` auf `move(0, 0)` zusammenfallen. Ein Bericht, der
    // `move(+137, -42)` nennt, obwohl `move(0, 0)` genügt, schickt den Leser
    // auf die Suche nach einer Bedeutung, die die Zahlen nicht haben.
    const ops: Operation[] = [move(0, 137, -42)];
    const { run } = laeuferMit((cand) =>
      cand.some((o) => o.kind === "move" && o.target.index === 0),
    );

    const result = await shrinkSequence(ops, FEHLSCHLAG, run);

    expect(result.ops).toEqual([move(0, 0, 0)]);
  });

  it("behält die Zahl, an der der Fehlschlag hängt — und nur sie", async () => {
    // Die Gegenprobe zum Test darüber: hier IST `dx` die Ursache. Der
    // Schrumpfer probiert der Reihe nach `(0,0)`, `(0,-42)` und `(137,0)`;
    // die ersten beiden verlieren den Fehlschlag, die dritte nicht. `dy`
    // fällt also weg und `dx` bleibt — genau die Trennung, die der Bericht
    // leisten soll.
    const ops: Operation[] = [move(0, 137, -42)];
    const { run } = laeuferMit((cand) =>
      cand.some((o) => o.kind === "move" && o.dx === 137),
    );

    const result = await shrinkSequence(ops, FEHLSCHLAG, run);

    expect(result.ops).toEqual([move(0, 137, 0)]);
  });

  it("kürzt einen Namen auf `a`, wenn der Name beliebig ist", async () => {
    const ops: Operation[] = [rename(0, "ein sehr langer Name")];
    const { run } = laeuferMit((cand) => cand.some((o) => o.kind === "rename"));

    const result = await shrinkSequence(ops, FEHLSCHLAG, run);

    expect(result.ops).toEqual([rename(0, "a")]);
  });
});

describe("shrinkSequence — wann ein Fehlschlag als derselbe gilt", () => {
  it("akzeptiert einen Kandidaten nur bei überlappender Invariantenkennung", async () => {
    // Sonst schrumpft der Schrumpfer auf einen ANDEREN Defekt und der Bericht
    // beschreibt eine Folge, die den gemeldeten Fehler gar nicht auslöst.
    const ops: Operation[] = [move(0, 1, 1), rename(1, "boom")];
    const andererFehlschlag: SequenceFailure = {
      ...FEHLSCHLAG,
      violations: [
        { id: "flow-endpoints", message: "x", elementId: "F_1" } as never,
      ],
    };
    // JEDER Kandidat ausser der Ausgangsfolge meldet einen ANDEREN Befund.
    // Nach Länge zu unterscheiden reichte nicht: die Vereinfachung einzelner
    // Operationen lässt die Länge gleich.
    const original = JSON.stringify(ops);
    const run = (cand: readonly Operation[]): Promise<SequenceResult> =>
      Promise.resolve(
        JSON.stringify(cand) === original
          ? rot(cand)
          : { ...rot(cand), failure: andererFehlschlag },
      );

    const result = await shrinkSequence(ops, FEHLSCHLAG, run);

    // Kein Kandidat trug denselben Befund, also bleibt die Folge ungekürzt.
    expect(result.ops).toEqual(ops);
  });

  it("nimmt die Phase als Kennung, wenn ein Fehlschlag keine Invariante trägt", async () => {
    // `violationIds` fällt dann auf `phase:<phase>` zurück. Ohne diesen
    // Rückfall wäre die Kennungsmenge leer, `sameFailure` immer falsch, und
    // ein Export-Fehlschlag liesse sich nie schrumpfen.
    const ohneInvariante: SequenceFailure = {
      step: -1,
      phase: "export",
      violations: [],
      message: "Export schlug fehl",
    };
    const ops: Operation[] = [move(0, 1, 1), move(1, 2, 2), move(2, 3, 3)];
    const run = (cand: readonly Operation[]): Promise<SequenceResult> =>
      Promise.resolve(
        cand.some((o) => o.kind === "move" && o.target.index === 2)
          ? { ...rot(cand), failure: ohneInvariante }
          : ok(cand),
      );

    const result = await shrinkSequence(ops, ohneInvariante, run);

    expect(result.ops).toHaveLength(1);
    expect(result.ops[0]).toMatchObject({ kind: "move", target: ref(2) });
  });
});

describe("shrinkSequence — die Ränder", () => {
  it("hält den Versuchshaushalt ein", async () => {
    const ops: Operation[] = Array.from({ length: 20 }, (_, i) =>
      move(i, i + 1, i + 1),
    );
    const { run, gesehen } = laeuferMit(() => true);

    const result = await shrinkSequence(ops, FEHLSCHLAG, run, 5);

    // Ein Schrumpflauf ohne Obergrenze kann bei einem teuren Läufer länger
    // dauern als der Testlauf, der ihn ausgelöst hat.
    expect(result.attempts).toBeLessThanOrEqual(5);
    // Ein abschliessender Lauf für die Auflösung der Kennungen kommt hinzu.
    expect(gesehen.length).toBeLessThanOrEqual(6);
  });

  it("gibt eine einelementige Folge unverändert zurück", async () => {
    const ops: Operation[] = [{ kind: "undo" }];
    const { run } = laeuferMit(() => true);

    const result = await shrinkSequence(ops, FEHLSCHLAG, run);

    expect(result.ops).toEqual(ops);
  });

  it("kürzt nicht auf die leere Folge, auch wenn der Läufer das zuliesse", async () => {
    // Eine leere Folge „schlägt fehl" wäre die kürzeste Antwort und die
    // nutzloseste: sie beschreibt keinen Weg zum Defekt.
    const ops: Operation[] = [move(0, 1, 1), move(1, 2, 2)];
    const { run } = laeuferMit(() => true);

    const result = await shrinkSequence(ops, FEHLSCHLAG, run);

    expect(result.ops.length).toBeGreaterThan(0);
  });

  it("liefert die Spur des geschrumpften Laufs mit, nicht die des ursprünglichen", async () => {
    // Der Bericht nennt daraus die echten Elementkennungen. Eine Spur des
    // ursprünglichen Laufs würde Elemente nennen, die in der geschrumpften
    // Folge gar nicht vorkommen.
    const ops: Operation[] = [move(0, 1, 1), rename(1, "boom"), move(2, 3, 3)];
    const { run } = laeuferMit((cand) => cand.some((o) => o.kind === "rename"));

    const result = await shrinkSequence(ops, FEHLSCHLAG, run);

    expect(result.trace).toHaveLength(result.ops.length);
    expect(result.attempts).toBeGreaterThan(0);
  });
});
