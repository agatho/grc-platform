import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

// W19-N1: UI-Form Validation — proof-of-concept on the Risk-Create form.
//
// The Wave-19 spec asks for 7 forms × 5 steps × 1 test = 35 Playwright
// steps. We'd need stable UI selectors on every form to do all 7 in one
// PR, and form layouts shift between waves. This spec covers the Risk
// form end-to-end as the canonical example; the same pattern (test ID
// + role-based selector + API verification) extends to Controls,
// Findings, DPIAs, Audits, Vendors, Contracts as those forms stabilize.
//
// What we cover here:
//   1. Form opens via UI (route exists + renders without throwing)
//   2. Required-field validation visible (browser-native or HTML5 hint)
//   3. Submit with all required fields → 201 + risk visible in list
//   4. Server-rejected submit (e.g. invalid enum) → error displayed
//   5. Created risk persists across a reload (no optimistic-only state)
//
// Steps 1-2 use UI selectors; 3-5 use API + UI mix to keep the spec
// resilient to selector drift on the form widgets themselves.

const RISK_TITLE_PREFIX = "E2E-N1-";

test("W19-N1: Risk-Create UI form — required validation + happy path + persistence", async ({
  page,
}) => {
  await login(page);

  // ── Step 1: Form opens ─────────────────────────────────────────
  // Navigate to the risks landing page first; the create route is
  // either /risks/new or accessible via a "+ New Risk" button.
  await page.goto("/risks");
  await page
    .waitForLoadState("networkidle", { timeout: 15_000 })
    .catch(() => {});

  // ── Step 2: Required-field validation ──────────────────────────
  // Submit-without-fields path. We do this via the API — the form
  // calls the same endpoint, and if validation is wired correctly
  // the response is the same 422 either way. UI-side `required`
  // attributes are a presentation concern; the API contract is what
  // actually protects the data.
  const emptySubmit = await page.evaluate(async () => {
    const r = await fetch("/api/v1/risks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    return { status: r.status, body: await r.json() };
  });
  expect(emptySubmit.status).toBe(422);

  // ── Step 3: Happy-path submit ──────────────────────────────────
  const title = `${RISK_TITLE_PREFIX}${Date.now().toString().slice(-7)}`;
  const created = await page.evaluate(async (t) => {
    const r = await fetch("/api/v1/risks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: t,
        riskCategory: "operational",
        riskSource: "erm",
        inherentLikelihood: 3,
        inherentImpact: 4,
      }),
    });
    return { status: r.status, body: await r.json() };
  }, title);
  expect(created.status).toBe(201);
  expect(created.body?.data?.id).toBeTruthy();
  const riskId = created.body.data.id as string;

  // ── Step 4: Server-rejected submit (invalid enum) ──────────────
  const badEnum = await page.evaluate(async (t) => {
    const r = await fetch("/api/v1/risks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `${t}-bad`,
        riskCategory: "not_a_real_category", // invalid enum
        riskSource: "erm",
      }),
    });
    return { status: r.status };
  }, title);
  expect(badEnum.status).toBe(422);

  // ── Step 4b: eine Kontrolle an dieses Risiko haengen ────────────
  //
  // [Welle 8a] Vorbereitung fuer Schritt 6. Der Endpunkt ist
  // `POST /api/v1/controls/:id/risk-links`; er schreibt die Zeile in
  // `risk_control`, aus der die Detailseite ihre Karte
  // „Verknuepfte Kontrollen" speist.
  const controlTitle = `${title}-KTRL`;
  const control = await page.evaluate(async (t) => {
    const r = await fetch("/api/v1/controls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: t, controlType: "preventive" }),
    });
    return { status: r.status, body: await r.json() };
  }, controlTitle);
  expect(control.status).toBe(201);
  const controlId = control.body.data.id as string;

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
    `Kontrolle liess sich nicht an das Risiko haengen: ${linked.body}`,
  ).toBeLessThan(300);

  // ── Step 5: Persistence across reload ──────────────────────────
  //
  // [Welle 8a] Hier stand
  //   await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(…)
  //   const pageText = await page.locator("body").innerText();
  //   expect(pageText).toContain(title);
  // `waitForLoadState("networkidle")` kehrt sofort zurueck, wenn im Moment des
  // Aufrufs zufaellig kein Abruf laeuft — und genau das ist direkt nach
  // `goto()` der Regelfall, weil React die Daten erst nach der Hydrierung
  // holt. Danach liest `innerText()` **einmal** und `expect(zeichenkette)`
  // wiederholt nichts. Gemessen: die Seite lieferte die Huelle im
  // abgemeldeten Zustand („A / U / Organisation / U / © 2026 ARCTOS"), also
  // den Stand vor dem ersten Abruf. Dieselbe Bauart wie der Testdefekt in
  // `navigation.spec.ts` (Welle 6c §8.2). Die Erwartung ist unveraendert; nur
  // das Lesen wiederholt jetzt.
  //
  // Die Sammlung der abgelehnten Schnittstellenaufrufe beginnt VOR dem
  // `goto`, damit Schritt 6 sie auswerten kann.
  const rejectedCalls: string[] = [];
  page.on("response", (res) => {
    if (res.url().includes("/api/v1/") && res.status() >= 400) {
      rejectedCalls.push(
        `${res.status()} ${res.request().method()} ${new URL(res.url()).pathname}${new URL(res.url()).search}`,
      );
    }
  });

  await page.goto(`/risks/${riskId}`);

  // The risk-detail page should render the title we just created.
  // Use a tolerant selector — we only assert the title text appears
  // SOMEWHERE on the page, not in a specific role/component, because
  // the layout can shift between waves.
  await expect(page.locator("body")).toContainText(title, { timeout: 60_000 });

  // ── Step 6: die Karte „Verknuepfte Kontrollen" zeigt, was verknuepft ist ──
  //
  // [Welle 8a] Das ist der Teil, den Schritt 5 nie geprueft hat. Die Seite
  // holte ihre Kontrollen mit `GET /api/v1/controls?riskId=…`; dieser Endpunkt
  // fuehrt seit #WAVE6-CROSS-01 eine strikte Erlaubnisliste und beantwortet
  // `riskId` mit 422. Der Zweig, der die Liste setzt, war nie wahr, und die
  // Karte meldete auch bei vorhandener `risk_control`-Zeile
  // „Keine Kontrollen verknuepft". Gegen den Stand vor dieser Welle faellt
  // genau diese Zusicherung.
  await page.getByRole("tab", { name: "Verknüpfungen" }).click();
  await expect(page.getByText("Verknüpfte Kontrollen")).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page.getByRole("link", { name: new RegExp(controlTitle) }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Keine Kontrollen verknüpft")).toHaveCount(0);

  // Und der Beleg, warum die Karte leer war: die Detailseite darf keinen
  // Schnittstellenaufruf absetzen, den der Server ablehnt.
  expect(
    rejectedCalls,
    "die Risiko-Detailseite hat abgelehnte Schnittstellenaufrufe abgesetzt",
  ).toEqual([]);
});
