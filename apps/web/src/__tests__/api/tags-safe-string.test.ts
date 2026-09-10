// POST /api/v1/tags — `safeString` tag stripping.
//
// CodeQL js/incomplete-multi-character-sanitization flagged the
// `.replace(/<[^>]*>/g, "")` inside the Zod transform: a single pass is not
// stated to be a fixpoint, so the strip now repeats until the string stops
// changing (capped at 8 passes).
//
// `safeString` is module-private, so the property is pinned through the
// smallest already-exported surface: the POST handler, asserting on the value
// that reaches the INSERT parameters.

import { describe, it, expect, beforeEach, vi } from "vitest";

const withAuthMock = vi.fn();
const executeMock = vi.fn();

vi.mock("@grc/db", () => ({
  get db() {
    return { execute: executeMock };
  },
}));

vi.mock("@/lib/api", () => ({
  get withAuth() {
    return withAuthMock;
  },
  PaginationError: class PaginationError extends Error {},
}));

// Capture the interpolated parameters instead of building real SQL.
vi.mock("drizzle-orm", () => ({
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings,
    values,
  }),
}));

const ORG_ID = "11111111-1111-1111-1111-111111111111";
const USER_ID = "22222222-2222-2222-2222-222222222222";

interface CapturedQuery {
  values: unknown[];
}

/** Post a tag body and return the parameters handed to the INSERT. */
async function postTag(body: unknown): Promise<CapturedQuery> {
  const { POST } = await import("../../app/api/v1/tags/route");
  const res = await POST(
    new Request("http://localhost/api/v1/tags", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    undefined as never,
  );
  expect(res.status).toBe(201);
  expect(executeMock).toHaveBeenCalledTimes(1);
  return executeMock.mock.calls[0][0] as CapturedQuery;
}

/** INSERT parameter order: orgId, name, color, category, description, userId */
function insertedName(query: CapturedQuery): string {
  return query.values[1] as string;
}

function insertedDescription(query: CapturedQuery): string | null {
  return query.values[4] as string | null;
}

describe("POST /api/v1/tags — safeString strips tags to a fixpoint", () => {
  beforeEach(() => {
    withAuthMock.mockReset();
    executeMock.mockReset();
    withAuthMock.mockResolvedValue({
      session: { user: { id: USER_ID } },
      orgId: ORG_ID,
      userId: USER_ID,
    });
    executeMock.mockResolvedValue([{ id: "tag-1" }]);
  });

  it("strips a plain tag from the name", async () => {
    const q = await postTag({ name: "<b>Kritisch</b>" });
    expect(insertedName(q)).toBe("Kritisch");
  });

  it("leaves no tag markup for nested/overlapping angle brackets", async () => {
    // `<<a>b>` and `<<div>span>` are the reconstruction shapes the CodeQL
    // rule names: after one pass the leftovers must not form a fresh tag.
    const q = await postTag({
      name: "<<a>b>Kritisch",
      description: "<<div>span>Beschreibung <scr<script>ipt>alert(1)",
    });
    expect(insertedName(q)).not.toMatch(/<[^>]*>/);
    expect(insertedDescription(q)).not.toMatch(/<[^>]*>/);
    expect(insertedName(q)).toContain("Kritisch");
    expect(insertedDescription(q)).toContain("Beschreibung");
  });

  it("removes `<>` — [^>]* permits empty content, so it IS a tag here", async () => {
    // The one place this strip deliberately differs from the `[^>]+` strips in
    // extract-text.ts / threat-feed-sync.ts, which keep `<>`. The linear scan
    // that replaced the regex has to preserve the difference, not unify it.
    const q = await postTag({ name: "a<>b" });
    expect(insertedName(q)).toBe("ab");
  });

  it("terminates on an adversarial run of opening brackets", async () => {
    // `.max(200)` runs BEFORE the transform, so this site was never exposed to
    // the quadratic blow-up that the uncapped call sites were. Kept as a cheap
    // guard in case the cap is ever raised or moved.
    const started = Date.now();
    const q = await postTag({ name: "<".repeat(190) + "x" });
    expect(Date.now() - started).toBeLessThan(2000);
    expect(insertedName(q)).not.toMatch(/<[^>]*>/);
  });
});
