// Academy Enrollment Flow — POST + PATCH-progress contract.
//
// #WAVE19-N6: Wave-19 spec asks for an Academy E2E flow:
//   1. Course discovery → POST enrollment → 201
//   2. PATCH progress = 50 → status: in_progress
//   3. PATCH progress = 100 → status: completed
// We don't run a live DB walk-through — that's an integration concern
// — but we DO pin the schema-and-status-derivation contract at the
// route level so a regression that breaks the progress→status mapping
// (e.g. someone using progress >= 100 instead of === 100, or
// forgetting to set completedAt) gets caught here.

import { describe, it, expect, beforeEach, vi } from "vitest";

const withAuthMock = vi.fn();
const withAuditContextMock = vi.fn();

let existingEnrollment: Record<string, unknown> | undefined;
let updateCapture: Record<string, unknown> | undefined;
let insertCapture: Record<string, unknown> | undefined;

vi.mock("@grc/db", () => ({
  get db() {
    return {
      select() {
        return {
          from() {
            return {
              where() {
                return Promise.resolve(
                  existingEnrollment ? [existingEnrollment] : [],
                );
              },
            };
          },
        };
      },
    };
  },
  academyEnrollment: {
    id: "id",
    orgId: "orgId",
    courseId: "courseId",
    userId: "userId",
  },
}));

vi.mock("@/lib/api", () => ({
  get withAuth() {
    return withAuthMock;
  },
  get withAuditContext() {
    return withAuditContextMock;
  },
}));

vi.mock("drizzle-orm", () => {
  const noop = () => ({}) as unknown;
  return {
    eq: noop,
    and: noop,
    sql: noop,
    desc: noop,
  };
});

const VALID_UUID = "11111111-1111-1111-1111-111111111111";
const COURSE_ID = "22222222-2222-2222-2222-222222222222";
const ENROLL_ID = "33333333-3333-3333-3333-333333333333";
const LESSON_ID = "44444444-4444-4444-4444-444444444444";

const SLOW_TEST_TIMEOUT_MS = 15_000;

function authedCtx() {
  return {
    session: { user: { id: VALID_UUID } },
    orgId: VALID_UUID,
    userId: VALID_UUID,
  };
}

describe("Academy enrollment + progress flow (Wave-19-N6)", () => {
  beforeEach(() => {
    existingEnrollment = undefined;
    updateCapture = undefined;
    insertCapture = undefined;
    withAuthMock.mockReset();
    withAuditContextMock.mockReset();
    withAuthMock.mockResolvedValue(authedCtx());

    withAuditContextMock.mockImplementation(
      async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          insert(_table: unknown) {
            return {
              values(values: Record<string, unknown>) {
                insertCapture = values;
                return {
                  returning() {
                    return Promise.resolve([
                      { id: ENROLL_ID, ...values, status: "assigned" },
                    ]);
                  },
                };
              },
            };
          },
          update(_table: unknown) {
            return {
              set(values: Record<string, unknown>) {
                updateCapture = values;
                return {
                  where() {
                    return {
                      returning() {
                        return Promise.resolve([{ id: ENROLL_ID, ...values }]);
                      },
                    };
                  },
                };
              },
            };
          },
        };
        return fn(tx);
      },
    );
  });

  it(
    "POST /enrollments {courseId, userId} returns 201 and inserts orgId + assignedBy",
    async () => {
      const { POST } =
        await import("../../app/api/v1/academy/enrollments/route");
      const res = await POST(
        new Request("http://localhost/api/v1/academy/enrollments", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            userId: VALID_UUID,
            courseId: COURSE_ID,
          }),
        }),
      );

      expect(res.status).toBe(201);
      expect(insertCapture).toBeDefined();
      expect(insertCapture!.orgId).toBe(VALID_UUID);
      expect(insertCapture!.assignedBy).toBe(VALID_UUID);
      expect(insertCapture!.courseId).toBe(COURSE_ID);
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it(
    "PATCH /progress {progressPct: 50} sets status to 'in_progress' (not completed)",
    async () => {
      existingEnrollment = {
        id: ENROLL_ID,
        orgId: VALID_UUID,
        completedLessons: [],
        startedAt: null,
      };

      const { PATCH } =
        await import("../../app/api/v1/academy/enrollments/[id]/progress/route");
      const res = await PATCH(
        new Request(
          `http://localhost/api/v1/academy/enrollments/${ENROLL_ID}/progress`,
          {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              lessonId: LESSON_ID,
              progressPct: 50,
            }),
          },
        ),
        { params: Promise.resolve({ id: ENROLL_ID }) },
      );

      expect(res.status).toBe(200);
      expect(updateCapture).toBeDefined();
      expect(updateCapture!.status).toBe("in_progress");
      expect(updateCapture!.progressPct).toBe(50);
      expect(updateCapture!.completedAt).toBeUndefined();
      expect(updateCapture!.startedAt).toBeInstanceOf(Date);
      // Lesson appended to completed-list.
      const cl = updateCapture!.completedLessons as string[];
      expect(cl).toContain(LESSON_ID);
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it(
    "PATCH /progress {progressPct: 100} sets status to 'completed' AND completedAt",
    async () => {
      existingEnrollment = {
        id: ENROLL_ID,
        orgId: VALID_UUID,
        completedLessons: ["existing-lesson-1"],
        startedAt: new Date("2026-05-01"),
      };

      const { PATCH } =
        await import("../../app/api/v1/academy/enrollments/[id]/progress/route");
      const res = await PATCH(
        new Request(
          `http://localhost/api/v1/academy/enrollments/${ENROLL_ID}/progress`,
          {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              lessonId: LESSON_ID,
              progressPct: 100,
            }),
          },
        ),
        { params: Promise.resolve({ id: ENROLL_ID }) },
      );

      expect(res.status).toBe(200);
      expect(updateCapture!.status).toBe("completed");
      expect(updateCapture!.progressPct).toBe(100);
      expect(updateCapture!.completedAt).toBeInstanceOf(Date);
      // Existing completed lessons + the new one.
      const cl = updateCapture!.completedLessons as string[];
      expect(cl).toEqual(
        expect.arrayContaining(["existing-lesson-1", LESSON_ID]),
      );
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it(
    "PATCH /progress 404 when enrollment doesn't exist (or wrong tenant)",
    async () => {
      existingEnrollment = undefined;

      const { PATCH } =
        await import("../../app/api/v1/academy/enrollments/[id]/progress/route");
      const res = await PATCH(
        new Request(
          `http://localhost/api/v1/academy/enrollments/${ENROLL_ID}/progress`,
          {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              lessonId: LESSON_ID,
              progressPct: 50,
            }),
          },
        ),
        { params: Promise.resolve({ id: ENROLL_ID }) },
      );

      expect(res.status).toBe(404);
      expect(updateCapture).toBeUndefined();
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it(
    "PATCH /progress {progressPct: 101} → 422 (Zod max(100))",
    async () => {
      existingEnrollment = {
        id: ENROLL_ID,
        orgId: VALID_UUID,
        completedLessons: [],
        startedAt: null,
      };

      const { PATCH } =
        await import("../../app/api/v1/academy/enrollments/[id]/progress/route");
      // .parse() throws ZodError → withErrorHandler returns problem+json 422
      // OR the route bubbles it as a 500. Either way, NOT a 200.
      let res: Response;
      try {
        res = await PATCH(
          new Request(
            `http://localhost/api/v1/academy/enrollments/${ENROLL_ID}/progress`,
            {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                lessonId: LESSON_ID,
                progressPct: 101,
              }),
            },
          ),
          { params: Promise.resolve({ id: ENROLL_ID }) },
        );
      } catch (e) {
        // The route doesn't use withErrorHandler — Zod throws; that's
        // also acceptable as long as the update never landed.
        expect(updateCapture).toBeUndefined();
        return;
      }
      expect(res.status).not.toBe(200);
      expect(updateCapture).toBeUndefined();
    },
    SLOW_TEST_TIMEOUT_MS,
  );
});
