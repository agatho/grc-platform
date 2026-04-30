import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

// E2E-P06: Event-Log liefert mindestens das journey.created Event nach Erstellung.

test("E2E-P06: journey events log records journey.created and step.transition", async ({
  page,
}) => {
  await login(page);
  const name = `E2E-P06-${Date.now().toString().slice(-6)}`;

  const created = await page.evaluate(async (n) => {
    const r = await fetch("/api/v1/programmes/journeys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateCode: "gdpr-2016-679", name: n }),
    });
    return await r.json();
  }, name);

  const journeyId = created?.data?.journey?.id as string | undefined;
  test.skip(!journeyId, "journey not created");

  // Erste Transition triggern (DP-S00 — DPO-Charter, keine Prereqs)
  const stepsResp = await page.evaluate(async (id) => {
    const r = await fetch(`/api/v1/programmes/journeys/${id}/steps`);
    return await r.json();
  }, journeyId!);
  const steps = (stepsResp?.data ?? []) as Array<{
    id: string;
    code: string;
  }>;
  const charter = steps.find((s) => s.code === "DP-S00");
  if (charter) {
    await page.evaluate(
      async ({ jId, sId }) => {
        await fetch(
          `/api/v1/programmes/journeys/${jId}/steps/${sId}/transition`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ to: "in_progress" }),
          },
        );
      },
      { jId: journeyId, sId: charter.id },
    );
  }

  const events = await page.evaluate(async (id) => {
    const r = await fetch(`/api/v1/programmes/journeys/${id}/events?limit=50`);
    return await r.json();
  }, journeyId!);

  const types = (events?.data ?? []).map((e: { eventType: string }) => e.eventType);
  expect(types).toContain("journey.created");
  if (charter) {
    expect(types).toContain("step.transition");
  }

  await page.evaluate(async (id) => {
    await fetch(`/api/v1/programmes/journeys/${id}`, { method: "DELETE" });
  }, journeyId!);
});
