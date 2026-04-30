import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

// E2E-105: Nichtkonformitäts-Lifecycle (REQ-ISMS-031, REQ-ISMS-032)
// Verifiziert die in Closure CL-NC-001 implementierte State-Machine + Closure-Gate.

test("E2E-105: NC creation, valid transition, forbidden jump, closure-gate", async ({
  page,
}) => {
  await login(page);

  // 1. NC anlegen
  const create = await page.evaluate(async () => {
    const r = await fetch("/api/v1/isms/nonconformities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "E2E-105 Test-NC",
        description: "Test der NC-State-Machine",
        sourceType: "internal_audit",
        severity: "minor",
        isoClause: "10.1",
      }),
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  });
  expect(create.status).toBe(201);
  const ncId = create.body?.id ?? create.body?.data?.id;
  expect(ncId).toBeTruthy();

  // 2. Verbotener Sprung open → closed
  const forbidden = await page.evaluate(async (id) => {
    const r = await fetch(`/api/v1/isms/nonconformities/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "closed" }),
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  }, ncId);
  expect(forbidden.status).toBe(422);
  expect(forbidden.body?.error).toContain("transition");

  // 3. Erlaubter Übergang open → analysis
  const valid = await page.evaluate(async (id) => {
    const r = await fetch(`/api/v1/isms/nonconformities/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "analysis" }),
    });
    return r.status;
  }, ncId);
  expect(valid).toBe(200);

  // 4. Closure ohne CA blockiert (REQ-ISMS-032)
  // Erst durch alle Phasen gehen, dann versuchen zu schließen ohne CA
  await page.evaluate(async (id) => {
    await fetch(`/api/v1/isms/nonconformities/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "action_planned" }),
    });
    await fetch(`/api/v1/isms/nonconformities/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "in_progress" }),
    });
    await fetch(`/api/v1/isms/nonconformities/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "verification" }),
    });
  }, ncId);

  const closeNoCa = await page.evaluate(async (id) => {
    const r = await fetch(`/api/v1/isms/nonconformities/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "closed" }),
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  }, ncId);
  expect(closeNoCa.status).toBe(422);
  expect(closeNoCa.body?.error).toMatch(/Cannot close|corrective action/i);
});
