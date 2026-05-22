// Tests for the module-guard middleware (requireModule).
//
// This is the single gate every API route uses to enforce per-org
// module enablement. The contract:
//   - missing config OR uiStatus "disabled" / "maintenance" → 404
//     (intentionally indistinguishable from "no such route" so callers
//      can't enumerate which modules an org has)
//   - uiStatus "preview" + non-GET method → 403
//   - everything else → null (allowed; route handler runs)
//
// Pre-Wave-26 there were zero unit tests for this gate. A future
// refactor that lifted "maintenance" out of the 404 branch (because
// e.g. "we want to show a friendly maintenance page") would silently
// break the don't-enumerate property — and the same regression would
// pass every existing test because they all assert on routes, not on
// the gate itself.

import { describe, it, expect, vi, beforeEach } from "vitest";

// Module-config cache is what the gate calls. Mock it.
const getMock = vi.fn();
vi.mock("../src/cache/module-config-cache", () => ({
  get: (orgId: string, moduleKey: string) => getMock(orgId, moduleKey),
}));

import { requireModule } from "../src/middleware/module-guard";

beforeEach(() => {
  getMock.mockReset();
});

describe("requireModule — module disabled or absent", () => {
  it("returns 404 when no config exists for (orgId, moduleKey)", async () => {
    getMock.mockResolvedValue(null);
    const res = await requireModule("erm", "org-1", "GET");
    expect(res).not.toBeNull();
    expect(res?.status).toBe(404);
    const body = await res!.json();
    expect(body.error).toBe("Not found");
  });

  it.each([
    ["disabled", "GET"],
    ["disabled", "POST"],
    ["disabled", "PUT"],
    ["disabled", "DELETE"],
    ["maintenance", "GET"],
    ["maintenance", "POST"],
  ])(
    "returns 404 when uiStatus=%s + method=%s (don't enumerate)",
    async (uiStatus, method) => {
      getMock.mockResolvedValue({ moduleKey: "erm", uiStatus });
      const res = await requireModule("erm", "org-1", method);
      expect(res?.status).toBe(404);
    },
  );

  it("returns identical 404 body for absent vs disabled — caller can't tell them apart", async () => {
    getMock.mockResolvedValueOnce(null);
    const absent = await requireModule("erm", "org-1", "GET");
    getMock.mockResolvedValueOnce({ uiStatus: "disabled" });
    const disabled = await requireModule("erm", "org-1", "GET");
    expect(absent?.status).toBe(disabled?.status);
    const a = await absent!.json();
    const d = await disabled!.json();
    expect(a).toEqual(d);
  });
});

describe("requireModule — preview mode", () => {
  it("returns null (allowed) when preview + GET", async () => {
    getMock.mockResolvedValue({ uiStatus: "preview" });
    const res = await requireModule("erm", "org-1", "GET");
    expect(res).toBeNull();
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"])(
    "returns 403 when preview + %s",
    async (method) => {
      getMock.mockResolvedValue({ uiStatus: "preview" });
      const res = await requireModule("erm", "org-1", method);
      expect(res?.status).toBe(403);
      const body = await res!.json();
      expect(body.error).toMatch(/preview/i);
    },
  );

  it("preview mode is read-only — body explicitly says so", async () => {
    getMock.mockResolvedValue({ uiStatus: "preview" });
    const res = await requireModule("erm", "org-1", "POST");
    const body = await res!.json();
    expect(body.error).toMatch(/read-only/i);
  });
});

describe("requireModule — enabled state", () => {
  it.each(["GET", "POST", "PUT", "PATCH", "DELETE"])(
    "returns null (allowed) when uiStatus=enabled + method=%s",
    async (method) => {
      getMock.mockResolvedValue({ uiStatus: "enabled" });
      const res = await requireModule("erm", "org-1", method);
      expect(res).toBeNull();
    },
  );

  it("default method is GET (matches function signature)", async () => {
    getMock.mockResolvedValue({ uiStatus: "enabled" });
    const res = await requireModule("erm", "org-1");
    expect(res).toBeNull();
  });
});

describe("requireModule — argument passthrough", () => {
  it("passes orgId and moduleKey to the cache lookup verbatim", async () => {
    getMock.mockResolvedValue({ uiStatus: "enabled" });
    await requireModule("isms", "org-meridian", "GET");
    expect(getMock).toHaveBeenCalledWith("org-meridian", "isms");
  });
});
