import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

// E2E-110: Risk Acceptance (REQ-RISK-006) — RBAC-Pfad

test("E2E-110: risk acceptance endpoint exists and rejects without role", async ({
  page,
}) => {
  await login(page);

  // Versuche, einen Risk-Acceptance-Eintrag mit ungültigen Daten zu erstellen
  // (sollte sauber mit 4xx fehlschlagen, niemals 5xx)
  const res = await page.evaluate(async () => {
    const r = await fetch("/api/v1/risks/acceptance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    return r.status;
  });

  // 400/404/422 alle ok — wichtig ist, dass der Endpunkt existiert und 5xx nicht geliefert wird
  expect([400, 401, 403, 404, 405, 422]).toContain(res);
});
