/**
 * W21-DMS-MULTISIGN-01: Multi-signer e-signature ceremony E2E.
 *
 * API-first (pattern: bpm-approval-pipeline.spec.ts):
 *   1. Create a document + upload a small test PDF (programmatic bytes)
 *   2. Create a signature request with 2 signers, sequential
 *      (order: risk manager first, admin second)
 *   3. Out-of-turn signer (admin) → 409 (sequential enforcement);
 *      403 would indicate a non-signer — both are rejections
 *   4. First signer signs (second browser context, demo credentials
 *      from SETUP.md) → request still pending
 *   5. Second signer signs → request completed
 *   6. GET /verify → chain + file integrity valid
 *   7. GET /certificate → application/pdf starting with %PDF
 *   8. Publish (four-eyes: transitions done by the risk manager, who is
 *      neither creator nor last content editor) → GET /download returns
 *      X-Controlled-Copy: watermarked
 *
 * Requires the seeded demo user risk.manager@arctos.dev (SETUP.md) to be
 * a member of the admin's active org — otherwise the spec skips.
 */
import { test, expect, type Browser, type BrowserContext } from "@playwright/test";

const SIGNER_EMAIL = "risk.manager@arctos.dev";
const SIGNER_PASSWORD = "arctos2026!";

/** Minimal but valid single-page PDF (enough for upload + watermarking). */
function buildTestPdf(): Buffer {
  const pdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj
4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
5 0 obj << /Length 44 >> stream
BT /F1 24 Tf 72 720 Td (E2E signature) Tj ET
endstream
endobj
trailer << /Root 1 0 R >>
%%EOF`;
  return Buffer.from(pdf, "utf-8");
}

/** UI login (same flow as auth.setup.ts) for a second user context. */
async function loginAs(
  browser: Browser,
  email: string,
  password: string,
): Promise<BrowserContext> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login");
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/dashboard/, { timeout: 60000 });
  await page.close();
  return context;
}

test.describe("DMS — Multi-signer signature ceremony", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("sequential 2-signer flow: wrong turn 409 → both sign → verify + certificate + controlled copy", async ({
    request,
    browser,
  }) => {
    const title = `e2e-signature-${Date.now()}`;
    let documentId: string | null = null;
    let signerContext: BrowserContext | null = null;

    try {
      // 0. Resolve admin + second signer in the current org
      const meRes = await request.get("/api/v1/users/me");
      expect(meRes.ok()).toBeTruthy();
      const me = await meRes.json();
      const adminId: string = me?.data?.id ?? me?.user?.id ?? me?.id;
      expect(adminId).toBeTruthy();

      const usersRes = await request.get("/api/v1/users?limit=100");
      expect(usersRes.ok(), await usersRes.text()).toBeTruthy();
      const users: Array<{ id: string; email: string }> = (
        await usersRes.json()
      ).data;
      const signer = users.find((u) => u.email === SIGNER_EMAIL);
      test.skip(
        !signer,
        `Demo user ${SIGNER_EMAIL} not found in the current org — seed demo data first (SETUP.md).`,
      );

      // 1. Create document + upload test PDF
      const createRes = await request.post("/api/v1/documents", {
        data: { title, category: "policy" },
      });
      expect(createRes.ok(), await createRes.text()).toBeTruthy();
      documentId = (await createRes.json()).data.id as string;

      const uploadRes = await request.post(
        `/api/v1/documents/${documentId}/upload`,
        {
          multipart: {
            file: {
              name: "e2e-signature.pdf",
              mimeType: "application/pdf",
              buffer: buildTestPdf(),
            },
          },
        },
      );
      expect(uploadRes.status(), await uploadRes.text()).toBe(201);
      const uploaded = (await uploadRes.json()).data;
      expect(uploaded.sha256).toMatch(/^[0-9a-f]{64}$/);

      // 2. Signature request: [risk manager, admin], sequential
      const reqRes = await request.post(
        `/api/v1/documents/${documentId}/signature-requests`,
        {
          data: {
            signers: [signer!.id, adminId],
            sequential: true,
            title: `${title} ceremony`,
            message: "E2E sequential signing ceremony.",
          },
        },
      );
      expect(reqRes.status(), await reqRes.text()).toBe(201);
      const created = (await reqRes.json()).data;
      const requestId: string = created.request.id;
      expect(requestId).toBeTruthy();
      expect(created.signatures).toHaveLength(2);

      // 3. Admin (signer #2) tries to sign first → 409 sequential
      // violation. (403 would be a non-signer; both must never be 2xx.)
      const wrongTurn = await request.post(
        `/api/v1/signature-requests/${requestId}/sign`,
      );
      expect([403, 409]).toContain(wrongTurn.status());

      // 4. Correct signer (risk manager) signs via own session
      signerContext = await loginAs(browser, SIGNER_EMAIL, SIGNER_PASSWORD);
      const sign1 = await signerContext.request.post(
        `/api/v1/signature-requests/${requestId}/sign`,
      );
      expect(sign1.status(), await sign1.text()).toBe(201);
      const sign1Body = (await sign1.json()).data;
      expect(sign1Body.requestCompleted).toBe(false);
      expect(sign1Body.signature.status).toBe("signed");
      expect(sign1Body.signature.chainHash).toBeTruthy();

      // 5. Second signer (admin) signs → request completed
      const sign2 = await request.post(
        `/api/v1/signature-requests/${requestId}/sign`,
      );
      expect(sign2.status(), await sign2.text()).toBe(201);
      expect((await sign2.json()).data.requestCompleted).toBe(true);

      const detail = await request.get(
        `/api/v1/signature-requests/${requestId}`,
      );
      expect(detail.ok()).toBeTruthy();
      const detailBody = (await detail.json()).data;
      expect(detailBody.request.status).toBe("completed");

      // 6. Verify: hash chain + file integrity valid
      const verifyRes = await request.get(
        `/api/v1/signature-requests/${requestId}/verify`,
      );
      expect(verifyRes.ok(), await verifyRes.text()).toBeTruthy();
      const report = (await verifyRes.json()).data;
      expect(report.chainValid).toBe(true);
      expect(report.fileIntegrityValid).toBe(true);
      expect(report.valid).toBe(true);
      expect(report.brokenAt).toBeNull();

      // 7. Certificate is a real PDF
      const certRes = await request.get(
        `/api/v1/signature-requests/${requestId}/certificate`,
      );
      expect(certRes.ok()).toBeTruthy();
      expect(certRes.headers()["content-type"]).toContain("application/pdf");
      const certBody = await certRes.body();
      expect(certBody.subarray(0, 4).toString()).toBe("%PDF");

      // 8. Publish the document. Four-eyes: admin (creator + uploader)
      // must not approve/publish — the risk manager performs both.
      const toReview = await request.put(
        `/api/v1/documents/${documentId}/status`,
        { data: { status: "in_review" } },
      );
      expect(toReview.ok(), await toReview.text()).toBeTruthy();

      const rmRequest = signerContext.request;
      const toApproved = await rmRequest.put(
        `/api/v1/documents/${documentId}/status`,
        { data: { status: "approved" } },
      );
      expect(toApproved.ok(), await toApproved.text()).toBeTruthy();

      const toPublished = await rmRequest.put(
        `/api/v1/documents/${documentId}/status`,
        { data: { status: "published" } },
      );
      expect(toPublished.ok(), await toPublished.text()).toBeTruthy();

      // 9. Published PDF download carries the controlled-copy watermark
      const dl = await request.get(
        `/api/v1/documents/${documentId}/download`,
      );
      expect(dl.ok(), await dl.text()).toBeTruthy();
      expect(dl.headers()["x-controlled-copy"]).toBe("watermarked");
      const dlBody = await dl.body();
      expect(dlBody.subarray(0, 4).toString()).toBe("%PDF");
    } finally {
      if (signerContext) await signerContext.close().catch(() => undefined);
      // Best-effort cleanup (soft delete) — must never fail the test.
      if (documentId) {
        await request
          .delete(`/api/v1/documents/${documentId}`)
          .catch(() => undefined);
      }
    }
  });
});
