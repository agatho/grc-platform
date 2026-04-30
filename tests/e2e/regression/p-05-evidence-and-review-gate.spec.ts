import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

// E2E-P05: Evidence-Workflow — review-Übergang wird blockiert ohne ausreichende Belege.

test("E2E-P05: in_progress → review blocked when evidence count not met", async ({
  page,
}) => {
  await login(page);
  const name = `E2E-P05-${Date.now().toString().slice(-6)}`;

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

  // Charter hat keine Prereqs und benötigt 1 Evidence
  const stepsResp = await page.evaluate(async (id) => {
    const r = await fetch(`/api/v1/programmes/journeys/${id}/steps`);
    return await r.json();
  }, journeyId!);
  const steps = (stepsResp?.data ?? []) as Array<{
    id: string;
    code: string;
    requiredEvidenceCount: number;
  }>;
  const charter = steps.find((s) => s.code === "S00-CHARTER");
  test.skip(!charter, "charter step not found");

  // pending → in_progress (sollte ohne Prereqs erlaubt sein)
  const start = await page.evaluate(
    async ({ jId, sId }) => {
      const r = await fetch(
        `/api/v1/programmes/journeys/${jId}/steps/${sId}/transition`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: "in_progress" }),
        },
      );
      return { status: r.status };
    },
    { jId: journeyId, sId: charter!.id },
  );
  expect(start.status).toBe(200);

  // in_progress → review ohne Evidence sollte 422 zurückliefern
  const review = await page.evaluate(
    async ({ jId, sId }) => {
      const r = await fetch(
        `/api/v1/programmes/journeys/${jId}/steps/${sId}/transition`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: "review" }),
        },
      );
      return { status: r.status, body: await r.json().catch(() => null) };
    },
    { jId: journeyId, sId: charter!.id },
  );
  expect(review.status).toBe(422);
  expect(review.body?.error).toMatch(/Evidence requirement not met/);

  await page.evaluate(async (id) => {
    await fetch(`/api/v1/programmes/journeys/${id}`, { method: "DELETE" });
  }, journeyId!);
});
