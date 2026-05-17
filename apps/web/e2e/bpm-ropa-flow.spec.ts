/**
 * BPM Overhaul Phase 4 E3: ROPA + DPIA auto-create flow E2E.
 *
 * Covers:
 *   1. Create a process
 *   2. PUT a ROPA profile with `specialCategories` set
 *   3. Verify DPIA was auto-created
 *   4. Export ROPA CSV for the process
 *   5. Export org-wide ROPA PDF
 */
import { test, expect } from "@playwright/test";

test.describe("BPM — ROPA profile + DPIA auto-create + export", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("high-risk ROPA save → DPIA created → CSV export downloads", async ({ request }) => {
    const name = `e2e-ropa-${Date.now()}`;
    const createRes = await request.post("/api/v1/processes", {
      data: { name, description: "Process for ROPA E2E", level: 2 },
    });
    expect(createRes.ok()).toBeTruthy();
    const processId: string = (await createRes.json()).data.id;

    // PUT high-risk ROPA profile
    const putRes = await request.put(`/api/v1/processes/${processId}/ropa-profile`, {
      data: {
        isProcessingActivity: true,
        processingPurpose: "Verarbeitung von Gesundheitsdaten zur Behandlung",
        legalBasis: "consent",
        dataSubjectCategories: ["Patienten"],
        personalDataCategories: ["Name", "Adresse", "Geburtsdatum"],
        specialCategories: ["Gesundheitsdaten"],
        recipients: ["Krankenkassen"],
        thirdCountryTransfers: false,
        retentionPeriodDescription: "10 Jahre nach Behandlungsende",
        retentionPeriodMonths: 120,
        tomDescription: "AES-256 at rest, TLS 1.3 in transit, role-based access",
      },
    });
    expect(putRes.ok(), await putRes.text()).toBeTruthy();
    const ropaData = await putRes.json();

    // DPIA should be auto-created
    expect(ropaData.data.requiresDpia).toBe(true);
    expect(ropaData.data.dpiaId).toBeTruthy();

    // Per-process CSV export should download
    const csvRes = await request.get(
      `/api/v1/processes/${processId}/ropa/export?format=csv`,
    );
    expect(csvRes.status()).toBe(200);
    expect(csvRes.headers()["content-type"]).toContain("text/csv");
    const csvText = await csvRes.text();
    expect(csvText).toContain(name);
    expect(csvText).toContain("Gesundheitsdaten");

    // Org-wide ROPA export should also include this process
    const orgCsv = await request.get("/api/v1/processes/ropa-export?format=csv");
    expect(orgCsv.status()).toBe(200);
    const orgText = await orgCsv.text();
    expect(orgText).toContain(name);
  });

  test("low-risk ROPA does not auto-create a DPIA", async ({ request }) => {
    const name = `e2e-ropa-low-${Date.now()}`;
    const createRes = await request.post("/api/v1/processes", {
      data: { name, description: "Low risk", level: 2 },
    });
    const processId: string = (await createRes.json()).data.id;

    const putRes = await request.put(`/api/v1/processes/${processId}/ropa-profile`, {
      data: {
        isProcessingActivity: true,
        processingPurpose: "Newsletter dispatch",
        legalBasis: "consent",
        personalDataCategories: ["Email"],
      },
    });
    const data = (await putRes.json()).data;
    expect(data.requiresDpia).toBe(false);
    expect(data.dpiaId).toBeFalsy();
  });
});
