// POST /api/v1/bcms/bia/[id]/start    — Gate B1 (Setup completeness)
// POST /api/v1/bcms/bia/[id]/finalize — Gate B2 (Coverage >= 80%)
//
// #WAVE19-W6: Wave-19 QA spec asks for an explicit blocker contract on the
// BIA approve flow. The spec phrases the symptom as "process_impacts_incomplete"
// but the concrete blocker codes ARCTOS uses today are
//   - `no_process_impacts` (B2: zero process impacts attached)
//   - `score_coverage_below_threshold` (B2: < 80% MTPD/RTO/RPO scored)
// These guards lock in:
//   1. /start returns 422 + B1 blockers when the snapshot is incomplete
//      (missing lead-assessor in this test).
//   2. /finalize returns 422 + B2 blockers when no impacts exist
//      (no_process_impacts) — the canonical "incomplete impacts" signal.
//   3. /finalize returns 422 + B2 blockers when impacts exist but
//      coverage is < 80% (score_coverage_below_threshold).
// Without these tests a regression that silently strips the gate-check
// (e.g. someone "tidying up" the route) would let a half-scored BIA flow
// straight to `review` → `approved`.

import { describe, it, expect, beforeEach, vi } from "vitest";

const withAuthMock = vi.fn();
const requireModuleMock = vi.fn();
const withAuditContextMock = vi.fn();
const runBiaToAssetCascadeMock = vi.fn();

// Drizzle query state — switched per test via setBiaRow + setImpactCounts.
let currentBiaRow: Record<string, unknown> | undefined;
const impactCounts = { total: 0, scored: 0, essential: 0 };

function setBiaRow(row: Record<string, unknown> | undefined) {
  currentBiaRow = row;
}
function setImpactCounts(t: number, s: number, e: number) {
  impactCounts.total = t;
  impactCounts.scored = s;
  impactCounts.essential = e;
}

// Track which select() call we're on. The routes issue: bia-row → total
// → scored → essential. We use a module-scoped counter to round-robin
// through the expected return values rather than try to inspect the
// where-clause (which is opaque under the noop drizzle mock).
let selectCallNo = 0;

vi.mock("@grc/db", () => ({
  get db() {
    return {
      select(_cols?: unknown) {
        selectCallNo += 1;
        const callIndex = selectCallNo;
        return {
          from() {
            return {
              where() {
                // Call 1: BIA row
                if (callIndex === 1) {
                  return Promise.resolve(currentBiaRow ? [currentBiaRow] : []);
                }
                // Call 2: total impacts
                if (callIndex === 2) {
                  return Promise.resolve([{ total: impactCounts.total }]);
                }
                // Call 3: scored impacts
                if (callIndex === 3) {
                  return Promise.resolve([{ scored: impactCounts.scored }]);
                }
                // Call 4: essential impacts
                if (callIndex === 4) {
                  return Promise.resolve([
                    { essential: impactCounts.essential },
                  ]);
                }
                // Subsequent calls (essential lookup, existing essentials in
                // /finalize) — return empty to keep the second-half of the
                // route dormant; the gate check returns 422 well before then.
                return Promise.resolve([]);
              },
            };
          },
        };
      },
    };
  },
  biaAssessment: {
    id: "id",
    status: "status",
    name: "name",
    description: "description",
    periodStart: "periodStart",
    periodEnd: "periodEnd",
    leadAssessorId: "leadAssessorId",
    orgId: "orgId",
  },
  biaProcessImpact: {
    id: "id",
    biaAssessmentId: "biaAssessmentId",
    processId: "processId",
    mtpdHours: "mtpdHours",
    rtoHours: "rtoHours",
    rpoHours: "rpoHours",
    isEssential: "isEssential",
    priorityRanking: "priorityRanking",
  },
  essentialProcess: {
    orgId: "orgId",
    processId: "processId",
  },
}));

vi.mock("@grc/auth", () => ({
  get requireModule() {
    return requireModuleMock;
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

vi.mock("@/lib/cascade-runner", () => ({
  get runBiaToAssetCascade() {
    return runBiaToAssetCascadeMock;
  },
}));

vi.mock("drizzle-orm", () => {
  const noop = () => ({}) as unknown;
  return {
    eq: noop,
    and: noop,
    inArray: noop,
    lte: noop,
    sql: noop,
  };
});

const VALID_UUID = "11111111-1111-1111-1111-111111111111";
const BIA_ID = "22222222-2222-2222-2222-222222222222";
const LEAD_ASSESSOR_ID = "33333333-3333-3333-3333-333333333333";

function authedCtx() {
  return {
    session: { user: { id: VALID_UUID } },
    orgId: VALID_UUID,
    userId: VALID_UUID,
  };
}

const SLOW_TEST_TIMEOUT_MS = 15_000;

describe("BIA gate blocker contract (Wave-19-W6)", () => {
  beforeEach(() => {
    selectCallNo = 0;
    setBiaRow(undefined);
    setImpactCounts(0, 0, 0);
    withAuthMock.mockReset();
    requireModuleMock.mockReset();
    withAuditContextMock.mockReset();
    runBiaToAssetCascadeMock.mockReset();

    withAuthMock.mockResolvedValue(authedCtx());
    requireModuleMock.mockResolvedValue(undefined);
    runBiaToAssetCascadeMock.mockResolvedValue({
      classificationsCreated: 0,
      classificationsUpdated: 0,
    });
  });

  it(
    "/start returns 422 + B1 blockers when lead-assessor is missing",
    async () => {
      setBiaRow({
        id: BIA_ID,
        status: "draft",
        name: "Annual BIA 2026",
        description: "Test BIA",
        periodStart: "2026-01-01",
        periodEnd: "2026-12-31",
        leadAssessorId: null, // <-- the violation
      });
      // No impacts yet (B1 doesn't gate on those, only B2 does).
      setImpactCounts(0, 0, 0);

      const { POST } = await import(
        "../../app/api/v1/bcms/bia/[id]/start/route"
      );
      const res = await POST(
        new Request(`http://localhost/api/v1/bcms/bia/${BIA_ID}/start`, {
          method: "POST",
        }),
        { params: Promise.resolve({ id: BIA_ID }) },
      );

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.blocked).toBe(true);
      expect(body.gate).toBe("B1");
      expect(
        body.blockers.some(
          (b: { code: string }) => b.code === "missing_lead_assessor",
        ),
      ).toBe(true);
      // No transition happened — withAuditContext for the update was not called.
      expect(withAuditContextMock).not.toHaveBeenCalled();
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it(
    "/finalize returns 422 + B2 'no_process_impacts' when zero impacts attached",
    async () => {
      setBiaRow({
        id: BIA_ID,
        status: "in_progress",
        name: "Annual BIA 2026",
        description: "Test BIA",
        periodStart: "2026-01-01",
        periodEnd: "2026-12-31",
        leadAssessorId: LEAD_ASSESSOR_ID,
      });
      // Zero process impacts — the canonical "process_impacts_incomplete"
      // case the Wave-19 spec wants to lock down.
      setImpactCounts(0, 0, 0);

      const { POST } = await import(
        "../../app/api/v1/bcms/bia/[id]/finalize/route"
      );
      const res = await POST(
        new Request(`http://localhost/api/v1/bcms/bia/${BIA_ID}/finalize`, {
          method: "POST",
        }),
        { params: Promise.resolve({ id: BIA_ID }) },
      );

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.blocked).toBe(true);
      expect(body.gate).toBe("B2");
      expect(
        body.blockers.some(
          (b: { code: string }) => b.code === "no_process_impacts",
        ),
      ).toBe(true);
      // Status transition skipped.
      expect(withAuditContextMock).not.toHaveBeenCalled();
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it(
    "/finalize returns 422 + B2 'score_coverage_below_threshold' at < 80% scored",
    async () => {
      setBiaRow({
        id: BIA_ID,
        status: "in_progress",
        name: "Annual BIA 2026",
        description: "Test BIA",
        periodStart: "2026-01-01",
        periodEnd: "2026-12-31",
        leadAssessorId: LEAD_ASSESSOR_ID,
      });
      // 10 impacts, 5 scored = 50% — below the 80% threshold.
      setImpactCounts(10, 5, 2);

      const { POST } = await import(
        "../../app/api/v1/bcms/bia/[id]/finalize/route"
      );
      const res = await POST(
        new Request(`http://localhost/api/v1/bcms/bia/${BIA_ID}/finalize`, {
          method: "POST",
        }),
        { params: Promise.resolve({ id: BIA_ID }) },
      );

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.blocked).toBe(true);
      expect(body.gate).toBe("B2");
      expect(
        body.blockers.some(
          (b: { code: string }) =>
            b.code === "score_coverage_below_threshold",
        ),
      ).toBe(true);
      expect(withAuditContextMock).not.toHaveBeenCalled();
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it(
    "/finalize rejects when BIA is not in 'in_progress' status",
    async () => {
      setBiaRow({
        id: BIA_ID,
        status: "draft", // <-- wrong state for /finalize
        name: "Annual BIA 2026",
        description: "Test BIA",
        periodStart: "2026-01-01",
        periodEnd: "2026-12-31",
        leadAssessorId: LEAD_ASSESSOR_ID,
      });

      const { POST } = await import(
        "../../app/api/v1/bcms/bia/[id]/finalize/route"
      );
      const res = await POST(
        new Request(`http://localhost/api/v1/bcms/bia/${BIA_ID}/finalize`, {
          method: "POST",
        }),
        { params: Promise.resolve({ id: BIA_ID }) },
      );

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.fieldErrors?.status?.[0]).toMatch(/finalize nur von/);
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it(
    "/start rejects when BIA does not exist (404)",
    async () => {
      setBiaRow(undefined); // <-- not found

      const { POST } = await import(
        "../../app/api/v1/bcms/bia/[id]/start/route"
      );
      const res = await POST(
        new Request(`http://localhost/api/v1/bcms/bia/${BIA_ID}/start`, {
          method: "POST",
        }),
        { params: Promise.resolve({ id: BIA_ID }) },
      );

      expect(res.status).toBe(404);
    },
    SLOW_TEST_TIMEOUT_MS,
  );
});
