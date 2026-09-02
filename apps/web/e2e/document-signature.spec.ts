/**
 * W21-DMS-MULTISIGN-01: Multi-signer e-signature ceremony E2E.
 *
 * API-first (pattern: bpm-approval-pipeline.spec.ts):
 *   1. Create a document + upload a small test PDF (programmatic bytes)
 *   2. Create a signature request with 2 signers, sequential
 *      (order: second signer first, the creator second)
 *   3. Out-of-turn signer (admin) → 409 (sequential enforcement);
 *      403 would indicate a non-signer — both are rejections
 *   4. First signer signs (second browser context, the role account
 *      `db:seed:e2e-users` provisions) → request still pending
 *   5. Second signer signs → request completed
 *   6. GET /verify → chain + file integrity valid
 *   7. GET /certificate → application/pdf starting with %PDF
 *   8. Publish (four-eyes: transitions done by the second signer, who is
 *      neither creator nor last content editor) → GET /download returns
 *      X-Controlled-Copy: watermarked
 *
 * [E2E-TRIAGE-4 · 2026-09-02] The skip is gone, and it was hiding THREE
 * separate reasons this test could not run — only the first of which the
 * skip message named:
 *
 *   1. Tenant. The second signer was `risk.manager@arctos.dev`, which
 *      `db:seed` puts in `Meridian Holdings GmbH`, while the `request`
 *      fixture resolved to `roles[0].orgId` of the primary account —
 *      neither that org nor the demo tenant. `GET /users` never returned
 *      the address and the spec skipped itself.
 *   2. Password. The literal `arctos2026!` was removed from the seed by
 *      WP3/S02-01; `db:seed` now hashes `SEED_DEMO_PASSWORD` or a value it
 *      prints once. The login in step 4 could not have succeeded on any
 *      database seeded after that change.
 *   3. First login. That account carries `must_change_password = true`, so
 *      even with the right password the sign-in lands on the password-change
 *      page and `waitForURL(/dashboard/)` expires.
 *
 * The second signer is now `e2e-approver@arctos.local` — provisioned by
 * `npm run db:seed:e2e-users` in the SAME tenant as the primary account, with
 * a password the run already has and without the first-login gate. It holds
 * `admin`, which `PUT /documents/:id/status` requires
 * (`withAuth("admin","risk_manager","dpo","process_owner")`), so the four-eyes
 * half of the ceremony is performed by somebody who is genuinely entitled to
 * perform it and genuinely not the author.
 */
import {
  test,
  expect,
  type Browser,
  type BrowserContext,
} from "@playwright/test";
import { STORAGE_STATE, roleAccount } from "./fixtures/storage";

const SIGNER = roleAccount("approver");

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
  // [E2E-TRIAGE-3] Explicit: this helper signs a SECOND user in, so it must
  // not inherit the describe-level storage state of the first (see the note in
  // tests/e2e/regression/x-03-auditor-portal.spec.ts — `newContext()` picks up
  // the context options from `use`).
  const context = await browser.newContext({ storageState: undefined });
  const page = await context.newPage();
  await page.goto("/login");
  const emailInput = page.locator('input[type="email"]');
  const passwordInput = page.locator('input[type="password"]');
  await emailInput.waitFor({ state: "visible", timeout: 30000 });
  // [E2E-TRIAGE-4] Fill, then CHECK, then submit — same hydration guard as
  // auth.setup.ts: the selector resolves on the server-rendered markup and
  // React discards controlled-input values when it hydrates afterwards.
  for (let attempt = 1; attempt <= 3; attempt++) {
    await emailInput.fill(email);
    await passwordInput.fill(password);
    if (
      (await emailInput.inputValue()) === email &&
      (await passwordInput.inputValue()) === password
    ) {
      break;
    }
    expect(
      attempt,
      `the login form kept discarding its input for ${email}`,
    ).toBeLessThan(3);
    await page.waitForTimeout(300);
  }
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/dashboard/, { timeout: 60000 });
  await page.close();
  return context;
}

test.describe("DMS — Multi-signer signature ceremony", () => {
  test.use({ storageState: STORAGE_STATE });

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

      expect(
        SIGNER.password,
        "no password for the second signer. The ceremony needs two people; " +
          "provision them with\n" +
          "  E2E_ROLE_PASSWORD='<12+ chars>' npm run db:seed:e2e-users",
      ).toBeTruthy();

      const usersRes = await request.get("/api/v1/users?limit=100");
      expect(usersRes.ok(), await usersRes.text()).toBeTruthy();
      const users: Array<{ id: string; email: string }> = (
        await usersRes.json()
      ).data;
      const signer = users.find((u) => u.email === SIGNER.email);
      // [E2E-TRIAGE-4] A hard failure, not a skip. The second signer is
      // provisioned by a seed command in the SAME tenant as the account this
      // request runs as; if it is absent, the environment is wrong and the
      // run has to say so instead of reporting a green suite that never
      // executed its own subject.
      expect(
        signer,
        `${SIGNER.email} is not a member of the organisation this request ` +
          `resolves to. Both accounts come from the same command — run\n` +
          "  E2E_ROLE_PASSWORD='<12+ chars>' npm run db:seed:e2e-users\n" +
          `Users visible here: ${users.map((u) => u.email).join(", ")}`,
      ).toBeTruthy();
      // Without this the four assertions about four-eyes and sequential
      // signing would all be about one person signing twice.
      expect(
        signer!.id,
        "creator and second signer must be different accounts, or neither " +
          "the sequential order nor the four-eyes rule below asserts anything",
      ).not.toBe(adminId);

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

      // 2. Signature request: [second signer, creator], sequential
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

      // 4. Correct signer signs via own session
      signerContext = await loginAs(browser, SIGNER.email, SIGNER.password!);
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
      // [E2E-TRIAGE-4] The real contract, measured. This line read
      // `detailBody.request.status` — a shape `GET /signature-requests/:id`
      // has never returned: the CREATE route answers
      // `{data:{request,signatures}}`, the DETAIL route spreads the request
      // FLAT into `data` and appends `documentTitle`, `versionLabel`,
      // `versionNumber` and `signatures`. `detailBody.request` was
      // `undefined`, so the assertion could only have thrown a TypeError —
      // which the skip above it had hidden since the spec was written.
      // Assert the whole ceremony instead of one field.
      const detailBody = (await detail.json()).data as {
        id: string;
        status: string;
        signatures: Array<{
          signerUserId: string;
          signOrder: number;
          status: string;
          chainHash: string | null;
          previousChainHash: string | null;
        }>;
      };
      expect(detailBody.id).toBe(requestId);
      expect(detailBody.status).toBe("completed");
      expect(detailBody.signatures).toHaveLength(2);
      expect(detailBody.signatures.map((s) => s.status)).toEqual([
        "signed",
        "signed",
      ]);
      // Two DIFFERENT people, in the order the request defined, and the
      // second link chained onto the first — the point of the ceremony.
      expect(detailBody.signatures[0].signerUserId).toBe(signer!.id);
      expect(detailBody.signatures[1].signerUserId).toBe(adminId);
      expect(detailBody.signatures[0].signOrder).toBeLessThan(
        detailBody.signatures[1].signOrder,
      );
      expect(detailBody.signatures[0].previousChainHash).toBeNull();
      expect(detailBody.signatures[1].previousChainHash).toBe(
        detailBody.signatures[0].chainHash,
      );

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
      // must not approve/publish — the second signer performs both.
      const toReview = await request.put(
        `/api/v1/documents/${documentId}/status`,
        { data: { status: "in_review" } },
      );
      expect(toReview.ok(), await toReview.text()).toBeTruthy();

      const secondSignerRequest = signerContext.request;
      const toApproved = await secondSignerRequest.put(
        `/api/v1/documents/${documentId}/status`,
        { data: { status: "approved" } },
      );
      expect(toApproved.ok(), await toApproved.text()).toBeTruthy();

      const toPublished = await secondSignerRequest.put(
        `/api/v1/documents/${documentId}/status`,
        { data: { status: "published" } },
      );
      expect(toPublished.ok(), await toPublished.text()).toBeTruthy();

      // 9. Published PDF download carries the controlled-copy watermark
      const dl = await request.get(`/api/v1/documents/${documentId}/download`);
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
