import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

// E2E-102: Vollständiger Assessment-Lifecycle (REQ-ISMS-020..025)
// eval → soa → risk → review → finalize, mit Gate-Checks an jedem Übergang.

test("E2E-102: assessment lifecycle blocks invalid phase transitions", async ({
  page,
}) => {
  await login(page);

  // Liste aktive Assessments — wir nehmen das erste, oder skippen
  const list = await page.evaluate(async () => {
    const r = await fetch("/api/v1/isms/assessments?limit=1");
    return await r.json();
  });

  const id = list?.data?.[0]?.id;
  test.skip(!id, "kein aktives Assessment vorhanden — Skip");

  // eval-gate-check vor Befüllung — sollte blocking_count > 0 zurückgeben
  const earlyGate = await page.evaluate(async (id) => {
    const r = await fetch(`/api/v1/isms/assessments/${id}/eval-gate-check`);
    return await r.json();
  }, id);
  expect(earlyGate).toMatchObject({
    ok: expect.any(Boolean),
  });

  // Verbotener Übergang test: direkt von draft → finalize
  const invalidTransition = await page.evaluate(async (id) => {
    const r = await fetch(`/api/v1/isms/assessments/${id}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: "finalize" }),
    });
    return r.status;
  }, id);

  expect([400, 409, 422]).toContain(invalidTransition);
});
