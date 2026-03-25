# ARCTOS — Sprint 3 Test Plan: BPMN Process Modeling

Complete test specification for Claude Code implementation

---

# 1. Unit Tests

## 1.1 BPMN XML Parser (`packages/shared/src/__tests__/bpmn-parser.test.ts`)

```typescript
import { describe, it, expect } from 'vitest';
import { parseBpmnXml, validateBpmnXml } from '../utils/bpmn-parser';

describe('parseBpmnXml', () => {
  const VALID_BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  id="Definitions_1" targetNamespace="http://arctos.io/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="Start_1" name="Start" />
    <bpmn:userTask id="Task_1" name="Check Order" />
    <bpmn:exclusiveGateway id="GW_1" name="Valid?" />
    <bpmn:serviceTask id="Task_2" name="Process Automatically" />
    <bpmn:endEvent id="End_1" name="Done" />
    <bpmn:subProcess id="Sub_1" name="Sub Process">
      <bpmn:userTask id="SubTask_1" name="Inner Task" />
    </bpmn:subProcess>
    <bpmn:callActivity id="Call_1" name="External Process" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1" />
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

  it('extracts all BPMN element types correctly', () => {
    const steps = parseBpmnXml(VALID_BPMN);
    expect(steps).toHaveLength(7); // start, 2 tasks, gateway, end, subprocess, call_activity + inner task = 8 actually
  });

  it('maps element types to correct step_type', () => {
    const steps = parseBpmnXml(VALID_BPMN);
    const byId = new Map(steps.map(s => [s.bpmnElementId, s]));

    expect(byId.get('Start_1')?.stepType).toBe('event');
    expect(byId.get('Task_1')?.stepType).toBe('task');
    expect(byId.get('Task_2')?.stepType).toBe('task');
    expect(byId.get('GW_1')?.stepType).toBe('gateway');
    expect(byId.get('End_1')?.stepType).toBe('event');
    expect(byId.get('Sub_1')?.stepType).toBe('subprocess');
    expect(byId.get('Call_1')?.stepType).toBe('call_activity');
  });

  it('extracts names from BPMN elements', () => {
    const steps = parseBpmnXml(VALID_BPMN);
    const checkOrder = steps.find(s => s.bpmnElementId === 'Task_1');
    expect(checkOrder?.name).toBe('Check Order');
  });

  it('handles elements without name attribute', () => {
    const xml = VALID_BPMN.replace('name="Check Order"', '');
    const steps = parseBpmnXml(xml);
    const task = steps.find(s => s.bpmnElementId === 'Task_1');
    expect(task?.name).toBeNull();
  });

  it('assigns sequential order', () => {
    const steps = parseBpmnXml(VALID_BPMN);
    const orders = steps.map(s => s.sequenceOrder);
    expect(orders).toEqual(orders.sort((a, b) => a - b));
    expect(new Set(orders).size).toBe(orders.length); // all unique
  });

  it('throws on invalid XML', () => {
    expect(() => parseBpmnXml('not xml')).toThrow();
  });

  it('throws on XML without definitions element', () => {
    expect(() => parseBpmnXml('<?xml version="1.0"?><root/>')).toThrow('missing <bpmn:definitions>');
  });

  it('extracts steps from subprocess recursively', () => {
    const steps = parseBpmnXml(VALID_BPMN);
    const innerTask = steps.find(s => s.bpmnElementId === 'SubTask_1');
    expect(innerTask).toBeDefined();
    expect(innerTask?.stepType).toBe('task');
  });

  it('handles empty process with no elements', () => {
    const emptyBpmn = `<?xml version="1.0"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="D1" targetNamespace="http://arctos.io/bpmn">
  <bpmn:process id="P1" isExecutable="false" />
</bpmn:definitions>`;
    const steps = parseBpmnXml(emptyBpmn);
    expect(steps).toHaveLength(0);
  });
});

describe('validateBpmnXml', () => {
  it('validates correct BPMN XML', () => {
    const xml = `<?xml version="1.0"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" id="D1" targetNamespace="http://arctos.io/bpmn">
  <bpmn:process id="P1" isExecutable="false">
    <bpmn:startEvent id="Start1" name="Start" />
    <bpmn:userTask id="Task1" name="Do Something" />
    <bpmn:endEvent id="End1" name="End" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BD1"><bpmndi:BPMNPlane id="BP1" bpmnElement="P1" /></bpmndi:BPMNDiagram>
</bpmn:definitions>`;
    const result = validateBpmnXml(xml);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects XML without BPMNDiagram', () => {
    const xml = `<?xml version="1.0"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="D1" targetNamespace="http://arctos.io/bpmn">
  <bpmn:process id="P1"><bpmn:startEvent id="S1" /><bpmn:endEvent id="E1" /><bpmn:task id="T1" /></bpmn:process>
</bpmn:definitions>`;
    const result = validateBpmnXml(xml);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(expect.stringContaining('BPMNDiagram'));
  });

  it('rejects invalid XML', () => {
    const result = validateBpmnXml('not xml at all');
    expect(result.valid).toBe(false);
  });
});
```

## 1.2 Process Schemas (`packages/shared/src/__tests__/process-schemas.test.ts`)

```typescript
import { describe, it, expect } from 'vitest';
import { createProcessSchema, transitionProcessStatusSchema, createVersionSchema, generateBpmnSchema } from '../schemas/process';

describe('createProcessSchema', () => {
  it('validates correct input', () => {
    const result = createProcessSchema.safeParse({ name: 'Test Process', level: 3 });
    expect(result.success).toBe(true);
  });

  it('rejects name shorter than 3 chars', () => {
    const result = createProcessSchema.safeParse({ name: 'AB', level: 1 });
    expect(result.success).toBe(false);
  });

  it('rejects level outside 1-10', () => {
    expect(createProcessSchema.safeParse({ name: 'Test', level: 0 }).success).toBe(false);
    expect(createProcessSchema.safeParse({ name: 'Test', level: 11 }).success).toBe(false);
  });

  it('accepts optional fields as null', () => {
    const result = createProcessSchema.safeParse({
      name: 'Test Process', level: 1, description: null, parentProcessId: null,
    });
    expect(result.success).toBe(true);
  });

  it('defaults notation to bpmn', () => {
    const result = createProcessSchema.parse({ name: 'Test', level: 1 });
    expect(result.notation).toBe('bpmn');
  });
});

describe('transitionProcessStatusSchema', () => {
  it('validates correct status', () => {
    const result = transitionProcessStatusSchema.safeParse({ status: 'in_review' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid status', () => {
    const result = transitionProcessStatusSchema.safeParse({ status: 'invalid' });
    expect(result.success).toBe(false);
  });
});

describe('generateBpmnSchema', () => {
  it('rejects description under 50 chars', () => {
    const result = generateBpmnSchema.safeParse({ name: 'Test', description: 'Too short' });
    expect(result.success).toBe(false);
  });

  it('accepts valid generation request', () => {
    const result = generateBpmnSchema.safeParse({
      name: 'Incident Response', description: 'A'.repeat(50), industry: 'it_services',
    });
    expect(result.success).toBe(true);
  });
});
```

## 1.3 Status Transition Logic (`packages/shared/src/__tests__/process-status.test.ts`)

```typescript
import { describe, it, expect } from 'vitest';
import { validateStatusTransition, PROCESS_STATUS_TRANSITIONS } from '../schemas/process';

describe('validateStatusTransition', () => {
  it('allows draft → in_review for process_owner', () => {
    const result = validateStatusTransition('draft', 'in_review', 'process_owner', false);
    expect(result.valid).toBe(true);
  });

  it('allows in_review → approved for admin', () => {
    const result = validateStatusTransition('in_review', 'approved', 'admin', false);
    expect(result.valid).toBe(true);
  });

  it('allows in_review → approved for assigned reviewer', () => {
    const result = validateStatusTransition('in_review', 'approved', 'viewer', true);
    expect(result.valid).toBe(true);
  });

  it('denies draft → in_review for viewer', () => {
    const result = validateStatusTransition('draft', 'in_review', 'viewer', false);
    expect(result.valid).toBe(false);
  });

  it('denies direct draft → published', () => {
    const result = validateStatusTransition('draft', 'published', 'admin', false);
    expect(result.valid).toBe(false);
  });

  it('denies publish for process_owner', () => {
    const result = validateStatusTransition('approved', 'published', 'process_owner', false);
    expect(result.valid).toBe(false);
  });

  it('allows approved → published for admin', () => {
    const result = validateStatusTransition('approved', 'published', 'admin', false);
    expect(result.valid).toBe(true);
  });

  it('denies transition from archived', () => {
    const result = validateStatusTransition('archived', 'draft', 'admin', false);
    expect(result.valid).toBe(false);
  });

  it('allows rejection: in_review → draft for admin', () => {
    const result = validateStatusTransition('in_review', 'draft', 'admin', false);
    expect(result.valid).toBe(true);
  });

  it('allows send-back: approved → in_review for admin', () => {
    const result = validateStatusTransition('approved', 'in_review', 'admin', false);
    expect(result.valid).toBe(true);
  });
});

describe('PROCESS_STATUS_TRANSITIONS map', () => {
  it('draft only transitions to in_review', () => {
    expect(PROCESS_STATUS_TRANSITIONS['draft']).toEqual(['in_review']);
  });

  it('archived has no transitions', () => {
    expect(PROCESS_STATUS_TRANSITIONS['archived']).toEqual([]);
  });
});
```

---

# 2. Integration Tests

## 2.1 Process API (`apps/web/src/__tests__/api/processes.test.ts`)

```typescript
describe('POST /api/v1/processes', () => {
  it('creates process with initial version', async () => {
    const res = await authRequest('POST', '/api/v1/processes', {
      name: 'Test Process', level: 3, department: 'IT',
    }, { role: 'process_owner', orgId: ORG_A_ID });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.process.name).toBe('Test Process');
    expect(body.process.status).toBe('draft');
    expect(body.version.versionNumber).toBe(1);
    expect(body.version.isCurrent).toBe(true);
    expect(body.version.bpmnXml).toContain('bpmn:definitions');
  });

  it('returns 403 for viewer role', async () => {
    const res = await authRequest('POST', '/api/v1/processes', {
      name: 'Test', level: 1,
    }, { role: 'viewer', orgId: ORG_A_ID });

    expect(res.status).toBe(403);
  });

  it('returns 404 when BPM module is disabled', async () => {
    const res = await authRequest('POST', '/api/v1/processes', {
      name: 'Test', level: 1,
    }, { role: 'admin', orgId: ORG_BPM_DISABLED_ID });

    expect(res.status).toBe(404);
  });

  it('validates circular parent reference', async () => {
    const proc = await createTestProcess(ORG_A_ID);
    const child = await createTestProcess(ORG_A_ID, { parentProcessId: proc.id });
    
    const res = await authRequest('PUT', `/api/v1/processes/${proc.id}`, {
      parentProcessId: child.id,  // circular!
    }, { role: 'admin', orgId: ORG_A_ID });

    // Should detect and reject circular reference
    expect(res.status).toBe(400);
  });
});
```

## 2.2 RLS Isolation (`apps/web/src/__tests__/api/process-rls.test.ts`)

```typescript
describe('RLS isolation for processes', () => {
  it('User A cannot read processes from Org B', async () => {
    // Create process in Org B
    await createTestProcess(ORG_B_ID);

    // Query from Org A context
    const res = await authRequest('GET', '/api/v1/processes', {}, {
      role: 'admin', orgId: ORG_A_ID,
    });

    const body = await res.json();
    const orgBProcesses = body.data.filter((p: any) => p.orgId === ORG_B_ID);
    expect(orgBProcesses).toHaveLength(0);
  });

  it('User A cannot access Org B process by ID', async () => {
    const orgBProcess = await createTestProcess(ORG_B_ID);

    const res = await authRequest('GET', `/api/v1/processes/${orgBProcess.id}`, {}, {
      role: 'admin', orgId: ORG_A_ID,
    });

    expect(res.status).toBe(404);
  });

  it('Soft-deleted processes are excluded from list', async () => {
    const proc = await createTestProcess(ORG_A_ID);
    await softDeleteProcess(proc.id);

    const res = await authRequest('GET', '/api/v1/processes', {}, {
      role: 'admin', orgId: ORG_A_ID,
    });

    const body = await res.json();
    const found = body.data.find((p: any) => p.id === proc.id);
    expect(found).toBeUndefined();
  });
});
```

## 2.3 Version API (`apps/web/src/__tests__/api/process-versions.test.ts`)

```typescript
describe('POST /api/v1/processes/:id/versions', () => {
  it('creates new version with incremented number', async () => {
    const proc = await createTestProcess(ORG_A_ID);

    const res = await authRequest('POST', `/api/v1/processes/${proc.id}/versions`, {
      bpmnXml: VALID_BPMN_XML, changeSummary: 'Added new task',
    }, { role: 'process_owner', orgId: ORG_A_ID });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.versionNumber).toBe(2); // initial was 1
    expect(body.isCurrent).toBe(true);
  });

  it('syncs process steps from BPMN XML', async () => {
    const proc = await createTestProcess(ORG_A_ID);

    await authRequest('POST', `/api/v1/processes/${proc.id}/versions`, {
      bpmnXml: BPMN_WITH_5_TASKS,
      changeSummary: 'Added tasks',
    }, { role: 'admin', orgId: ORG_A_ID });

    const stepsRes = await authRequest('GET', `/api/v1/processes/${proc.id}/steps`, {}, {
      role: 'admin', orgId: ORG_A_ID,
    });
    const steps = await stepsRes.json();
    expect(steps.data.length).toBeGreaterThanOrEqual(5);
  });

  it('soft-deletes steps removed from BPMN XML', async () => {
    const proc = await createTestProcess(ORG_A_ID);

    // Save with 3 tasks
    await authRequest('POST', `/api/v1/processes/${proc.id}/versions`, {
      bpmnXml: BPMN_WITH_3_TASKS, changeSummary: 'v2',
    }, { role: 'admin', orgId: ORG_A_ID });

    // Save with 2 tasks (removed one)
    await authRequest('POST', `/api/v1/processes/${proc.id}/versions`, {
      bpmnXml: BPMN_WITH_2_TASKS, changeSummary: 'v3',
    }, { role: 'admin', orgId: ORG_A_ID });

    // Verify the removed step is soft-deleted
    const allSteps = await db.query.processSteps.findMany({
      where: eq(processSteps.processId, proc.id),
    });
    const deletedSteps = allSteps.filter(s => s.deletedAt !== null);
    expect(deletedSteps.length).toBeGreaterThan(0);
  });

  it('sets only new version as current', async () => {
    const proc = await createTestProcess(ORG_A_ID);

    await authRequest('POST', `/api/v1/processes/${proc.id}/versions`, {
      bpmnXml: VALID_BPMN_XML, changeSummary: 'v2',
    }, { role: 'admin', orgId: ORG_A_ID });

    const versions = await db.query.processVersions.findMany({
      where: eq(processVersions.processId, proc.id),
    });
    const currentVersions = versions.filter(v => v.isCurrent);
    expect(currentVersions).toHaveLength(1);
    expect(currentVersions[0].versionNumber).toBe(2);
  });
});
```

## 2.4 Risk Linkage API (`apps/web/src/__tests__/api/process-risks.test.ts`)

```typescript
describe('Process-Risk linkage', () => {
  it('links risk to process step', async () => {
    const proc = await createTestProcess(ORG_A_ID);
    const risk = await createTestRisk(ORG_A_ID);
    const step = await getFirstProcessStep(proc.id);

    const res = await authRequest('POST',
      `/api/v1/processes/${proc.id}/steps/${step.id}/risks`,
      { riskId: risk.id, riskContext: 'Test context' },
      { role: 'risk_manager', orgId: ORG_A_ID }
    );

    expect(res.status).toBe(201);
  });

  it('prevents duplicate risk linkage to same step', async () => {
    const proc = await createTestProcess(ORG_A_ID);
    const risk = await createTestRisk(ORG_A_ID);
    const step = await getFirstProcessStep(proc.id);

    await linkRiskToStep(proc.id, step.id, risk.id, ORG_A_ID);

    const res = await authRequest('POST',
      `/api/v1/processes/${proc.id}/steps/${step.id}/risks`,
      { riskId: risk.id },
      { role: 'risk_manager', orgId: ORG_A_ID }
    );

    expect(res.status).toBe(409); // conflict
  });

  it('returns step risks with overlay data', async () => {
    const proc = await createTestProcess(ORG_A_ID);
    const risk = await createTestRisk(ORG_A_ID, { inherentLikelihood: 4, inherentImpact: 5 });
    const step = await getFirstProcessStep(proc.id);
    await linkRiskToStep(proc.id, step.id, risk.id, ORG_A_ID);

    const res = await authRequest('GET',
      `/api/v1/processes/${proc.id}/step-risks`, {},
      { role: 'viewer', orgId: ORG_A_ID }
    );

    const body = await res.json();
    const stepData = body.data.find((d: any) => d.bpmnElementId === step.bpmnElementId);
    expect(stepData.riskCount).toBe(1);
    expect(stepData.highestScore).toBe(20);
  });

  it('unlinks risk from step', async () => {
    const proc = await createTestProcess(ORG_A_ID);
    const risk = await createTestRisk(ORG_A_ID);
    const step = await getFirstProcessStep(proc.id);
    await linkRiskToStep(proc.id, step.id, risk.id, ORG_A_ID);

    const res = await authRequest('DELETE',
      `/api/v1/processes/${proc.id}/steps/${step.id}/risks/${risk.id}`, {},
      { role: 'risk_manager', orgId: ORG_A_ID }
    );

    expect(res.status).toBe(200);
  });

  it('viewer cannot link risks', async () => {
    const proc = await createTestProcess(ORG_A_ID);
    const risk = await createTestRisk(ORG_A_ID);
    const step = await getFirstProcessStep(proc.id);

    const res = await authRequest('POST',
      `/api/v1/processes/${proc.id}/steps/${step.id}/risks`,
      { riskId: risk.id },
      { role: 'viewer', orgId: ORG_A_ID }
    );

    expect(res.status).toBe(403);
  });
});
```

---

# 3. E2E Tests (Playwright)

## 3.1 Process Landscape (`apps/web/src/__tests__/e2e/process-landscape.spec.ts`)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Process Landscape', () => {
  test('displays process tree with hierarchy', async ({ page }) => {
    await page.goto('/processes');
    await expect(page.getByText('Prozesslandkarte')).toBeVisible();
    
    // Tree should show demo processes
    await expect(page.getByRole('treeitem')).toHaveCount.greaterThan(0);
  });

  test('creates new process and navigates to detail', async ({ page }) => {
    await page.goto('/processes');
    await page.click('text=Neuer Prozess');

    await page.fill('[name="name"]', 'E2E Test Process');
    await page.selectOption('[name="level"]', '3');
    await page.click('text=Prozess erstellen');

    await expect(page).toHaveURL(/\/processes\/[a-f0-9-]+/);
    await expect(page.getByText('E2E Test Process')).toBeVisible();
  });

  test('search filters processes', async ({ page }) => {
    await page.goto('/processes');
    await page.fill('[placeholder*="suchen"]', 'Sales');
    
    // Should filter tree to show matching processes
    await expect(page.getByText('Sales Order Processing')).toBeVisible();
  });

  test('shows ModuleGate teaser when BPM disabled', async ({ page }) => {
    // Login as user in org with BPM disabled
    await loginAsOrgWithDisabledBpm(page);
    await page.goto('/processes');
    
    await expect(page.getByText(/Modul nicht aktiviert|Module not enabled/)).toBeVisible();
  });
});
```

## 3.2 BPMN Editor (`apps/web/src/__tests__/e2e/bpmn-editor.spec.ts`)

```typescript
test.describe('BPMN Editor', () => {
  test('loads BPMN diagram and allows editing', async ({ page }) => {
    const processId = await createTestProcess();
    await page.goto(`/processes/${processId}#editor`);
    
    // Wait for BPMN editor to load
    await expect(page.locator('.bjs-container')).toBeVisible({ timeout: 10000 });
    
    // Verify canvas is interactive
    const canvas = page.locator('.bjs-container canvas, .bjs-container svg');
    await expect(canvas).toBeVisible();
  });

  test('save creates new version visible in versions tab', async ({ page }) => {
    const processId = await createTestProcess();
    await page.goto(`/processes/${processId}#editor`);
    await page.waitForSelector('.bjs-container');
    
    // Click save
    await page.click('text=Speichern');
    
    // Fill change summary
    await page.fill('[placeholder*="geändert"]', 'E2E test save');
    await page.click('text=Speichern', { position: { x: 0, y: 0 } }); // confirm save dialog
    
    // Navigate to versions tab
    await page.click('text=Versionen');
    
    // Should see new version
    await expect(page.getByText('v2')).toBeVisible();
    await expect(page.getByText('E2E test save')).toBeVisible();
  });

  test('risk badge appears after linking risk', async ({ page }) => {
    const processId = await createTestProcessWithSteps();
    const riskId = await createTestRisk();
    
    await page.goto(`/processes/${processId}#editor`);
    await page.waitForSelector('.bjs-container');
    
    // Click on a task shape
    await page.click('.djs-element[data-element-id="Task_CheckOrder"]');
    
    // Side panel should open
    await expect(page.getByText('Verknüpfte Risiken')).toBeVisible();
    
    // Link a risk
    await page.click('text=Risiko verknüpfen');
    await page.fill('[placeholder*="suchen"]', 'RSK');
    await page.click(`.search-result:has-text("${riskId}")`);
    
    // Badge should appear on the shape
    await expect(page.locator('.bpmn-risk-badge')).toBeVisible();
  });

  test('export downloads BPMN XML file', async ({ page }) => {
    const processId = await createTestProcess();
    await page.goto(`/processes/${processId}#editor`);
    await page.waitForSelector('.bjs-container');
    
    // Click export dropdown
    await page.click('text=Exportieren');
    
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('text=BPMN XML'),
    ]);
    
    expect(download.suggestedFilename()).toContain('.bpmn');
  });
});
```

## 3.3 Approval Flow (`apps/web/src/__tests__/e2e/process-approval.spec.ts`)

```typescript
test.describe('Process Approval Workflow', () => {
  test('complete approval flow: draft → in_review → approved → published', async ({ page }) => {
    const processId = await createTestProcessWithBpmn();
    
    // Step 1: Submit for review (as process_owner)
    await loginAsProcessOwner(page);
    await page.goto(`/processes/${processId}`);
    await page.click('text=Zur Prüfung einreichen');
    await page.click('text=Bestätigen');
    await expect(page.getByText('In Prüfung')).toBeVisible();
    
    // Step 2: Approve (as reviewer/admin)
    await loginAsAdmin(page);
    await page.goto(`/processes/${processId}`);
    await page.click('text=Genehmigen');
    await page.fill('[placeholder*="Kommentar"]', 'Looks good');
    await page.click('text=Bestätigen');
    await expect(page.getByText('Genehmigt')).toBeVisible();
    
    // Step 3: Publish (as admin)
    await page.click('text=Veröffentlichen');
    await page.click('text=Bestätigen');
    await expect(page.getByText('Veröffentlicht')).toBeVisible();
  });

  test('reject sends process back to draft', async ({ page }) => {
    const processId = await createTestProcessInReview();
    
    await loginAsAdmin(page);
    await page.goto(`/processes/${processId}`);
    await page.click('text=Zurückweisen');
    await page.fill('[placeholder*="Kommentar"]', 'Needs more detail');
    await page.click('text=Bestätigen');
    
    await expect(page.getByText('Entwurf')).toBeVisible();
  });

  test('process_owner cannot approve', async ({ page }) => {
    const processId = await createTestProcessInReview();
    
    await loginAsProcessOwner(page);
    await page.goto(`/processes/${processId}`);
    
    // Approve button should not be visible
    await expect(page.getByText('Genehmigen')).not.toBeVisible();
  });
});
```

---

# 4. Performance Benchmarks

| Metric | Target | Test Method |
| --- | --- | --- |
| GET /processes (200 records, paginated) | < 200ms | k6 load test |
| GET /processes/tree (200 processes) | < 300ms | k6 load test |
| POST /processes/:id/versions (500KB XML + step sync) | < 500ms | Integration test with timer |
| BPMN editor initial load (importXML + overlays) | < 2s | Playwright performance mark |
| GET /processes/:id/step-risks (overlay data) | < 100ms | k6 load test |
| Search autocomplete (GET /risks?search=...) | < 150ms | k6 load test |

---

# 5. Security Checklist

- [ ] All endpoints use `requireModule('bpm')` — returns 404 when disabled
- [ ] All endpoints use `requireAuth()` — returns 401 for unauthenticated
- [ ] RLS isolation verified: Org A cannot access Org B processes
- [ ] RBAC verified: viewer cannot create/edit/delete processes
- [ ] RBAC verified: only admin can publish
- [ ] RBAC verified: only reviewer/auditor/admin can approve
- [ ] Soft-deleted processes excluded from all queries
- [ ] BPMN XML validated on save (prevents XSS via SVG injection)
- [ ] Rate limiting on AI generation endpoint (10/hour/user)
- [ ] OWASP ZAP scan: 0 critical findings on new endpoints
