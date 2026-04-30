import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

// E2E-P01: Programme Templates Liste — vier Norm-Templates müssen verfügbar sein.

test("E2E-P01: programme templates list returns ISO 27001 + ISO 22301 + GDPR + ISO 42001", async ({
  page,
}) => {
  await login(page);
  const r = await page.evaluate(async () => {
    const res = await fetch("/api/v1/programmes/templates");
    return { status: res.status, body: await res.json().catch(() => null) };
  });
  expect(r.status).toBe(200);
  const codes = (r.body?.data ?? []).map((t: { code: string }) => t.code);
  expect(codes).toEqual(
    expect.arrayContaining([
      "iso27001-2022",
      "iso22301-2019",
      "gdpr-2016-679",
      "iso42001-2023",
    ]),
  );
});
