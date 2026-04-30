import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

// E2E-P03: Schritt-Transition wird blockiert, wenn Prerequisites nicht erfüllt sind.

test("E2E-P03: step pending → in_progress is blocked when prereqs unmet", async ({
  page,
}) => {
  await login(page);
  const name = `E2E-P03-${Date.now().toString().slice(-6)}`;
  const created = await page.evaluate(async (n) => {
    const r = await fetch("/api/v1/programmes/journeys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateCode: "iso27001-2022", name: n }),
    });
    return await r.json();
  }, name);

  const journeyId = created?.data?.journey?.id as string | undefined;
  test.skip(!journeyId, "journey not created");

  // Hole alle Schritte und finde einen, der Prerequisites hat (z.B. Y1-M3-05 / SoA-Entwurf)
  const stepsResp = await page.evaluate(async (id) => {
    const r = await fetch(`/api/v1/programmes/journeys/${id}/steps`);
    return await r.json();
  }, journeyId!);

  const steps = (stepsResp?.data ?? []) as Array<{
    id: string;
    code: string;
    status: string;
  }>;
  const dependent = steps.find((s) => s.code === "Y1-M3-05");
  test.skip(!dependent, "dependent step not found");

  // Versuche, den Schritt direkt zu starten (Prereqs nicht erfüllt → 422 erwartet)
  const transit = await page.evaluate(
    async ({ jId, sId }) => {
      const r = await fetch(
        `/api/v1/programmes/journeys/${jId}/steps/${sId}/transition`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: "in_progress" }),
        },
      );
      return { status: r.status, body: await r.json().catch(() => null) };
    },
    { jId: journeyId, sId: dependent!.id },
  );

  expect(transit.status).toBe(422);
  expect(transit.body?.error).toMatch(/Prerequisites not met|Invalid transition/);

  // Cleanup
  await page.evaluate(async (id) => {
    await fetch(`/api/v1/programmes/journeys/${id}`, { method: "DELETE" });
  }, journeyId!);
});
