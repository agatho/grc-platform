import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

// E2E-P02: Vollständiger Setup-Flow — Template wählen, Journey instanziieren,
// Phasen + Schritte werden in einer Transaktion erzeugt.

test("E2E-P02: create journey from ISO 27001 template instantiates phases and steps", async ({
  page,
}) => {
  await login(page);

  const name = `E2E-P02-${Date.now().toString().slice(-6)}`;

  const create = await page.evaluate(async (n) => {
    const res = await fetch("/api/v1/programmes/journeys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateCode: "iso27001-2022",
        name: n,
        description: "E2E test programme",
      }),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  }, name);

  expect(create.status).toBe(201);
  expect(create.body?.data?.journey?.id).toBeTruthy();
  expect(create.body?.data?.phaseCount).toBeGreaterThanOrEqual(5);
  expect(create.body?.data?.stepCount).toBeGreaterThanOrEqual(20);

  const journeyId = create.body.data.journey.id as string;

  // Detail liefert Phasen + Steps
  const detail = await page.evaluate(async (id) => {
    const res = await fetch(`/api/v1/programmes/journeys/${id}`);
    return await res.json();
  }, journeyId);

  expect(Array.isArray(detail?.data?.phases)).toBe(true);
  expect(detail.data.phases.length).toBeGreaterThan(0);
  expect(Array.isArray(detail?.data?.steps)).toBe(true);
  expect(detail.data.steps.length).toBeGreaterThan(0);

  // Cleanup: soft-delete
  await page.evaluate(async (id) => {
    await fetch(`/api/v1/programmes/journeys/${id}`, { method: "DELETE" });
  }, journeyId);
});
