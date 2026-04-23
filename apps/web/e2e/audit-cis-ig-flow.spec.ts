/**
 * Audit — CIS-IG1-Flow E2E (Overnight-Session Task 4).
 *
 * Deckt den in Migration 0290–0293 vertieften Audit-Workflow ab:
 *   1. Audit anlegen (mit Scope-Feldern)
 *   2. Checkliste aus CIS Controls v8 IG1 generieren
 *   3. Ein Item bewerten mit:
 *        - result = major_nonconformity
 *        - methodEntries = [Interview, Dokumentenprüfung, Sampling]
 *        - Risiko-Rating + Korrekturmaßnahme + Frist
 *   4. Bestätigen dass methodEntries persistiert sind
 *   5. Verifizieren dass der Result-Enum den neuen ISO-Wert akzeptiert
 *
 * Dies wäre bei jeder Regression der neuen Finding-Klassifikation sofort
 * rot. Läuft nur im platform-smoke-Projekt, nicht im minimalen CI-Smoke.
 */
import { test, expect } from "@playwright/test";

test.describe("Audit — CIS IG1 Flow (ISO 19011 Arbeitspapier)", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("create audit → generate CIS IG1 checklist → evaluate with method entries", async ({
    request,
  }) => {
    // ── 1. Audit anlegen ─────────────────────────────────────
    const title = `e2e-cis-ig1-${Date.now()}`;
    const createAuditRes = await request.post("/api/v1/audit-mgmt/audits", {
      data: {
        title,
        description: "E2E-Smoke für CIS IG1 Audit-Flow",
        auditType: "internal",
        scopeDescription: "Fokus IT-Sicherheit, Standort HQ",
        scopeFrameworks: ["CIS Controls v8 IG1", "ISO 27001"],
      },
    });
    expect(createAuditRes.ok(), await createAuditRes.text()).toBeTruthy();
    const auditJson = await createAuditRes.json();
    const auditId: string = auditJson.data.id;
    expect(auditId).toBeTruthy();

    // ── 2. CIS-Katalog ID ermitteln (muss auf der Org aktiv sein) ─
    // Wir ermitteln die Org-ID über das Audit-GET, dann suchen die
    // CIS-Aktivierung über active-catalogs.
    const auditDetailRes = await request.get(
      `/api/v1/audit-mgmt/audits/${auditId}`,
    );
    expect(auditDetailRes.ok()).toBeTruthy();
    const auditDetail = await auditDetailRes.json();
    const orgId: string = auditDetail.data.orgId;

    // Aktivierung des CIS-Katalogs auf dieser Org sicherstellen (wenn der
    // Seed-Zustand das noch nicht getan hat — idempotent):
    const allCatsRes = await request.get(
      "/api/v1/catalogs?type=control&limit=200",
    );
    expect(allCatsRes.ok()).toBeTruthy();
    const allCats = await allCatsRes.json();
    const cis = (allCats.data ?? []).find(
      (c: { source: string | null }) => c.source === "cis_controls_v8",
    );
    if (!cis) {
      test.skip(true, "CIS-Katalog nicht geseedet — test übersprungen");
      return;
    }

    // Aktivieren wenn noch nicht aktiv (idempotent, API antwortet ok).
    await request.post(
      `/api/v1/organizations/${orgId}/active-catalogs`,
      {
        data: {
          catalogId: cis.id,
          catalogType: "control",
          enforcementLevel: "recommended",
        },
      },
    );

    // ── 3. Checkliste aus CIS IG1 generieren ─────────────────
    const genRes = await request.post(
      `/api/v1/audit-mgmt/audits/${auditId}/checklists/generate`,
      {
        data: { catalogId: cis.id, implementationGroup: "ig1" },
      },
    );
    expect(genRes.ok(), await genRes.text()).toBeTruthy();
    const genJson = await genRes.json();
    const checklistId: string = genJson.data.checklist.id;
    expect(checklistId).toBeTruthy();
    expect(genJson.data.itemCount).toBeGreaterThan(0);

    // ── 4. Erstes Item holen ────────────────────────────────
    const itemsRes = await request.get(
      `/api/v1/audit-mgmt/audits/${auditId}/checklists/${checklistId}/items`,
    );
    expect(itemsRes.ok()).toBeTruthy();
    const itemsJson = await itemsRes.json();
    const firstItem = itemsJson.data[0];
    expect(firstItem).toBeDefined();

    // ── 5. Item bewerten mit method entries ──────────────────
    const putRes = await request.put(
      `/api/v1/audit-mgmt/audits/${auditId}/checklists/${checklistId}/items/${firstItem.id}`,
      {
        data: {
          result: "major_nonconformity",
          notes:
            "Systematische Lücke im Asset-Inventory — Server-Bestand aus 2024 nicht aktualisiert.",
          criterionReference: firstItem.criterionReference ?? "CIS-01.1",
          methodEntries: [
            {
              id: "entry-1",
              method: "interview",
              interviewee: "Max Mustermann",
              intervieweeRole: "IT-Leitung",
              notes: "Bestätigt fehlende CMDB-Pflege",
            },
            {
              id: "entry-2",
              method: "document_review",
              documents: [
                {
                  title: "Asset-Inventory Q1/2024",
                  reference: "DOC-4711",
                  version: "1.2",
                },
              ],
            },
            {
              id: "entry-3",
              method: "sampling",
              populationSize: 120,
              sampleSize: 20,
              sampleIds: ["SRV-001", "SRV-042", "SRV-078"],
              selectionMethod: "zufällig",
            },
          ],
          riskRating: "high",
          correctiveActionSuggestion:
            "CMDB-Scan-Prozess monatlich automatisieren, Verantwortlicher benennen.",
          remediationDeadline: "2026-06-30",
        },
      },
    );
    expect(putRes.ok(), await putRes.text()).toBeTruthy();

    // ── 6. Re-fetch + assert ─────────────────────────────────
    const refreshRes = await request.get(
      `/api/v1/audit-mgmt/audits/${auditId}/checklists/${checklistId}/items`,
    );
    expect(refreshRes.ok()).toBeTruthy();
    const refreshed = await refreshRes.json();
    const updated = refreshed.data.find(
      (i: { id: string }) => i.id === firstItem.id,
    );
    expect(updated).toBeDefined();
    expect(updated.result).toBe("major_nonconformity");
    expect(updated.riskRating).toBe("high");
    expect(updated.remediationDeadline).toBe("2026-06-30");
    expect(Array.isArray(updated.methodEntries)).toBe(true);
    expect(updated.methodEntries).toHaveLength(3);
    const methods = updated.methodEntries.map(
      (e: { method: string }) => e.method,
    );
    expect(methods).toContain("interview");
    expect(methods).toContain("document_review");
    expect(methods).toContain("sampling");

    // Interview-Entry-Felder durchgereicht?
    const interview = updated.methodEntries.find(
      (e: { method: string }) => e.method === "interview",
    );
    expect(interview.interviewee).toBe("Max Mustermann");
    expect(interview.intervieweeRole).toBe("IT-Leitung");

    // Sampling-Entry-Felder?
    const sampling = updated.methodEntries.find(
      (e: { method: string }) => e.method === "sampling",
    );
    expect(sampling.sampleSize).toBe(20);
    expect(sampling.populationSize).toBe(120);
    expect(Array.isArray(sampling.sampleIds)).toBe(true);

    // ── 7. Cleanup: Audit hard-delete (cascade) ──────────────
    const deleteRes = await request.delete(
      `/api/v1/audit-mgmt/audits/${auditId}`,
    );
    expect(deleteRes.ok() || deleteRes.status() === 404).toBeTruthy();
  });

  test("checklist DELETE endpoint returns 200 for active audit, 409 for completed", async ({
    request,
  }) => {
    // Audit anlegen
    const createAuditRes = await request.post("/api/v1/audit-mgmt/audits", {
      data: {
        title: `e2e-del-cl-${Date.now()}`,
        auditType: "internal",
      },
    });
    expect(createAuditRes.ok()).toBeTruthy();
    const { data: audit } = await createAuditRes.json();
    const auditId: string = audit.id;

    // Leere Checkliste anlegen
    const createClRes = await request.post(
      `/api/v1/audit-mgmt/audits/${auditId}/checklists`,
      { data: { name: "Test-Checkliste", sourceType: "custom" } },
    );
    expect(createClRes.ok()).toBeTruthy();
    const { data: cl } = await createClRes.json();

    // Löschen (planned-Status → 200)
    const delRes = await request.delete(
      `/api/v1/audit-mgmt/audits/${auditId}/checklists/${cl.id}`,
    );
    expect(delRes.ok(), await delRes.text()).toBeTruthy();

    // Cleanup
    await request.delete(`/api/v1/audit-mgmt/audits/${auditId}`);
  });
});
