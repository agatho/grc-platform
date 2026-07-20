/**
 * Management-Review-Cockpit (ISO 27001 9.3, Migration 0369): lifecycle,
 * dashboard aggregation, items with decisions + actions, read-only
 * enforcement after completion, PDF export.
 *
 * API-first (pattern: bpm-approval-pipeline.spec.ts):
 *   1. Create a review (planned)
 *   2. GET /dashboard returns the 9.3.2 input aggregation shape
 *   3. planned → in_progress (server-side transition guard)
 *   4. Item with decision + action → creates a work_item
 *      (typeKey management_review_action, elementId assigned)
 *   5. in_progress → completed (completedAt set)
 *   6. Item mutation on the completed review → 422 read-only
 *   7. GET /export/pdf → application/pdf starting with %PDF
 *
 * Reviews have no DELETE route and completed reviews are terminal —
 * unique timestamped titles keep runs independent.
 */
import { test, expect } from "@playwright/test";

const PDF_MAGIC = "%PDF";

test.describe("ISMS — Management review cockpit", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("lifecycle: create → dashboard → item with action → complete → read-only → PDF", async ({
    request,
  }) => {
    const title = `e2e-mgmt-review-${Date.now()}`;
    const today = new Date().toISOString().slice(0, 10);

    // 1. Create review
    const createRes = await request.post("/api/v1/isms/reviews", {
      data: {
        title,
        description: "E2E management review lifecycle test.",
        reviewDate: today,
      },
    });
    expect(createRes.status(), await createRes.text()).toBe(201);
    const review = (await createRes.json()).data;
    const reviewId: string = review.id;
    expect(reviewId).toBeTruthy();
    expect(review.status).toBe("planned");

    // 2. Dashboard: 9.3.2 input aggregation shape
    const dashRes = await request.get(
      `/api/v1/isms/reviews/${reviewId}/dashboard`,
    );
    expect(dashRes.ok(), await dashRes.text()).toBeTruthy();
    const dash = (await dashRes.json()).data;
    expect(dash.review.id).toBe(reviewId);
    expect(dash.period.from).toBeTruthy();
    expect(dash.period.to).toBeTruthy();
    // All 9.3.2 (a–f) input blocks + cockpit data sources present
    for (const key of [
      "previousActions",
      "risks",
      "findings",
      "audits",
      "controlEffectiveness",
      "incidents",
      "documents",
      "kpis",
    ]) {
      expect(dash[key], `dashboard block '${key}' missing`).toBeDefined();
    }
    expect(dash.risks.byStatus).toBeDefined();
    expect(typeof dash.findings.open).toBe("number");

    // 3. planned → in_progress (guarded transition)
    const start = await request.put(`/api/v1/isms/reviews/${reviewId}`, {
      data: { status: "in_progress" },
    });
    expect(start.ok(), await start.text()).toBeTruthy();
    expect((await start.json()).data.status).toBe("in_progress");

    // Invalid transition is rejected server-side
    const invalid = await request.put(`/api/v1/isms/reviews/${reviewId}`, {
      data: { status: "planned" },
    });
    expect(invalid.status()).toBe(422);

    // 4. Item with decision + action → work_item created
    const itemRes = await request.post(
      `/api/v1/isms/reviews/${reviewId}/items`,
      {
        data: {
          category: "risks",
          content: "E2E: risk posture reviewed for the period.",
          decision: "E2E decision: tighten KRI thresholds.",
          action: {
            title: `e2e-review-action-${Date.now()}`,
            dueDate: today,
          },
        },
      },
    );
    expect(itemRes.status(), await itemRes.text()).toBe(201);
    const item = (await itemRes.json()).data;
    const itemId: string = item.id;
    expect(item.actionWorkItemId).toBeTruthy();
    expect(item.actionElementId).toBeTruthy();

    // Item list resolves the linked work item
    const listRes = await request.get(
      `/api/v1/isms/reviews/${reviewId}/items`,
    );
    expect(listRes.ok()).toBeTruthy();
    const listed = ((await listRes.json()).data as Array<{
      id: string;
      actionWorkItemId: string | null;
      actionStatus: string | null;
    }>).find((i) => i.id === itemId);
    expect(listed).toBeTruthy();
    expect(listed!.actionWorkItemId).toBe(item.actionWorkItemId);

    // 5. in_progress → completed
    const complete = await request.put(`/api/v1/isms/reviews/${reviewId}`, {
      data: { status: "completed" },
    });
    expect(complete.ok(), await complete.text()).toBeTruthy();
    const completed = (await complete.json()).data;
    expect(completed.status).toBe("completed");
    expect(completed.completedAt).toBeTruthy();

    // 6. Completed review is read-only: item mutations → 422
    const itemUpdate = await request.put(
      `/api/v1/isms/reviews/${reviewId}/items/${itemId}`,
      { data: { content: "E2E: must be rejected." } },
    );
    expect(itemUpdate.status()).toBe(422);

    const itemCreate = await request.post(
      `/api/v1/isms/reviews/${reviewId}/items`,
      { data: { category: "other", content: "E2E: must be rejected too." } },
    );
    expect(itemCreate.status()).toBe(422);

    // Review header mutation is rejected as well (terminal state)
    const reviewUpdate = await request.put(
      `/api/v1/isms/reviews/${reviewId}`,
      { data: { title: `${title}-changed` } },
    );
    expect(reviewUpdate.status()).toBe(422);

    // 7. PDF export (Beschluss-Protokoll)
    const pdfRes = await request.get(
      `/api/v1/isms/reviews/${reviewId}/export/pdf`,
    );
    expect(pdfRes.ok(), await pdfRes.text()).toBeTruthy();
    expect(pdfRes.headers()["content-type"]).toContain("application/pdf");
    const pdfBody = await pdfRes.body();
    expect(pdfBody.subarray(0, 4).toString()).toBe(PDF_MAGIC);
  });
});
