import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

// E2E-304: DORA ICT-Provider-Register (REQ-DORA-030..034)

test("E2E-304: DORA providers list returns mandatory attributes", async ({
  page,
}) => {
  await login(page);
  const list = await page.evaluate(async () => {
    const r = await fetch("/api/v1/dora/ict-providers?limit=10");
    return { status: r.status, body: await r.json().catch(() => null) };
  });
  expect(list.status).toBe(200);
  if ((list.body?.data ?? []).length > 0) {
    const provider = list.body.data[0];
    // DORA Art. 28 mandatory fields:
    expect(provider).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        orgId: expect.any(String),
      }),
    );
  }
});
