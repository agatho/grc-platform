/**
 * BPM Overhaul Phase 6 E3 (updated for B2.x Release-Cycle):
 * Approval pipeline E2E.
 *
 * Covers:
 *   1. Create a process (draft)
 *   2. Submit to in_review — fails with blockers when prerequisites unmet
 *   3. Add owner, reviewer, version, step descriptions, framework mapping
 *   4. draft → in_review → approved (comment mandatory)
 *   5. B2.2: approved → published is BLOCKED (422 `missing_owner_sign_off`)
 *      until a process_owner sign-off exists for the CURRENT version
 *      (the approve transition auto-versions, so an earlier sign-off no
 *      longer counts)
 *   6. Owner sign-off → publish succeeds; hash chain stays valid
 *   7. B2.4: saving a published process creates a working copy
 *      (versionType 'working') instead of a new released version
 *   8. New transition published → in_review (re-approval of the working copy)
 *   9. B2.1: multi-stage approval chain — deciding the last gate step
 *      auto-approves the process and promotes the working copy to the
 *      next released version
 */
import { test, expect } from "@playwright/test";

test.describe("BPM — Approval pipeline with gates + sign-off chain", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("full pipeline: draft → published (sign-off gate) → working copy → re-approval", async ({
    request,
  }) => {
    // 1. Create process
    const name = `e2e-bpm-${Date.now()}`;
    const createRes = await request.post("/api/v1/processes", {
      data: {
        name,
        description: "Overnight E2E test process for BPM overhaul.",
        level: 2,
      },
    });
    expect(createRes.ok(), await createRes.text()).toBeTruthy();
    const processId: string = (await createRes.json()).data.id;
    expect(processId).toBeTruthy();

    // 2. Attempt to transition to in_review with no owner → should 422 with blockers
    const earlyTransition = await request.put(
      `/api/v1/processes/${processId}/status`,
      {
        data: { status: "in_review" },
      },
    );
    expect(earlyTransition.status()).toBe(422);
    const earlyBody = await earlyTransition.json();
    expect(earlyBody.blockers).toBeDefined();
    expect(
      earlyBody.blockers.some((b: any) => b.code === "missing_process_owner"),
    ).toBe(true);

    // 3a. Find the admin user id (request via /api/v1/users/me)
    const meRes = await request.get("/api/v1/users/me");
    const me = await meRes.json();
    const userId: string = me?.data?.id ?? me?.user?.id ?? me?.id;
    expect(userId).toBeTruthy();

    // 3b. Update process: set owner + reviewer
    await request.put(`/api/v1/processes/${processId}`, {
      data: { processOwnerId: userId, reviewerId: userId },
    });

    // 3c. Create a version
    const versionRes = await request.post(
      `/api/v1/processes/${processId}/versions`,
      {
        data: {
          bpmnXml: `<?xml version="1.0"?><bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"><bpmn:process id="p1"><bpmn:startEvent id="s"/><bpmn:task id="t1" name="Task 1"/><bpmn:endEvent id="e"/></bpmn:process></bpmn:definitions>`,
          changeSummary: "Initial",
        },
      },
    );
    expect(versionRes.ok(), await versionRes.text()).toBeTruthy();
    // Draft process → regular released version, NOT a working copy (B2.4)
    const versionJson = await versionRes.json();
    expect(versionJson.meta?.workingCopy).toBeFalsy();

    // 3d. Give every step a description — hard gate for in_review → approved
    // (`activities_missing_description`).
    const stepsRes = await request.get(
      `/api/v1/processes/${processId}/steps`,
    );
    expect(stepsRes.ok()).toBeTruthy();
    const steps: Array<{ id: string }> = (await stepsRes.json()).data;
    expect(steps.length).toBeGreaterThan(0);
    for (const step of steps) {
      const upd = await request.put(
        `/api/v1/processes/${processId}/steps/${step.id}`,
        { data: { description: "E2E step description for gate checks." } },
      );
      expect(upd.ok(), await upd.text()).toBeTruthy();
    }

    // 3e. Framework mapping — hard gate for approved → published
    // (`no_framework_mapping`).
    const mappingRes = await request.post(
      `/api/v1/processes/${processId}/coverage`,
      {
        data: {
          frameworkCode: "ISO27001",
          entryCode: "A.5.1",
          entryTitle: "Policies for information security",
          mappingStrength: "covers",
        },
      },
    );
    expect(mappingRes.status(), await mappingRes.text()).toBe(201);

    // 4. draft → in_review (should pass now)
    const inReview = await request.put(
      `/api/v1/processes/${processId}/status`,
      {
        data: { status: "in_review" },
      },
    );
    expect(inReview.ok(), await inReview.text()).toBeTruthy();

    // 5. Sign-off (review) during review — anchors the hash chain
    const signReview = await request.post(
      `/api/v1/processes/${processId}/sign-off`,
      {
        data: { signerRole: "process_owner", signoffType: "review" },
      },
    );
    expect(signReview.ok(), await signReview.text()).toBeTruthy();

    // 6. in_review → approved — the transition requires a mandatory comment
    // (`TRANSITIONS_REQUIRING_COMMENT`) and auto-versions the process:
    // a NEW released version becomes current.
    const approveNoComment = await request.put(
      `/api/v1/processes/${processId}/status`,
      { data: { status: "approved" } },
    );
    expect(approveNoComment.status()).toBe(422); // comment missing

    const approve = await request.put(
      `/api/v1/processes/${processId}/status`,
      {
        data: { status: "approved", comment: "E2E review passed." },
      },
    );
    expect(approve.ok(), await approve.text()).toBeTruthy();

    // 7. B2.2: approved → published without a process_owner sign-off for the
    // CURRENT version must be blocked with 422 `missing_owner_sign_off`.
    // (The review sign-off from step 5 references the pre-approval version,
    // which is no longer current after auto-versioning.)
    const publishBlocked = await request.put(
      `/api/v1/processes/${processId}/status`,
      { data: { status: "published" } },
    );
    expect(publishBlocked.status()).toBe(422);
    const blockedBody = await publishBlocked.json();
    expect(blockedBody.blockers).toBeDefined();
    expect(
      blockedBody.blockers.some(
        (b: any) => b.code === "missing_owner_sign_off",
      ),
    ).toBe(true);

    // 8. Owner sign-off for the current version → publish succeeds.
    const signPublish = await request.post(
      `/api/v1/processes/${processId}/sign-off`,
      {
        data: { signerRole: "process_owner", signoffType: "publish" },
      },
    );
    expect(signPublish.ok(), await signPublish.text()).toBeTruthy();

    const publish = await request.put(
      `/api/v1/processes/${processId}/status`,
      { data: { status: "published" } },
    );
    expect(publish.ok(), await publish.text()).toBeTruthy();

    // 9. Verify sign-off chain is valid (review + publish sign-offs)
    const chainRes = await request.get(
      `/api/v1/processes/${processId}/sign-off`,
    );
    expect(chainRes.ok()).toBeTruthy();
    const chain = await chainRes.json();
    expect(chain.data.chainValid).toBe(true);
    expect(chain.data.count).toBeGreaterThanOrEqual(2);

    // 10. Audit trail includes the sign-off/transition events
    const trail = await request.get(
      `/api/v1/processes/${processId}/audit-trail?limit=50`,
    );
    expect(trail.ok()).toBeTruthy();
    const trailJson = await trail.json();
    expect(Array.isArray(trailJson.data)).toBe(true);

    // 11. B2.4: saving a published process creates/updates a WORKING COPY —
    // the released version and process.currentVersion stay untouched.
    const workingSave = await request.post(
      `/api/v1/processes/${processId}/versions`,
      {
        data: {
          bpmnXml: `<?xml version="1.0"?><bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"><bpmn:process id="p1"><bpmn:startEvent id="s"/><bpmn:task id="t1" name="Task 1 changed"/><bpmn:endEvent id="e"/></bpmn:process></bpmn:definitions>`,
          changeSummary: "Post-publish edit",
        },
      },
    );
    expect(workingSave.status(), await workingSave.text()).toBe(201);
    const workingJson = await workingSave.json();
    expect(workingJson.meta?.workingCopy).toBe(true);
    expect(workingJson.data.versionType).toBe("working");
    expect(workingJson.data.isCurrent).toBe(false);

    const versionsAfterSave = await request.get(
      `/api/v1/processes/${processId}/versions`,
    );
    const versionRows: Array<{
      versionType: string;
      isCurrent: boolean;
      versionNumber: number;
    }> = (await versionsAfterSave.json()).data;
    const workingRows = versionRows.filter(
      (v) => v.versionType === "working",
    );
    expect(workingRows).toHaveLength(1);
    // The released current version is NOT the working copy.
    const currentRow = versionRows.find((v) => v.isCurrent);
    expect(currentRow?.versionType).toBe("released");

    // 12. New transition (B2.4): published → in_review starts re-approval
    // of the working copy. Comment mandatory (`approved->in_review` only;
    // `published->in_review` needs none).
    const reReview = await request.put(
      `/api/v1/processes/${processId}/status`,
      { data: { status: "in_review" } },
    );
    expect(reReview.ok(), await reReview.text()).toBeTruthy();

    // 13. B2.1: define the default approval chain (review → approval) for
    // the working copy and decide the steps. Completing the last gate step
    // auto-approves the process and promotes the working copy.
    const chainCreate = await request.post(
      `/api/v1/processes/${processId}/approval-steps`,
      { data: {} },
    );
    expect(chainCreate.status(), await chainCreate.text()).toBe(201);
    const chainSteps: Array<{
      id: string;
      stepOrder: number;
      stepType: string;
      status: string;
    }> = (await chainCreate.json()).data;
    const gateSteps = chainSteps
      .filter((s) => s.stepType !== "acknowledgment")
      .sort((a, b) => a.stepOrder - b.stepOrder);
    expect(gateSteps.length).toBeGreaterThanOrEqual(2);
    expect(gateSteps[0].status).toBe("in_progress");

    // First gate step (review) → chain continues.
    const decide1 = await request.post(
      `/api/v1/processes/${processId}/approval-steps/${gateSteps[0].id}/decide`,
      { data: { decision: "approve", comment: "E2E chain review ok." } },
    );
    expect(decide1.ok(), await decide1.text()).toBeTruthy();
    expect((await decide1.json()).meta.processOutcome).toBeNull();

    // Last gate step (approval) → process auto-approved, working copy
    // promoted to the next released version.
    const decide2 = await request.post(
      `/api/v1/processes/${processId}/approval-steps/${gateSteps[1].id}/decide`,
      { data: { decision: "approve", comment: "E2E chain approval ok." } },
    );
    expect(decide2.ok(), await decide2.text()).toBeTruthy();
    expect((await decide2.json()).meta.processOutcome).toBe("approved");

    // Working copy is gone — promoted to the released current version.
    const versionsAfterPromotion = await request.get(
      `/api/v1/processes/${processId}/versions`,
    );
    const promotedRows: Array<{
      versionType: string;
      isCurrent: boolean;
    }> = (await versionsAfterPromotion.json()).data;
    expect(
      promotedRows.filter((v) => v.versionType === "working"),
    ).toHaveLength(0);
    expect(promotedRows.find((v) => v.isCurrent)?.versionType).toBe(
      "released",
    );

    // Process is back in 'approved' — a fresh owner sign-off would be
    // required again before the next publication (gate re-armed).
    const procRes = await request.get(`/api/v1/processes/${processId}`);
    expect(procRes.ok()).toBeTruthy();
    expect((await procRes.json()).data.status).toBe("approved");
  });
});
