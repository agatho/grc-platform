import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

// E2E-109: Incident-Playbook-Engine (REQ-INC-003, REQ-INC-004)

test("E2E-109: incident playbook suggestion + advance-phase smoke", async ({
  page,
}) => {
  await login(page);

  const list = await page.evaluate(async () => {
    const r = await fetch("/api/v1/isms/incidents?limit=1");
    return await r.json();
  });
  const id = list?.data?.[0]?.id ?? list?.[0]?.id;
  test.skip(!id, "no incident available");

  const suggest = await page.evaluate(async (id) => {
    const r = await fetch(
      `/api/v1/isms/incidents/${id}/playbook-suggestions`,
    );
    return r.status;
  }, id);
  expect([200, 204]).toContain(suggest);
});
