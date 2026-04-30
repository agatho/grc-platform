import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

// E2E-P04: Dashboard + Next-Actions + Blockers Endpoints liefern strukturierte Daten.

test("E2E-P04: dashboard, next-actions, blockers endpoints respond correctly", async ({
  page,
}) => {
  await login(page);
  const name = `E2E-P04-${Date.now().toString().slice(-6)}`;
  const created = await page.evaluate(async (n) => {
    const r = await fetch("/api/v1/programmes/journeys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateCode: "iso22301-2019", name: n }),
    });
    return await r.json();
  }, name);

  const journeyId = created?.data?.journey?.id as string | undefined;
  test.skip(!journeyId, "journey not created");

  const dash = await page.evaluate(async (id) => {
    const r = await fetch(`/api/v1/programmes/journeys/${id}/dashboard`);
    return { status: r.status, body: await r.json() };
  }, journeyId!);
  expect(dash.status).toBe(200);
  expect(dash.body?.data?.journey?.id).toBe(journeyId);
  expect(dash.body?.data?.health).toBeDefined();
  expect(Array.isArray(dash.body?.data?.phases)).toBe(true);

  const next = await page.evaluate(async (id) => {
    const r = await fetch(
      `/api/v1/programmes/journeys/${id}/next-actions?limit=5`,
    );
    return { status: r.status, body: await r.json() };
  }, journeyId!);
  expect(next.status).toBe(200);
  expect(Array.isArray(next.body?.data)).toBe(true);

  const blockers = await page.evaluate(async (id) => {
    const r = await fetch(`/api/v1/programmes/journeys/${id}/blockers`);
    return { status: r.status, body: await r.json() };
  }, journeyId!);
  expect(blockers.status).toBe(200);
  expect(blockers.body?.data?.summary).toBeDefined();

  await page.evaluate(async (id) => {
    await fetch(`/api/v1/programmes/journeys/${id}`, { method: "DELETE" });
  }, journeyId!);
});
