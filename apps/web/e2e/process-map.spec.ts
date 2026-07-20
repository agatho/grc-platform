/**
 * Prozesslandkarte (0374): band grouping, manual reorder, band
 * inheritance on drill-in.
 *
 * API-first (pattern: bpm-approval-pipeline.spec.ts):
 *   1. Create 3 root processes and assign map_category
 *      management / core / support (PUT — mapCategory is an update field)
 *   2. GET /api/v1/processes/map groups them into the correct bands
 *   3. PUT /api/v1/processes/map/reorder changes the tile order of the
 *      core band (map_sequence rewritten in steps of 10)
 *   4. A child process WITHOUT an own category inherits the parent band
 *      on drill-in (GET /processes/map?parentId=…)
 *
 * Independent + idempotent: unique timestamped names, best-effort
 * cleanup at the end.
 */
import { test, expect } from "@playwright/test";

interface MapItem {
  id: string;
  name: string;
  mapCategory: string | null;
  childCount: number;
}

interface MapGroups {
  management: MapItem[];
  core: MapItem[];
  support: MapItem[];
  unassigned: MapItem[];
}

test.describe("BPM — Process map (bands, reorder, inheritance)", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("band grouping → reorder → child inherits parent band on drill-in", async ({
    request,
  }) => {
    const stamp = Date.now();
    const createdIds: string[] = [];

    async function createProcess(
      name: string,
      extra: Record<string, unknown> = {},
    ): Promise<string> {
      const res = await request.post("/api/v1/processes", {
        data: {
          name,
          description: "E2E process map test process.",
          level: 1,
          ...extra,
        },
      });
      expect(res.ok(), await res.text()).toBeTruthy();
      const id = (await res.json()).data.id as string;
      createdIds.push(id);
      return id;
    }

    async function setCategory(id: string, mapCategory: string | null) {
      const res = await request.put(`/api/v1/processes/${id}`, {
        data: { mapCategory },
      });
      expect(res.ok(), await res.text()).toBeTruthy();
    }

    async function getMap(parentId?: string): Promise<{
      parent: {
        id: string;
        mapCategory: string | null;
        effectiveCategory: string | null;
      } | null;
      groups: MapGroups;
    }> {
      const url = parentId
        ? `/api/v1/processes/map?parentId=${parentId}`
        : "/api/v1/processes/map";
      const res = await request.get(url);
      expect(res.ok(), await res.text()).toBeTruthy();
      return (await res.json()).data;
    }

    try {
      // 1. Three root processes, one per band
      const mgmtId = await createProcess(`e2e-map-mgmt-${stamp}`);
      const coreAId = await createProcess(`e2e-map-core-a-${stamp}`);
      const supportId = await createProcess(`e2e-map-support-${stamp}`);
      await setCategory(mgmtId, "management");
      await setCategory(coreAId, "core");
      await setCategory(supportId, "support");

      // 2. Root map groups them correctly
      const rootMap = await getMap();
      expect(rootMap.parent).toBeNull();
      expect(rootMap.groups.management.some((p) => p.id === mgmtId)).toBe(true);
      expect(rootMap.groups.core.some((p) => p.id === coreAId)).toBe(true);
      expect(rootMap.groups.support.some((p) => p.id === supportId)).toBe(true);
      // No cross-band leakage
      expect(rootMap.groups.core.some((p) => p.id === mgmtId)).toBe(false);
      expect(rootMap.groups.management.some((p) => p.id === coreAId)).toBe(
        false,
      );

      // 3. Reorder inside the core band: second core process, then flip
      const coreBId = await createProcess(`e2e-map-core-b-${stamp}`);
      await setCategory(coreBId, "core");

      // Default order (name ASC among unsequenced tiles): a before b
      const beforeReorder = await getMap();
      const coreBefore = beforeReorder.groups.core.map((p) => p.id);
      expect(coreBefore.indexOf(coreAId)).toBeLessThan(
        coreBefore.indexOf(coreBId),
      );

      const reorder = await request.put("/api/v1/processes/map/reorder", {
        data: { category: "core", orderedIds: [coreBId, coreAId] },
      });
      expect(reorder.ok(), await reorder.text()).toBeTruthy();
      expect((await reorder.json()).data.updated).toBe(2);

      const afterReorder = await getMap();
      const coreAfter = afterReorder.groups.core.map((p) => p.id);
      expect(coreAfter.indexOf(coreBId)).toBeLessThan(
        coreAfter.indexOf(coreAId),
      );

      // 4. Child WITHOUT own category inherits the parent band (core)
      const childId = await createProcess(`e2e-map-child-${stamp}`, {
        level: 2,
        parentProcessId: coreAId,
      });

      const drillIn = await getMap(coreAId);
      expect(drillIn.parent).toBeTruthy();
      expect(drillIn.parent!.id).toBe(coreAId);
      expect(drillIn.parent!.effectiveCategory).toBe("core");
      // Child has no own category → inherited into the core band,
      // not into "unassigned".
      expect(drillIn.groups.core.some((p) => p.id === childId)).toBe(true);
      expect(drillIn.groups.unassigned.some((p) => p.id === childId)).toBe(
        false,
      );

      // Parent tile now reports the child on the root map
      const rootAfterChild = await getMap();
      const parentTile = rootAfterChild.groups.core.find(
        (p) => p.id === coreAId,
      );
      expect(parentTile?.childCount).toBeGreaterThanOrEqual(1);
    } finally {
      // Best-effort cleanup — children first (soft delete).
      for (const id of [...createdIds].reverse()) {
        await request.delete(`/api/v1/processes/${id}`).catch(() => undefined);
      }
    }
  });
});
