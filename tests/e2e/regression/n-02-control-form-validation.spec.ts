import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

// W22-C1-02: Control-Create form validation. Mirror of n-01-risk-form
// (PR #161). Same 5 steps, applied to /api/v1/controls.

test("W22-C1-02: Control-Create UI form — required validation + happy path + persistence", async ({
  page,
}) => {
  await login(page);
  await page.goto("/controls");
  await page
    .waitForLoadState("networkidle", { timeout: 15_000 })
    .catch(() => {});

  // Step 1+2: empty submit → 422 (required fields: title, controlType)
  const emptySubmit = await page.evaluate(async () => {
    const r = await fetch("/api/v1/controls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    return { status: r.status };
  });
  expect(emptySubmit.status).toBe(422);

  // Step 3: happy-path submit
  const title = `E2E-N2-${Date.now().toString().slice(-7)}`;
  const created = await page.evaluate(async (t) => {
    const r = await fetch("/api/v1/controls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: t,
        controlType: "preventive",
      }),
    });
    return { status: r.status, body: await r.json() };
  }, title);
  expect(created.status).toBe(201);
  expect(created.body?.data?.id).toBeTruthy();
  const controlId = created.body.data.id as string;

  // Step 4: invalid enum
  const badEnum = await page.evaluate(async (t) => {
    const r = await fetch("/api/v1/controls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `${t}-bad`,
        controlType: "not_a_real_control_type",
      }),
    });
    return { status: r.status };
  }, title);
  expect(badEnum.status).toBe(422);

  // Step 4b: ein Risiko an diese Kontrolle hängen ────────────────
  //
  // [Welle 8a] Vorbereitung für Schritt 6, die Gegenrichtung zu
  // `n-01-risk-form-validation`. `POST /api/v1/controls/:id/risk-links`
  // schreibt die `risk_control`-Zeile, aus der der Reiter „RKM" der
  // Kontroll-Detailseite gespeist wird.
  const riskTitle = `${title}-RSK`;
  const risk = await page.evaluate(async (t) => {
    const r = await fetch("/api/v1/risks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: t,
        riskCategory: "operational",
        riskSource: "erm",
        inherentLikelihood: 3,
        inherentImpact: 3,
      }),
    });
    return { status: r.status, body: await r.json() };
  }, riskTitle);
  expect(risk.status).toBe(201);
  const riskId = risk.body.data.id as string;

  const linked = await page.evaluate(
    async ({ cid, rid }) => {
      const r = await fetch(`/api/v1/controls/${cid}/risk-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ riskId: rid }),
      });
      return { status: r.status, body: await r.text() };
    },
    { cid: controlId, rid: riskId },
  );
  expect(
    linked.status,
    `Risiko liess sich nicht an die Kontrolle hängen: ${linked.body}`,
  ).toBeLessThan(300);

  // [Welle 8a] Abgelehnte Schnittstellenaufrufe der Detailseite sammeln —
  // die Registrierung muss vor dem `goto` stehen.
  const rejectedCalls: string[] = [];
  page.on("response", (res) => {
    if (res.url().includes("/api/v1/") && res.status() >= 400) {
      const u = new URL(res.url());
      rejectedCalls.push(
        `${res.status()} ${res.request().method()} ${u.pathname}${u.search}`,
      );
    }
  });

  // Step 5: persistence across reload
  await page.goto(`/controls/${controlId}`);
  // [ARCTOS-FULL-2026-08-31 · Welle 8a] Hier stand
  //   await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(…)
  //   const pageText = await page.locator("body").innerText();
  //   expect(pageText).toContain(<Titel>);
  // `waitForLoadState("networkidle")` kehrt sofort zurück, wenn im Moment des
  // Aufrufs zufällig kein Abruf läuft — direkt nach `goto()` ist das der
  // Regelfall, weil die Seite ihre Daten erst nach der Hydrierung holt.
  // Danach liest `innerText()` **einmal**, und `expect(zeichenkette)`
  // wiederholt nichts. Gemessen: die Seite lieferte die Hülle vor dem ersten
  // Abruf ("A / U / Organisation / U / © 2026 ARCTOS"). Dieselbe Bauart wie
  // der Testdefekt in `navigation.spec.ts` (Welle 6c §8.2). Die Erwartung ist
  // unverändert; nur das Lesen wiederholt jetzt.
  await expect(page.locator("body")).toContainText(title, {
    timeout: 60_000,
  });

  // Step 6: der Reiter „RKM" zeigt das verknüpfte Risiko ──────────
  //
  // [Welle 8a] Die Seite holte ihre Zuordnungen mit
  // `GET /api/v1/controls/:id/rcm` — einem Endpunkt, den es nicht gibt
  // (gemessen: `404 GET /api/v1/controls/<uuid>/rcm`). `rcmRes.ok` war nie
  // wahr, der Reiter meldete auch bei vorhandener `risk_control`-Zeile
  // „Keine Risiko-Kontroll-Zuordnungen gefunden". Gegen den Stand vor dieser
  // Welle fallen die beiden folgenden Zusicherungen.
  await page.getByRole("tab", { name: "RKM" }).click();
  await expect(
    page.getByRole("link", { name: new RegExp(riskTitle) }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByText("Keine Risiko-Kontroll-Zuordnungen gefunden"),
  ).toHaveCount(0);

  // Und der Beleg dafür, warum der Reiter leer war.
  expect(
    rejectedCalls,
    "die Kontroll-Detailseite hat abgelehnte Schnittstellenaufrufe abgesetzt",
  ).toEqual([]);
});
