/**
 * OP-027 — Die BPMN-Fläche, mit der Maus bedient.
 *
 * [WELLE-6C · 2026-09-07]
 *
 * Bis hierher gab es im ganzen Baum keinen einzigen E2E-Test, der die
 * Zeichenfläche des Prozesseditors ANFASST. `process-map`, `process-portal`
 * und `bpm-approval-pipeline` sprechen ausschliesslich die API an oder prüfen,
 * dass eine Seite lädt; `apps/web/e2e/**` und `tests/e2e/**` enthalten keine
 * einzige Interaktion mit `.djs-*`. Damit war die zentrale Behauptung des
 * Produkts — „ein Mensch kann hier ein Diagramm zeichnen" — unbelegt.
 *
 * Dieser Test belegt sie, und zwar auf dem Weg, den ein Mensch nimmt:
 *
 *   1. Vorrat (Palette) anklicken, Fläche anklicken → ein Element ENTSTEHT
 *   2. Startereignis anklicken → Kontextmenü → „verbinden" → Ziel anklicken
 *      → eine Kante ENTSTEHT
 *   3. „Save" anklicken → eine neue Version wird gespeichert
 *   4. Die gespeicherte Version wird über die API ZURÜCKGELESEN und muss die
 *      Aufgabe und den Sequenzfluss enthalten — mit genau den Bezeichnern,
 *      die die Fläche vergeben hat
 *
 * **Warum Schritt 4 der eigentliche Punkt ist.** Ein Test, der nur prüft, dass
 * nach dem Klick ein zusätzliches `<g class="djs-shape">` im DOM steht, prüft
 * diagram-js, nicht ARCTOS. Erst der Rückweg über
 * `GET /api/v1/processes/:id/versions` zeigt, dass die Geste durch
 * `saveXml() → POST /versions → parseBpmnXml → process_step` gelaufen ist —
 * also durch den Teil, der uns gehört. Die Zusicherungen sind entsprechend
 * gesetzt: die Bezeichner werden aus dem DOM GELESEN und im gespeicherten XML
 * WIEDERGEFUNDEN, nicht bloss auf Vorhandensein irgendeiner Aufgabe geprüft.
 *
 * **Warum als `process_owner`.** `processes/[id]/page.tsx:416` setzt
 * `canEdit = admin || process_owner`, und `readOnly = !canEdit` entscheidet in
 * `bpmn-editor.tsx`, ob überhaupt ein Modeler statt eines Viewers geladen
 * wird. Mit dem Konto aus `db:seed:e2e-users` ist das die produktive Rolle,
 * nicht ein Administrator, dem ohnehin alles offensteht.
 *
 * **Engine.** Vorgabe ist `legacy` (bpmn-js) — `feature-flags.ts` sagt es
 * ausdrücklich, und das ist, was ein Benutzer heute bekommt. Der zweite Test
 * fährt dieselbe Geste über `?engine=arctos` gegen die Eigenimplementierung,
 * damit der Umstieg (Plan §5.4) nicht ungeprüft bleibt. Beide Engines rendern
 * auf diagram-js, also gilt derselbe DOM-Vertrag: `.djs-palette`
 * `[data-action=…]`, `.djs-element[data-element-id=…]`, `.djs-context-pad`.
 */
import { test, expect, type Page, type Locator } from "@playwright/test";
import { STORAGE_STATE_OWNER } from "./fixtures/storage";

/** Mitte eines SVG-Knotens in Seitenkoordinaten. */
async function centerOf(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox();
  expect(
    box,
    "das Element hat keine Ausdehnung auf dem Bildschirm",
  ).not.toBeNull();
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
}

/**
 * Die Bezeichner aller Formen auf der Fläche, ohne die Kanten.
 * `data-element-id` vergibt diagram-js (`ElementRegistry`), beide Engines.
 */
async function shapeIds(page: Page): Promise<string[]> {
  return page.$$eval(".djs-element.djs-shape[data-element-id]", (nodes) =>
    nodes.map((n) => n.getAttribute("data-element-id") ?? ""),
  );
}

async function connectionIds(page: Page): Promise<string[]> {
  return page.$$eval(".djs-element.djs-connection[data-element-id]", (nodes) =>
    nodes.map((n) => n.getAttribute("data-element-id") ?? ""),
  );
}

/** Die aktuell ausgewählten Elemente — diagram-js setzt `.selected`. */
async function selectedIds(page: Page): Promise<string[]> {
  return page.$$eval(".djs-element.selected[data-element-id]", (nodes) =>
    nodes.map((n) => n.getAttribute("data-element-id") ?? ""),
  );
}

/**
 * Wählt eine Form durch einen Mausklick auf ihre Mitte aus.
 *
 * Warum nicht `locator.click()`: Playwrights Klickbarkeitsprüfung fragt
 * `elementFromPoint` und bekommt bei der arctos-Engine das Wurzel-
 * `<svg data-element-id="Process_1">` zurück; sie hält den Klick dann für
 * abgefangen und wartet bis zum Zeitlimit. Ein Mensch klickt trotzdem, und
 * genau das tut `page.mouse.click`.
 *
 * Warum eine Schleife: das Absetzen eines Elements verschiebt den Ausschnitt —
 * gemessen wanderte `StartEvent_1` dabei von y=602 auf y=309 —, und die
 * Verschiebung läuft nicht in demselben Bildschirmaufbau ab wie das Absetzen.
 * Deshalb wird die Koordinate VOR JEDEM Klick neu bestimmt. Drei Versuche,
 * nicht beliebig viele: eine Fläche, die nach drei gezielten Klicks nicht
 * auswählt, ist kaputt und soll das melden.
 */
async function clickShape(page: Page, elementId: string): Promise<void> {
  const shape = page.locator(`.djs-element[data-element-id="${elementId}"]`);
  for (let attempt = 1; attempt <= 3; attempt++) {
    const center = await centerOf(shape);
    await page.mouse.click(center.x, center.y);
    try {
      await expect
        .poll(async () => await selectedIds(page), { timeout: 3000 })
        .toEqual([elementId]);
      return;
    } catch {
      if (attempt === 3) break;
      await page.waitForTimeout(300);
    }
  }
  expect(
    await selectedIds(page),
    `drei Klicks auf ${elementId} haben es nicht ausgewählt — die Fläche ` +
      "nimmt keine Auswahl an",
  ).toEqual([elementId]);
}

/**
 * Legt einen leeren Prozess an und liefert seine Id. Der Prozess bekommt
 * serverseitig `EMPTY_BPMN_XML` (packages/shared/src/bpmn-parser.ts:290) —
 * ein einzelnes `StartEvent_1`. Genau das ist die Ausgangslage eines Menschen,
 * der einen neuen Prozess modellieren will.
 */
async function createProcess(
  request: { post: (u: string, o: object) => Promise<any> },
  label: string,
): Promise<string> {
  const res = await request.post("/api/v1/processes", {
    data: {
      name: `e2e-canvas-${label}-${Date.now()}`,
      description: "OP-027: Nachweis, dass die Zeichenfläche bedienbar ist.",
      level: 2,
    },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const id: string = (await res.json()).data.id;
  expect(id, "POST /api/v1/processes lieferte keine Id").toBeTruthy();
  return id;
}

/**
 * Die Geste — bis auf einen Schritt für beide Engines dieselbe.
 *
 * Der eine Unterschied ist keine Schwäche, sondern eine Entscheidung der
 * eigenen Engine: `connect` im Kontextmenü startet dort **keinen Ziehvorgang**,
 * sondern eine Betriebsart, die mit `←`/`→` durch die nach den Regeln
 * ZULÄSSIGEN Ziele blättert und mit `Enter` verbindet
 * (`packages/bpmn/src/editor/ConnectMode.ts`, Kopfkommentar: „Ein Ziehvorgang
 * lässt sich ohne Zeigegerät nicht nachbilden, und ein Editor, in dem man
 * Elemente anlegen, aber nicht verbinden kann, ist kein Editor"). Der Test
 * bedient deshalb je Engine die Geste, die die Engine anbietet — und prüft bei
 * `arctos` zusätzlich, dass ein Ziel überhaupt als zulässig markiert wird.
 *
 * Liefert die Bezeichner, die die Fläche vergeben hat, damit der Aufrufer sie
 * im gespeicherten XML wiederfinden kann.
 */
async function drawTaskAndConnect(
  page: Page,
  engine: "legacy" | "arctos",
): Promise<{ taskId: string; flowId: string }> {
  const palette = page.locator(".djs-palette");
  await expect(
    palette,
    "kein Vorrat (Palette) — der Editor ist nicht im Bearbeitungsmodus geladen",
  ).toBeVisible({ timeout: 60000 });

  const startEvent = page.locator(
    '.djs-element[data-element-id="StartEvent_1"]',
  );
  await expect(
    startEvent,
    "das Startereignis des leeren Prozesses ist nicht auf der Fläche",
  ).toBeVisible();

  const shapesBefore = await shapeIds(page);
  expect(
    shapesBefore,
    "der leere Prozess sollte mit genau einer Form beginnen",
  ).toContain("StartEvent_1");

  // ── 1. Aufgabe aus dem Vorrat setzen ────────────────────────────────────
  // diagram-js: ein Klick auf den Eintrag startet `create` mit
  // `autoActivate`, der nächste Klick auf der Fläche setzt das Element ab.
  const taskEntry = palette.locator('[data-action="create.task"]');
  await expect(
    taskEntry,
    "der Vorrat hat keinen Eintrag 'create.task'",
  ).toBeVisible();
  await taskEntry.click();

  const start = await centerOf(startEvent);
  const dropX = start.x + 220;
  const dropY = start.y;
  await page.mouse.move(dropX, dropY);
  await page.mouse.click(dropX, dropY);

  await expect
    .poll(async () => (await shapeIds(page)).length, {
      message:
        "nach Klick auf 'Aufgabe' und Klick auf die Fläche ist keine " +
        "zusätzliche Form entstanden — die Fläche nimmt keine Eingabe an",
    })
    .toBeGreaterThan(shapesBefore.length);

  const shapesAfter = await shapeIds(page);
  const newShapes = shapesAfter.filter((id) => !shapesBefore.includes(id));
  expect(
    newShapes,
    `erwartet genau eine neue Form, bekommen: ${JSON.stringify(newShapes)}`,
  ).toHaveLength(1);
  const taskId = newShapes[0]!;

  // ── 2. Verbinden über das Kontextmenü des Startereignisses ──────────────
  //
  // Drei Feinheiten, alle gemessen und nicht geraten:
  //
  //  * Geklickt wird über die MAUSKOORDINATE, nicht über `locator.click()`.
  //    Playwrights Klickbarkeitsprüfung fragt `elementFromPoint` und bekommt
  //    bei der arctos-Engine das Wurzel-`<svg data-element-id="Process_1">`
  //    zurück; sie hält den Klick dann für abgefangen und wartet bis zum
  //    Zeitlimit. Ein Mensch klickt trotzdem auf das Startereignis, und genau
  //    das tut `page.mouse.click`.
  //
  //  * Die Koordinate wird NEU BESTIMMT. Das Absetzen der Aufgabe verschiebt
  //    den Ausschnitt: gemessen wanderte `StartEvent_1` dabei von y=602 auf
  //    y=309. Eine vor dem Absetzen gemerkte Koordinate zeigt danach auf leere
  //    Fläche — der Klick hebt dann die Auswahl auf, statt sie zu setzen.
  //
  //  * Das Kontextmenü ist EIN wiederverwendeter DOM-Knoten. Direkt nach dem
  //    Absetzen der Aufgabe steht es noch an DEREN Seite; wer sofort auf
  //    `connect` klickt, verbindet die Aufgabe mit sich selbst — gemessen im
  //    ersten Lauf dieses Tests: `sourceRef="Activity_…" targetRef="Activity_…"`.
  //    Gewartet wird deshalb auf die AUSWAHL (`.djs-element.selected`), nicht
  //    auf das blosse Vorhandensein eines Menüs.
  const taskShape = page.locator(`.djs-element[data-element-id="${taskId}"]`);
  const connectionsBefore = await connectionIds(page);

  await clickShape(page, "StartEvent_1");

  const contextPad = page.locator(".djs-context-pad");
  await expect(
    contextPad,
    "das Kontextmenü erscheint nicht, wenn ein Element ausgewählt wird",
  ).toBeVisible();

  const connectEntry = contextPad.locator('[data-action="connect"]');
  await expect(
    connectEntry,
    "das Kontextmenü kennt keine Aktion 'connect'",
  ).toBeVisible();
  await connectEntry.click();

  if (engine === "legacy") {
    // bpmn-js: Ziehvorgang, den ein Klick auf das Ziel beendet.
    const taskCenter = await centerOf(taskShape);
    await page.mouse.move(taskCenter.x, taskCenter.y);
    await page.mouse.click(taskCenter.x, taskCenter.y);
  } else {
    // arctos: Zielauswahl über die Tastatur. Erst muss die Aufgabe überhaupt
    // als zulässiges Ziel angeboten werden — `ConnectMode` fragt dafür
    // `rules.allowed("connection.create", …)` je Ziel einzeln. Wird sie nicht
    // angeboten, ist das kein Bedienfehler des Tests, sondern eine Regel, die
    // eine gültige BPMN-Kante verbietet.
    const candidate = page.locator(
      `.djs-element[data-element-id="${taskId}"].arctos-connect-candidate`,
    );
    await expect(
      candidate,
      "die soeben gesetzte Aufgabe wird nicht als zulässiges Verbindungsziel " +
        "angeboten — `connection.create` lehnt Startereignis → Aufgabe ab",
    ).toHaveCount(1, { timeout: 10000 });
    await page.keyboard.press("Enter");
  }

  await expect
    .poll(async () => (await connectionIds(page)).length, {
      message:
        "nach 'verbinden' und Klick auf die Aufgabe ist keine Kante " +
        "entstanden — die Fläche verbindet nicht",
    })
    .toBeGreaterThan(connectionsBefore.length);

  const newFlows = (await connectionIds(page)).filter(
    (id) => !connectionsBefore.includes(id),
  );
  expect(newFlows, "erwartet genau eine neue Kante").toHaveLength(1);
  const flowId = newFlows[0]!;

  return { taskId, flowId };
}

/** Klickt „Save" und wartet, bis der Editor die Änderung als gesichert meldet. */
async function saveDiagram(page: Page): Promise<void> {
  const saveButton = page.getByRole("button", { name: /^(Save|Saving)/ });
  await expect(
    saveButton,
    "der Speichern-Knopf ist nicht bedienbar — `hasChanges` wurde von der " +
      "Zeichengeste nicht gesetzt (commandStack.changed → onChanged)",
  ).toBeEnabled({ timeout: 20000 });
  await saveButton.click();

  // Der Erfolgsfall ist eine Meldung; der Fehlerfall ist ebenfalls eine —
  // deshalb wird auf den Text gewartet, nicht bloss auf „irgendeine" Meldung.
  await expect(
    page.getByText("Version saved", { exact: false }),
    "keine Meldung 'Version saved' nach dem Klick auf Speichern",
  ).toBeVisible({ timeout: 30000 });
}

test.describe("OP-027 — BPMN-Zeichenfläche: setzen, verbinden, speichern", () => {
  test.use({ storageState: STORAGE_STATE_OWNER });

  test("legacy-Engine: Aufgabe setzen, mit dem Start verbinden, speichern — und im gespeicherten XML wiederfinden", async ({
    page,
    request,
  }) => {
    const processId = await createProcess(request, "legacy");

    await page.goto(`/processes/${processId}?tab=editor`);

    const { taskId, flowId } = await drawTaskAndConnect(page, "legacy");
    await saveDiagram(page);

    // ── 3. Der Rückweg: was ist tatsächlich gespeichert worden? ────────────
    const versionsRes = await request.get(
      `/api/v1/processes/${processId}/versions`,
    );
    expect(versionsRes.ok(), await versionsRes.text()).toBeTruthy();
    const versions = (await versionsRes.json()).data as Array<{
      id: string;
      versionNumber: number;
    }>;
    expect(
      versions.length,
      "der Klick auf Speichern hat keine Version angelegt",
    ).toBeGreaterThan(0);

    const latest = versions[0]!;
    const versionRes = await request.get(
      `/api/v1/processes/${processId}/versions/${latest.id}`,
    );
    expect(versionRes.ok(), await versionRes.text()).toBeTruthy();
    const xml: string = (await versionRes.json()).data.bpmnXml;

    expect(xml, "die gespeicherte Version enthält kein BPMN-XML").toBeTruthy();
    expect(
      xml,
      `die auf der Fläche erzeugte Aufgabe ${taskId} steht nicht im ` +
        "gespeicherten XML — die Geste ist nicht bis in die Datenbank gelangt",
    ).toContain(taskId);
    expect(
      xml,
      `die auf der Fläche gezogene Kante ${flowId} steht nicht im ` +
        "gespeicherten XML",
    ).toContain(flowId);
    expect(
      xml,
      "das gespeicherte XML enthält keine Aufgabe (<bpmn:task …>)",
    ).toMatch(/<bpmn:task\b/);
    // Die Kante muss VOM Startereignis ZUR neuen Aufgabe zeigen. Ein
    // Sequenzfluss mit vertauschten Enden wäre auf dem Bildschirm sichtbar
    // und im Modell falsch.
    const flowMatch = xml.match(
      new RegExp(`<bpmn:sequenceFlow[^>]*id="${flowId}"[^>]*>`),
    );
    expect(
      flowMatch,
      `kein <bpmn:sequenceFlow id="${flowId}"> im gespeicherten XML`,
    ).not.toBeNull();
    expect(flowMatch![0]).toContain('sourceRef="StartEvent_1"');
    expect(flowMatch![0]).toContain(`targetRef="${taskId}"`);

    // ── 4. Und der Teil, der aus dem XML fachliche Daten macht ─────────────
    // `POST /versions` fährt `parseBpmnXml` und legt `process_step`-Zeilen an.
    // Ohne diesen Schritt wäre das Diagramm ein Bild ohne Anschluss an RACM,
    // Kontrollen und Risiken.
    const stepsRes = await request.get(`/api/v1/processes/${processId}/steps`);
    expect(stepsRes.ok(), await stepsRes.text()).toBeTruthy();
    const steps = (await stepsRes.json()).data as Array<{
      bpmnElementId?: string | null;
    }>;
    expect(
      steps.map((s) => s.bpmnElementId),
      `die gezeichnete Aufgabe ${taskId} ist nicht als Prozessschritt ` +
        "abgeleitet worden — das Diagramm hängt fachlich in der Luft",
    ).toContain(taskId);
  });

  test("arctos-Engine: dieselbe Geste auf der Eigenimplementierung", async ({
    page,
    request,
  }) => {
    const processId = await createProcess(request, "arctos");

    // `?engine=arctos` ist der in `feature-flags.ts` vorgesehene Weg, die
    // Eigenimplementierung ohne Deploy einzuschalten (Auswertungsrang 2).
    await page.goto(`/processes/${processId}?tab=editor&engine=arctos`);

    const { taskId, flowId } = await drawTaskAndConnect(page, "arctos");
    await saveDiagram(page);

    const versionsRes = await request.get(
      `/api/v1/processes/${processId}/versions`,
    );
    expect(versionsRes.ok(), await versionsRes.text()).toBeTruthy();
    const versions = (await versionsRes.json()).data as Array<{ id: string }>;
    expect(
      versions.length,
      "der Klick auf Speichern hat keine Version angelegt",
    ).toBeGreaterThan(0);

    const versionRes = await request.get(
      `/api/v1/processes/${processId}/versions/${versions[0]!.id}`,
    );
    expect(versionRes.ok(), await versionRes.text()).toBeTruthy();
    const xml: string = (await versionRes.json()).data.bpmnXml;
    expect(xml).toContain(taskId);
    expect(xml).toContain(flowId);
  });
});
