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
 *   9. B2.1: multi-stage approval chain — the producing side is REFUSED its
 *      own gate (WP3/S02-12 four-eyes), a second person decides the review
 *      gate and a third the approval gate; that last decision auto-approves
 *      the process and promotes the working copy to the next released version
 *
 * [E2E-TRIAGE-3 · 2026-09-02] Three actors, not one.
 *
 * Until this round the suite had a single account, so this spec ran as one
 * person who created the process, authored the version, defined the approval
 * chain — and was then correctly refused by `canDecideApprovalStep`. The test
 * stopped at line 240 of 250 on a product rule that was working.
 *
 * Nothing is relaxed here; the opposite. The separation of duties is asserted
 * explicitly for the first time — and it turned out to be enforced in THREE
 * independent places that a single `admin` account satisfied all of at once:
 *
 *   a) `PROCESS_TRANSITION_ROLES` (packages/shared/src/process-status.ts):
 *      draft→in_review is process_owner/admin, in_review→approved is
 *      auditor/admin (or the designated reviewer), approved→published is
 *      admin only. The owner is refused the approval, the reviewer is refused
 *      the publication.
 *   b) `POST /approval-steps`: a chain naming its own author as a gate is
 *      rejected at definition time (WP3/S02-12).
 *   c) `canDecideApprovalStep`: whoever submitted, authored the version or
 *      defined the chain may not decide it — not even as admin.
 *
 * Three accounts, one per side of those rules:
 *
 *   owner     process_owner                 creates everything; may not
 *                                           approve, publish, or decide
 *   reviewer  auditor + compliance_officer  designated reviewer → the
 *                                           in_review→approved transition and
 *                                           the review gate
 *   approver  admin                         publication and the approval gate
 *
 * The accounts are provisioned by `npm run db:seed:e2e-users` and signed in by
 * `auth.setup.ts`; see apps/web/e2e/fixtures/storage.ts.
 */
import { test, expect, type APIRequestContext } from "@playwright/test";
import {
  STORAGE_STATE_APPROVER,
  STORAGE_STATE_OWNER,
  STORAGE_STATE_REVIEWER,
} from "./fixtures/storage";

test.describe("BPM — Approval pipeline with gates + sign-off chain", () => {
  // The whole pipeline runs as the PRODUCING side. `process_owner` is
  // sufficient for every route it touches (create, version, steps, coverage,
  // status, sign-off, chain definition) — the two decisions are the only
  // things it may not do, which is the point.
  test.use({ storageState: STORAGE_STATE_OWNER });

  test("full pipeline: draft → published (sign-off gate) → working copy → re-approval", async ({
    request,
    playwright,
    baseURL,
  }) => {
    // Second and third actor. Separate request contexts, each carrying its own
    // session, so one test can act as three people.
    const reviewerRequest: APIRequestContext =
      await playwright.request.newContext({
        baseURL,
        storageState: STORAGE_STATE_REVIEWER,
      });
    const approverRequest: APIRequestContext =
      await playwright.request.newContext({
        baseURL,
        storageState: STORAGE_STATE_APPROVER,
      });
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

    // 3a. Identify all three actors.
    async function whoAmI(
      ctx: APIRequestContext,
      label: string,
    ): Promise<{ id: string }> {
      const res = await ctx.get("/api/v1/users/me");
      const raw = await res.text();
      expect(res.ok(), `${label}: GET /api/v1/users/me -> ${raw}`).toBe(true);
      const body = JSON.parse(raw);
      const id: string = body?.data?.id ?? body?.user?.id ?? body?.id;
      expect(id, `${label}: no user id in /users/me (${raw})`).toBeTruthy();
      return { id };
    }
    const owner = await whoAmI(request, "owner");
    const reviewer = await whoAmI(reviewerRequest, "reviewer");
    const approver = await whoAmI(approverRequest, "approver");

    // Three DIFFERENT people. If the environment collapsed them into one
    // account the four-eyes assertions below would pass vacuously.
    expect(
      new Set([owner.id, reviewer.id, approver.id]).size,
      "owner/reviewer/approver must be three distinct accounts — run " +
        "`npm run db:seed:e2e-users`",
    ).toBe(3);

    // 3b. Update process: owner is the creator, REVIEWER is somebody else.
    // The default chain assigns the review gate to `process.reviewerId`, so
    // this is what gives the chain a second actor. Assigning the creator here
    // is refused outright by POST /approval-steps (separation of duties at
    // definition time) — asserted below.
    const setActors = await request.put(`/api/v1/processes/${processId}`, {
      data: { processOwnerId: owner.id, reviewerId: reviewer.id },
    });
    expect(setActors.ok(), await setActors.text()).toBeTruthy();

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
    const stepsRes = await request.get(`/api/v1/processes/${processId}/steps`);
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

    // 6. in_review → approved.
    //
    // [E2E-TRIAGE-3] The producing side may not make this transition at all.
    // `PROCESS_TRANSITION_ROLES` (packages/shared/src/process-status.ts) gives
    // `in_review->approved` to `auditor`/`admin` — and to the designated
    // reviewer of THIS process — but not to `process_owner`. That rule was
    // invisible for as long as the suite ran everything as one `admin`
    // account, which satisfies every row of the table. Assert it, then let
    // the reviewer do the reviewing.
    const ownerApprove = await request.put(
      `/api/v1/processes/${processId}/status`,
      { data: { status: "approved", comment: "E2E owner self-approval." } },
    );
    const ownerApproveBody = await ownerApprove.text();
    expect(
      ownerApprove.status(),
      `the process owner approved his own process: ${ownerApproveBody}`,
    ).toBe(403);

    // The transition also requires a mandatory comment
    // (`TRANSITIONS_REQUIRING_COMMENT`) and auto-versions the process:
    // a NEW released version becomes current.
    const approveNoComment = await reviewerRequest.put(
      `/api/v1/processes/${processId}/status`,
      { data: { status: "approved" } },
    );
    expect(approveNoComment.status()).toBe(422); // comment missing

    const approve = await reviewerRequest.put(
      `/api/v1/processes/${processId}/status`,
      { data: { status: "approved", comment: "E2E review passed." } },
    );
    expect(approve.ok(), await approve.text()).toBeTruthy();

    // 7. B2.2: approved → published without a process_owner sign-off for the
    // CURRENT version must be blocked with 422 `missing_owner_sign_off`.
    // (The review sign-off from step 5 references the pre-approval version,
    // which is no longer current after auto-versioning.)
    //
    // Publication is `admin`-only in the same table — a third role again, and
    // the reviewer who just approved is refused it.
    const reviewerPublish = await reviewerRequest.put(
      `/api/v1/processes/${processId}/status`,
      { data: { status: "published" } },
    );
    expect(
      reviewerPublish.status(),
      `the reviewer published the process he approved: ` +
        (await reviewerPublish.text()),
    ).toBe(403);

    const publishBlocked = await approverRequest.put(
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

    const publish = await approverRequest.put(
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
    const workingRows = versionRows.filter((v) => v.versionType === "working");
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

    // 13a. WP3/S02-12 at DEFINITION time: a chain that names its own author as
    // a gate is refused outright, so an undecidable chain cannot be created in
    // the first place. Asserted before the working chain, on the same route.
    const selfChain = await request.post(
      `/api/v1/processes/${processId}/approval-steps`,
      {
        data: {
          steps: [
            { stepType: "review", assigneeUserId: owner.id },
            { stepType: "approval", assigneeRole: "admin" },
          ],
        },
      },
    );
    const selfChainBody = await selfChain.text();
    expect(
      selfChain.status(),
      "the process owner defined a chain naming himself as reviewer and it " +
        `was accepted: ${selfChainBody}`,
    ).toBe(422);
    expect(selfChainBody).toMatch(/separation of duties/i);

    // 13b. B2.1: define the default approval chain (review → approval) for
    // the working copy. `process.reviewerId` is the REVIEWER account, so the
    // review gate is assigned to a second person; the approval gate carries
    // the role `admin`, which the approver account holds.
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
      assigneeUserId: string | null;
      assigneeRole: string | null;
    }> = (await chainCreate.json()).data;
    const gateSteps = chainSteps
      .filter((s) => s.stepType !== "acknowledgment")
      .sort((a, b) => a.stepOrder - b.stepOrder);
    expect(gateSteps.length).toBeGreaterThanOrEqual(2);
    expect(gateSteps[0].status).toBe("in_progress");
    expect(
      gateSteps[0].assigneeUserId,
      "the review gate must be assigned to the reviewer account",
    ).toBe(reviewer.id);
    expect(gateSteps[1].assigneeRole).toBe("admin");

    // 13c. THE ASSURANCE THIS SPEC EXISTS FOR (WP3/S02-12): the person who
    // created the process, authored the version and defined the chain may not
    // decide it — not on the review gate, not on the approval gate, and not by
    // virtue of any role. Before this round the suite had a single account and
    // could only observe this refusal as its own dead end; now it is asserted,
    // and the pipeline continues with the people who are allowed to decide.
    for (const gate of [gateSteps[0], gateSteps[1]]) {
      const selfDecide = await request.post(
        `/api/v1/processes/${processId}/approval-steps/${gate.id}/decide`,
        {
          data: { decision: "approve", comment: "E2E self-approval attempt." },
        },
      );
      const selfBody = await selfDecide.text();
      expect(
        selfDecide.status(),
        `the producing side was allowed to decide its own ${gate.stepType} ` +
          `gate: ${selfBody}`,
      ).toBe(403);
      expect(selfBody).toMatch(/separation of duties/i);
    }

    // First gate step (review) → decided by the assigned REVIEWER, chain
    // continues.
    const decide1 = await reviewerRequest.post(
      `/api/v1/processes/${processId}/approval-steps/${gateSteps[0].id}/decide`,
      { data: { decision: "approve", comment: "E2E chain review ok." } },
    );
    expect(decide1.ok(), await decide1.text()).toBeTruthy();
    expect((await decide1.json()).meta.processOutcome).toBeNull();

    // Last gate step (approval) → decided by the APPROVER as holder of the
    // assigned role. Process auto-approved, working copy promoted to the next
    // released version.
    const decide2 = await approverRequest.post(
      `/api/v1/processes/${processId}/approval-steps/${gateSteps[1].id}/decide`,
      { data: { decision: "approve", comment: "E2E chain approval ok." } },
    );
    expect(decide2.ok(), await decide2.text()).toBeTruthy();
    const decide2Json = await decide2.json();
    expect(decide2Json.meta.processOutcome).toBe("approved");
    // Both gates carry the identity of the person who decided them — an audit
    // trail that names the producing side would defeat the whole control.
    const decidedChain = await request.get(
      `/api/v1/processes/${processId}/approval-steps`,
    );
    const decidedSteps: Array<{
      id: string;
      decidedBy: string | null;
      status: string;
    }> = (await decidedChain.json()).data;
    const byId = (id: string) => decidedSteps.find((s) => s.id === id);
    expect(byId(gateSteps[0].id)?.decidedBy).toBe(reviewer.id);
    expect(byId(gateSteps[1].id)?.decidedBy).toBe(approver.id);
    expect(byId(gateSteps[0].id)?.decidedBy).not.toBe(owner.id);

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
    expect(promotedRows.find((v) => v.isCurrent)?.versionType).toBe("released");

    // Process is back in 'approved' — a fresh owner sign-off would be
    // required again before the next publication (gate re-armed).
    const procRes = await request.get(`/api/v1/processes/${processId}`);
    expect(procRes.ok()).toBeTruthy();
    expect((await procRes.json()).data.status).toBe("approved");

    await reviewerRequest.dispose();
    await approverRequest.dispose();
  });
});
