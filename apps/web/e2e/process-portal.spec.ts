/**
 * Process-Portal (B2.3/B3): "Meine Prozesse" + Kenntnisnahme E2E.
 *
 * API-first (pattern: bpm-approval-pipeline.spec.ts):
 *   1. Create a process with owner (= admin) and reviewer
 *   2. Full gate flow draft → in_review → approved → published
 *      (step descriptions, framework mapping, owner sign-off)
 *   3. GET /api/v1/bpm/my-processes lists it with role "owner"
 *   4. Create an acknowledgment step for the user (approval-steps API)
 *   5. my-processes now shows the pending acknowledgment
 *      ("Kenntnisnahme ausstehend")
 *   6. POST /processes/:id/acknowledge completes it
 *   7. Acknowledgment compliance percentage rises 0 → 100
 *
 * Independent + idempotent: unique timestamped names, best-effort
 * cleanup (soft delete) at the end.
 */
import { test, expect } from "@playwright/test";

const BPMN_XML = `<?xml version="1.0"?><bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"><bpmn:process id="p1"><bpmn:startEvent id="s"/><bpmn:task id="t1" name="Portal Task"/><bpmn:endEvent id="e"/></bpmn:process></bpmn:definitions>`;

test.describe("BPM — Process portal (my-processes + acknowledgment)", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("publish flow → portal listing with role → acknowledgment raises compliance", async ({
    request,
  }) => {
    const name = `e2e-portal-${Date.now()}`;
    let processId: string | null = null;

    try {
      // 1. Create process
      const createRes = await request.post("/api/v1/processes", {
        data: {
          name,
          description: "E2E process portal test process.",
          level: 2,
        },
      });
      expect(createRes.ok(), await createRes.text()).toBeTruthy();
      processId = (await createRes.json()).data.id as string;
      expect(processId).toBeTruthy();

      // 2. Resolve admin user id
      const meRes = await request.get("/api/v1/users/me");
      expect(meRes.ok()).toBeTruthy();
      const me = await meRes.json();
      const userId: string = me?.data?.id ?? me?.user?.id ?? me?.id;
      expect(userId).toBeTruthy();

      // 3. Owner + reviewer (gate: missing_process_owner)
      const upd = await request.put(`/api/v1/processes/${processId}`, {
        data: { processOwnerId: userId, reviewerId: userId },
      });
      expect(upd.ok(), await upd.text()).toBeTruthy();

      // 4. Version with BPMN diagram
      const versionRes = await request.post(
        `/api/v1/processes/${processId}/versions`,
        { data: { bpmnXml: BPMN_XML, changeSummary: "Initial" } },
      );
      expect(versionRes.ok(), await versionRes.text()).toBeTruthy();

      // 5. Step descriptions (gate: activities_missing_description)
      const stepsRes = await request.get(
        `/api/v1/processes/${processId}/steps`,
      );
      expect(stepsRes.ok()).toBeTruthy();
      const steps: Array<{ id: string }> = (await stepsRes.json()).data;
      for (const step of steps) {
        const stepUpd = await request.put(
          `/api/v1/processes/${processId}/steps/${step.id}`,
          { data: { description: "E2E portal step description." } },
        );
        expect(stepUpd.ok(), await stepUpd.text()).toBeTruthy();
      }

      // 6. Framework mapping (gate: no_framework_mapping)
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

      // 7. draft → in_review → approved (comment mandatory)
      const inReview = await request.put(
        `/api/v1/processes/${processId}/status`,
        { data: { status: "in_review" } },
      );
      expect(inReview.ok(), await inReview.text()).toBeTruthy();

      const approve = await request.put(
        `/api/v1/processes/${processId}/status`,
        { data: { status: "approved", comment: "E2E portal review passed." } },
      );
      expect(approve.ok(), await approve.text()).toBeTruthy();

      // 8. Owner sign-off for the current (auto-created) version → publish
      const signPublish = await request.post(
        `/api/v1/processes/${processId}/sign-off`,
        { data: { signerRole: "process_owner", signoffType: "publish" } },
      );
      expect(signPublish.ok(), await signPublish.text()).toBeTruthy();

      const publish = await request.put(
        `/api/v1/processes/${processId}/status`,
        { data: { status: "published" } },
      );
      expect(publish.ok(), await publish.text()).toBeTruthy();

      // 9. Portal listing: process appears with role "owner"
      const myRes = await request.get(
        `/api/v1/bpm/my-processes?search=${encodeURIComponent(name)}`,
      );
      expect(myRes.ok(), await myRes.text()).toBeTruthy();
      const myItems: Array<{
        id: string;
        myRoles: string[];
        acknowledgment: { stepId: string; status: string } | null;
      }> = (await myRes.json()).data;
      const mine = myItems.find((p) => p.id === processId);
      expect(
        mine,
        "published process must appear in my-processes",
      ).toBeTruthy();
      expect(mine!.myRoles).toContain("owner");
      // No acknowledgment step created yet
      expect(mine!.acknowledgment).toBeNull();

      // 10. Create an acknowledgment step for the user (explicit chain)
      const currentVersion: number = (
        await (await request.get(`/api/v1/processes/${processId}`)).json()
      ).data.currentVersion;
      const ackCreate = await request.post(
        `/api/v1/processes/${processId}/approval-steps`,
        {
          data: {
            versionNumber: currentVersion,
            steps: [{ stepType: "acknowledgment", assigneeUserId: userId }],
          },
        },
      );
      expect(ackCreate.status(), await ackCreate.text()).toBe(201);

      // 11. Portal now shows the pending acknowledgment
      const myRes2 = await request.get(
        `/api/v1/bpm/my-processes?search=${encodeURIComponent(name)}`,
      );
      expect(myRes2.ok()).toBeTruthy();
      const mine2 = (
        (await myRes2.json()).data as Array<{
          id: string;
          acknowledgment: { status: string } | null;
        }>
      ).find((p) => p.id === processId);
      expect(mine2?.acknowledgment).toBeTruthy();
      expect(mine2!.acknowledgment!.status).toBe("pending");

      // 12. Compliance before acknowledging: 1 requested, 0 confirmed
      const compBefore = await request.get(
        `/api/v1/processes/${processId}/acknowledge`,
      );
      expect(compBefore.ok()).toBeTruthy();
      const before = (await compBefore.json()).data;
      expect(before.total).toBe(1);
      expect(before.acknowledged).toBe(0);
      expect(before.percentage).toBe(0);
      expect(before.currentUserAcknowledged).toBe(false);

      // 13. Acknowledge
      const ack = await request.post(
        `/api/v1/processes/${processId}/acknowledge`,
        { data: { comment: "E2E: read and understood." } },
      );
      expect([200, 201]).toContain(ack.status());
      expect((await ack.json()).data.status).toBe("completed");

      // 14. Compliance percentage rose to 100
      const compAfter = await request.get(
        `/api/v1/processes/${processId}/acknowledge`,
      );
      expect(compAfter.ok()).toBeTruthy();
      const after = (await compAfter.json()).data;
      expect(after.total).toBe(1);
      expect(after.acknowledged).toBe(1);
      expect(after.percentage).toBe(100);
      expect(after.currentUserAcknowledged).toBe(true);
    } finally {
      // Best-effort cleanup (soft delete) — must never fail the test.
      if (processId) {
        await request
          .delete(`/api/v1/processes/${processId}`)
          .catch(() => undefined);
      }
    }
  });
});
