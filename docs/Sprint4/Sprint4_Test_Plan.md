# ARCTOS — Sprint 4 Test Plan: ICS + DMS Module

Complete test specification for Claude Code implementation

---

# 1. Unit Tests

## 1.1 Control Schema Validation (`packages/shared/src/__tests__/control-schema.test.ts`)

```typescript
import { describe, it, expect } from 'vitest';
import {
  createControlSchema,
  controlListQuerySchema,
  executeTestSchema,
  createFindingSchema,
  isValidControlStatusTransition,
  isValidFindingStatusTransition,
  createCampaignSchema,
  createRiskControlLinkSchema,
} from '../schemas/control';

describe('createControlSchema', () => {
  it('validates a complete control', () => {
    const result = createControlSchema.safeParse({
      title: 'Multi-Faktor-Authentifizierung',
      description: 'MFA für alle administrativen Zugänge.',
      controlType: 'preventive',
      frequency: 'continuous',
      automationLevel: 'fully_automated',
      lineOfDefense: 'first',
      assertions: ['fraud_prevention', 'safeguarding_of_assets'],
    });
    expect(result.success).toBe(true);
  });

  it('requires title', () => {
    const result = createControlSchema.safeParse({
      controlType: 'detective',
    });
    expect(result.success).toBe(false);
  });

  it('rejects title exceeding 500 chars', () => {
    const result = createControlSchema.safeParse({
      title: 'x'.repeat(501),
      controlType: 'preventive',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid control_type', () => {
    const result = createControlSchema.safeParse({
      title: 'Test',
      controlType: 'proactive', // invalid
    });
    expect(result.success).toBe(false);
  });

  it('accepts all 8 valid frequency values (K-NEW-03)', () => {
    const freqs = ['event_driven', 'continuous', 'daily', 'weekly', 'monthly', 'quarterly', 'annually', 'ad_hoc'];
    for (const freq of freqs) {
      const result = createControlSchema.safeParse({
        title: 'Test',
        controlType: 'preventive',
        frequency: freq,
      });
      expect(result.success, `frequency '${freq}' should be valid`).toBe(true);
    }
  });

  it('validates all 8 COSO assertion types (K-NEW-02)', () => {
    const assertions = [
      'completeness', 'accuracy', 'obligations_and_rights', 'fraud_prevention',
      'existence', 'valuation', 'presentation', 'safeguarding_of_assets',
    ];
    const result = createControlSchema.safeParse({
      title: 'Full COSO Control',
      controlType: 'detective',
      assertions,
    });
    expect(result.success).toBe(true);
    expect(result.data?.assertions).toHaveLength(8);
  });

  it('defaults frequency to monthly', () => {
    const result = createControlSchema.parse({
      title: 'Test',
      controlType: 'preventive',
    });
    expect(result.frequency).toBe('monthly');
  });

  it('defaults automationLevel to manual', () => {
    const result = createControlSchema.parse({
      title: 'Test',
      controlType: 'preventive',
    });
    expect(result.automationLevel).toBe('manual');
  });

  it('defaults assertions to empty array', () => {
    const result = createControlSchema.parse({
      title: 'Test',
      controlType: 'corrective',
    });
    expect(result.assertions).toEqual([]);
  });
});

describe('isValidControlStatusTransition', () => {
  it('allows designed → implemented', () => {
    expect(isValidControlStatusTransition('designed', 'implemented')).toBe(true);
  });

  it('allows implemented → effective', () => {
    expect(isValidControlStatusTransition('implemented', 'effective')).toBe(true);
  });

  it('allows implemented → ineffective', () => {
    expect(isValidControlStatusTransition('implemented', 'ineffective')).toBe(true);
  });

  it('allows effective ↔ ineffective (both directions)', () => {
    expect(isValidControlStatusTransition('effective', 'ineffective')).toBe(true);
    expect(isValidControlStatusTransition('ineffective', 'effective')).toBe(true);
  });

  it('allows effective/ineffective → retired', () => {
    expect(isValidControlStatusTransition('effective', 'retired')).toBe(true);
    expect(isValidControlStatusTransition('ineffective', 'retired')).toBe(true);
  });

  it('allows reopen to designed from any status', () => {
    for (const status of ['implemented', 'effective', 'ineffective', 'retired']) {
      expect(isValidControlStatusTransition(status, 'designed')).toBe(true);
    }
  });

  it('rejects designed → effective (must go through implemented)', () => {
    expect(isValidControlStatusTransition('designed', 'effective')).toBe(false);
  });

  it('rejects designed → retired', () => {
    expect(isValidControlStatusTransition('designed', 'retired')).toBe(false);
  });
});

describe('executeTestSchema (K-NEW-01: separate ToD/ToE)', () => {
  it('accepts independent ToD and ToE results', () => {
    const result = executeTestSchema.safeParse({
      todResult: 'effective',
      toeResult: 'ineffective',
      todNotes: 'Design is sound.',
      toeNotes: 'MFA not enforced on service accounts.',
      executedDate: '2026-03-25',
    });
    expect(result.success).toBe(true);
  });

  it('allows setting only ToD without ToE', () => {
    const result = executeTestSchema.safeParse({
      todResult: 'effective',
    });
    expect(result.success).toBe(true);
  });

  it('allows setting only ToE without ToD', () => {
    const result = executeTestSchema.safeParse({
      toeResult: 'partially_effective',
    });
    expect(result.success).toBe(true);
  });
});

describe('createFindingSchema (K-NEW-04: BIC finding taxonomy)', () => {
  it('validates all 5 severity levels', () => {
    const severities = [
      'observation', 'recommendation', 'improvement_requirement',
      'insignificant_nonconformity', 'significant_nonconformity',
    ];
    for (const severity of severities) {
      const result = createFindingSchema.safeParse({
        title: `Finding with ${severity}`,
        severity,
      });
      expect(result.success, `severity '${severity}' should be valid`).toBe(true);
    }
  });

  it('validates all 5 source types', () => {
    const sources = ['control_test', 'audit', 'incident', 'self_assessment', 'external'];
    for (const source of sources) {
      const result = createFindingSchema.safeParse({
        title: 'Test Finding',
        severity: 'observation',
        source,
      });
      expect(result.success, `source '${source}' should be valid`).toBe(true);
    }
  });
});

describe('isValidFindingStatusTransition', () => {
  it('allows identified → in_remediation', () => {
    expect(isValidFindingStatusTransition('identified', 'in_remediation')).toBe(true);
  });

  it('allows identified → accepted', () => {
    expect(isValidFindingStatusTransition('identified', 'accepted')).toBe(true);
  });

  it('allows in_remediation → remediated → verified → closed', () => {
    expect(isValidFindingStatusTransition('in_remediation', 'remediated')).toBe(true);
    expect(isValidFindingStatusTransition('remediated', 'verified')).toBe(true);
    expect(isValidFindingStatusTransition('verified', 'closed')).toBe(true);
  });

  it('rejects skipping verification (remediated → closed)', () => {
    expect(isValidFindingStatusTransition('remediated', 'closed')).toBe(false);
  });

  it('allows reopen from closed', () => {
    expect(isValidFindingStatusTransition('closed', 'identified')).toBe(true);
  });
});

describe('createCampaignSchema', () => {
  it('requires at least one controlId', () => {
    const result = createCampaignSchema.safeParse({
      name: 'Q1 2026 Campaign',
      periodStart: '2026-01-01',
      periodEnd: '2026-03-31',
      controlIds: [],
    });
    expect(result.success).toBe(false);
  });

  it('validates date format', () => {
    const result = createCampaignSchema.safeParse({
      name: 'Campaign',
      periodStart: '2026-01-01',
      periodEnd: '2026-03-31',
      controlIds: ['550e8400-e29b-41d4-a716-446655440000'],
    });
    expect(result.success).toBe(true);
  });
});

describe('createRiskControlLinkSchema', () => {
  it('defaults effectiveness to none', () => {
    const result = createRiskControlLinkSchema.parse({
      riskId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.effectivenessRating).toBe('none');
  });

  it('accepts all effectiveness ratings', () => {
    for (const rating of ['full', 'partial', 'planned', 'none']) {
      const result = createRiskControlLinkSchema.safeParse({
        riskId: '550e8400-e29b-41d4-a716-446655440000',
        effectivenessRating: rating,
      });
      expect(result.success).toBe(true);
    }
  });
});
```

## 1.2 Document Schema Validation (`packages/shared/src/__tests__/document-schema.test.ts`)

```typescript
import { describe, it, expect } from 'vitest';
import {
  createDocumentSchema,
  documentListQuerySchema,
  isValidDocumentStatusTransition,
  restoreVersionSchema,
  createDocumentEntityLinkSchema,
  searchQuerySchema,
} from '../schemas/document';

describe('createDocumentSchema', () => {
  it('validates a complete document', () => {
    const result = createDocumentSchema.safeParse({
      title: 'Informationssicherheitsrichtlinie',
      category: 'policy',
      content: '# Policy\n\nThis is the policy content.',
      requiresAcknowledgment: true,
      tags: ['iso27001', 'isms'],
    });
    expect(result.success).toBe(true);
  });

  it('requires title', () => {
    const result = createDocumentSchema.safeParse({
      category: 'policy',
    });
    expect(result.success).toBe(false);
  });

  it('accepts all 10 category values', () => {
    const cats = ['policy', 'procedure', 'guideline', 'template', 'record', 'tom', 'dpa', 'bcp', 'soa', 'other'];
    for (const cat of cats) {
      const result = createDocumentSchema.safeParse({
        title: 'Test',
        category: cat,
      });
      expect(result.success, `category '${cat}' should be valid`).toBe(true);
    }
  });

  it('defaults requiresAcknowledgment to false', () => {
    const result = createDocumentSchema.parse({ title: 'Test' });
    expect(result.requiresAcknowledgment).toBe(false);
  });

  it('defaults tags to empty array', () => {
    const result = createDocumentSchema.parse({ title: 'Test' });
    expect(result.tags).toEqual([]);
  });
});

describe('isValidDocumentStatusTransition', () => {
  it('allows draft → in_review', () => {
    expect(isValidDocumentStatusTransition('draft', 'in_review')).toBe(true);
  });

  it('allows in_review → approved (accept)', () => {
    expect(isValidDocumentStatusTransition('in_review', 'approved')).toBe(true);
  });

  it('allows in_review → draft (reject)', () => {
    expect(isValidDocumentStatusTransition('in_review', 'draft')).toBe(true);
  });

  it('allows approved → published', () => {
    expect(isValidDocumentStatusTransition('approved', 'published')).toBe(true);
  });

  it('allows published → archived', () => {
    expect(isValidDocumentStatusTransition('published', 'archived')).toBe(true);
  });

  it('allows published → draft (new version cycle)', () => {
    expect(isValidDocumentStatusTransition('published', 'draft')).toBe(true);
  });

  it('allows system expiry from any active status', () => {
    expect(isValidDocumentStatusTransition('published', 'expired')).toBe(true);
    expect(isValidDocumentStatusTransition('approved', 'expired')).toBe(true);
  });

  it('rejects draft → published (must go through review + approval)', () => {
    expect(isValidDocumentStatusTransition('draft', 'published')).toBe(false);
  });

  it('rejects archived → published', () => {
    expect(isValidDocumentStatusTransition('archived', 'published')).toBe(false);
  });
});

describe('createDocumentEntityLinkSchema', () => {
  it('accepts all valid entity types', () => {
    const types = ['risk', 'control', 'process', 'requirement', 'finding', 'audit'];
    for (const t of types) {
      const result = createDocumentEntityLinkSchema.safeParse({
        entityType: t,
        entityId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success, `entity type '${t}' should be valid`).toBe(true);
    }
  });

  it('rejects invalid entity types', () => {
    const result = createDocumentEntityLinkSchema.safeParse({
      entityType: 'unknown',
      entityId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(false);
  });
});

describe('searchQuerySchema', () => {
  it('requires query string', () => {
    const result = searchQuerySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('defaults scope to all', () => {
    const result = searchQuerySchema.parse({ q: 'Passwort' });
    expect(result.scope).toBe('all');
  });

  it('rejects empty query', () => {
    const result = searchQuerySchema.safeParse({ q: '' });
    expect(result.success).toBe(false);
  });
});
```

## 1.3 Test Result Computation (`packages/shared/src/__tests__/control-test-result.test.ts`)

```typescript
import { describe, it, expect } from 'vitest';
import { computeOverallTestResult } from '../utils/control-test';

describe('computeOverallTestResult (K-NEW-01)', () => {
  it('returns effective when both ToD and ToE are effective', () => {
    expect(computeOverallTestResult('effective', 'effective')).toBe('effective');
  });

  it('returns ineffective when ToD is effective but ToE is ineffective', () => {
    expect(computeOverallTestResult('effective', 'ineffective')).toBe('ineffective');
  });

  it('returns ineffective when ToD is ineffective regardless of ToE', () => {
    expect(computeOverallTestResult('ineffective', 'effective')).toBe('ineffective');
    expect(computeOverallTestResult('ineffective', 'ineffective')).toBe('ineffective');
  });

  it('returns partially_effective when either is partial and neither is ineffective', () => {
    expect(computeOverallTestResult('effective', 'partially_effective')).toBe('partially_effective');
    expect(computeOverallTestResult('partially_effective', 'effective')).toBe('partially_effective');
    expect(computeOverallTestResult('partially_effective', 'partially_effective')).toBe('partially_effective');
  });

  it('returns not_tested when both are not_tested', () => {
    expect(computeOverallTestResult('not_tested', 'not_tested')).toBe('not_tested');
  });

  it('returns partially_effective when one is tested and other is not', () => {
    expect(computeOverallTestResult('effective', 'not_tested')).toBe('partially_effective');
    expect(computeOverallTestResult('not_tested', 'effective')).toBe('partially_effective');
  });
});
```

---

# 2. Integration Tests

## 2.1 Controls API (`apps/web/src/__tests__/api/controls.api.test.ts`)

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestOrg, createTestUser, setOrgContext, cleanupTestData } from '../helpers/test-db';
import { testFetch } from '../helpers/test-fetch';

let orgA: { id: string };
let orgB: { id: string };
let adminA: { id: string; token: string };
let viewerA: { id: string; token: string };
let userB: { id: string; token: string };

beforeAll(async () => {
  orgA = await createTestOrg('Test Org A', { modules: ['erm', 'ics'] });
  orgB = await createTestOrg('Test Org B', { modules: ['erm', 'ics'] });
  adminA = await createTestUser(orgA.id, 'admin');
  viewerA = await createTestUser(orgA.id, 'viewer');
  userB = await createTestUser(orgB.id, 'admin');
});

afterAll(() => cleanupTestData());

describe('POST /api/v1/controls', () => {
  it('creates control with all fields', async () => {
    const res = await testFetch('/api/v1/controls', {
      method: 'POST',
      token: adminA.token,
      body: {
        title: 'MFA Enforcement',
        description: 'Enforce MFA on all admin accounts.',
        controlType: 'preventive',
        frequency: 'continuous',
        automationLevel: 'fully_automated',
        lineOfDefense: 'first',
        assertions: ['fraud_prevention', 'safeguarding_of_assets'],
      },
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.data.title).toBe('MFA Enforcement');
    expect(data.data.status).toBe('designed');
    expect(data.data.assertions).toContain('fraud_prevention');
    expect(data.data.workItemId).toBeTruthy();
  });

  it('returns 403 for viewer role', async () => {
    const res = await testFetch('/api/v1/controls', {
      method: 'POST',
      token: viewerA.token,
      body: { title: 'Test', controlType: 'preventive' },
    });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/controls (RLS)', () => {
  it('returns only controls from own org', async () => {
    // Create control in Org A
    await testFetch('/api/v1/controls', {
      method: 'POST', token: adminA.token,
      body: { title: 'Org A Control', controlType: 'detective' },
    });

    // Create control in Org B
    await testFetch('/api/v1/controls', {
      method: 'POST', token: userB.token,
      body: { title: 'Org B Control', controlType: 'corrective' },
    });

    // Query from Org A — should NOT see Org B's control
    const res = await testFetch('/api/v1/controls', { token: adminA.token });
    const data = await res.json();
    const titles = data.data.map((c: any) => c.title);
    expect(titles).not.toContain('Org B Control');
  });
});

describe('requireModule("ics")', () => {
  it('returns 404 when ICS module is disabled', async () => {
    const disabledOrg = await createTestOrg('No ICS Org', { modules: ['erm'] }); // ICS not in list
    const user = await createTestUser(disabledOrg.id, 'admin');

    const res = await testFetch('/api/v1/controls', { token: user.token });
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/v1/controls/:id/status', () => {
  it('allows designed → implemented', async () => {
    const createRes = await testFetch('/api/v1/controls', {
      method: 'POST', token: adminA.token,
      body: { title: 'Status Test', controlType: 'preventive' },
    });
    const control = (await createRes.json()).data;

    const res = await testFetch(`/api/v1/controls/${control.id}/status`, {
      method: 'PUT', token: adminA.token,
      body: { status: 'implemented' },
    });
    expect(res.status).toBe(200);
    const updated = (await res.json()).data;
    expect(updated.status).toBe('implemented');
  });

  it('rejects designed → effective (invalid transition)', async () => {
    const createRes = await testFetch('/api/v1/controls', {
      method: 'POST', token: adminA.token,
      body: { title: 'Invalid Transition', controlType: 'detective' },
    });
    const control = (await createRes.json()).data;

    const res = await testFetch(`/api/v1/controls/${control.id}/status`, {
      method: 'PUT', token: adminA.token,
      body: { status: 'effective' },
    });
    expect(res.status).toBe(400);
  });

  it('auto-creates finding on transition to ineffective', async () => {
    // Create and advance to implemented
    const control = await createControlWithStatus(adminA.token, 'implemented');

    const res = await testFetch(`/api/v1/controls/${control.id}/status`, {
      method: 'PUT', token: adminA.token,
      body: { status: 'ineffective' },
    });
    expect(res.status).toBe(200);

    // Check finding was auto-created
    const findingsRes = await testFetch(`/api/v1/findings?controlId=${control.id}`, { token: adminA.token });
    const findings = (await findingsRes.json()).data;
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].severity).toBe('improvement_requirement');
    expect(findings[0].source).toBe('control_test');
  });
});
```

## 2.2 Findings API (`apps/web/src/__tests__/api/findings.api.test.ts`)

```typescript
describe('Finding Remediation Workflow', () => {
  it('completes full lifecycle: identified → in_remediation → remediated → verified → closed', async () => {
    const finding = await createTestFinding(adminA.token, 'insignificant_nonconformity');

    // Step 1: Start remediation
    let res = await testFetch(`/api/v1/findings/${finding.id}/status`, {
      method: 'PUT', token: adminA.token,
      body: { status: 'in_remediation' },
    });
    expect(res.status).toBe(200);

    // Step 2: Mark as remediated
    res = await testFetch(`/api/v1/findings/${finding.id}/status`, {
      method: 'PUT', token: adminA.token,
      body: { status: 'remediated', notes: 'Patch applied and verified.' },
    });
    expect(res.status).toBe(200);

    // Step 3: Verify (requires auditor or risk_manager role)
    const auditor = await createTestUser(orgA.id, 'auditor');
    res = await testFetch(`/api/v1/findings/${finding.id}/status`, {
      method: 'PUT', token: auditor.token,
      body: { status: 'verified' },
    });
    expect(res.status).toBe(200);

    // Step 4: Close
    res = await testFetch(`/api/v1/findings/${finding.id}/status`, {
      method: 'PUT', token: adminA.token,
      body: { status: 'closed' },
    });
    expect(res.status).toBe(200);
  });

  it('requires justification for accepted findings', async () => {
    const finding = await createTestFinding(adminA.token, 'observation');

    // Without justification → 400
    let res = await testFetch(`/api/v1/findings/${finding.id}/status`, {
      method: 'PUT', token: adminA.token,
      body: { status: 'accepted' },
    });
    expect(res.status).toBe(400);

    // With justification → 200
    res = await testFetch(`/api/v1/findings/${finding.id}/status`, {
      method: 'PUT', token: adminA.token,
      body: {
        status: 'accepted',
        justification: 'Risk is within acceptable tolerance. No remediation needed as control redesign is planned for Q3.',
      },
    });
    expect(res.status).toBe(200);
  });

  it('prevents responsible user from verifying own finding (separation of duties)', async () => {
    const responsible = await createTestUser(orgA.id, 'control_owner');
    const finding = await createTestFinding(adminA.token, 'improvement_requirement', {
      responsibleId: responsible.id,
    });

    // Advance to remediated
    await advanceFindingTo(finding.id, 'remediated', adminA.token);

    // Responsible user tries to verify — should be rejected
    const res = await testFetch(`/api/v1/findings/${finding.id}/status`, {
      method: 'PUT', token: responsible.token,
      body: { status: 'verified' },
    });
    expect(res.status).toBe(403);
  });
});

describe('Finding RLS', () => {
  it('User B cannot see findings from Org A', async () => {
    const finding = await createTestFinding(adminA.token, 'observation');

    const res = await testFetch(`/api/v1/findings/${finding.id}`, { token: userB.token });
    expect(res.status).toBe(404);
  });
});
```

## 2.3 RCM API (`apps/web/src/__tests__/api/rcm.api.test.ts`)

```typescript
describe('Risk-Control Matrix', () => {
  it('creates bidirectional risk-control link', async () => {
    const control = await createTestControl(adminA.token);
    const risk = await createTestRisk(adminA.token);

    const res = await testFetch(`/api/v1/controls/${control.id}/risk-links`, {
      method: 'POST', token: adminA.token,
      body: {
        riskId: risk.id,
        coverageDescription: 'MFA prevents credential theft after phishing.',
        effectivenessRating: 'full',
      },
    });
    expect(res.status).toBe(201);

    // Verify visible from risk side
    const riskLinks = await testFetch(`/api/v1/risks/${risk.id}/control-links`, { token: adminA.token });
    const links = (await riskLinks.json()).data;
    expect(links).toHaveLength(1);
    expect(links[0].controlId).toBe(control.id);
  });

  it('returns complete RCM matrix with gaps', async () => {
    // Create 3 risks, 2 controls, link only partially
    const risk1 = await createTestRisk(adminA.token, { title: 'Linked Risk', scoreInherent: 20 });
    const risk2 = await createTestRisk(adminA.token, { title: 'Uncontrolled Risk', scoreInherent: 15 });
    const control1 = await createTestControl(adminA.token, { title: 'Linked Control' });
    const control2 = await createTestControl(adminA.token, { title: 'Orphaned Control' });

    // Link only risk1 ↔ control1
    await linkRiskControl(adminA.token, risk1.id, control1.id);

    const res = await testFetch('/api/v1/controls/rcm', { token: adminA.token });
    const matrix = (await res.json()).data;

    expect(matrix.gaps.uncontrolledRisks).toContain(risk2.id);
    expect(matrix.gaps.orphanedControls).toContain(control2.id);
    expect(matrix.cells).toHaveLength(1);
  });

  it('prevents duplicate risk-control links', async () => {
    const control = await createTestControl(adminA.token);
    const risk = await createTestRisk(adminA.token);

    await testFetch(`/api/v1/controls/${control.id}/risk-links`, {
      method: 'POST', token: adminA.token,
      body: { riskId: risk.id, effectivenessRating: 'full' },
    });

    const res = await testFetch(`/api/v1/controls/${control.id}/risk-links`, {
      method: 'POST', token: adminA.token,
      body: { riskId: risk.id, effectivenessRating: 'partial' },
    });
    expect(res.status).toBe(409); // Conflict — already exists
  });
});
```

## 2.4 Documents API (`apps/web/src/__tests__/api/documents.api.test.ts`)

```typescript
describe('Document Lifecycle', () => {
  it('completes full lifecycle: draft → in_review → approved → published', async () => {
    const doc = await createTestDocument(adminA.token, {
      title: 'Lifecycle Test Policy',
      category: 'policy',
      requiresAcknowledgment: true,
    });
    expect(doc.status).toBe('draft');

    // Submit for review
    let res = await testFetch(`/api/v1/documents/${doc.id}/status`, {
      method: 'PUT', token: adminA.token,
      body: { status: 'in_review' },
    });
    expect(res.status).toBe(200);

    // Approve
    res = await testFetch(`/api/v1/documents/${doc.id}/status`, {
      method: 'PUT', token: adminA.token,
      body: { status: 'approved' },
    });
    expect(res.status).toBe(200);

    // Publish
    res = await testFetch(`/api/v1/documents/${doc.id}/status`, {
      method: 'PUT', token: adminA.token,
      body: { status: 'published' },
    });
    expect(res.status).toBe(200);
    const published = (await res.json()).data;
    expect(published.publishedAt).toBeTruthy();
  });

  it('reject sends document back to draft with required notes', async () => {
    const doc = await createTestDocument(adminA.token, { title: 'Reject Test' });
    await advanceDocumentTo(doc.id, 'in_review', adminA.token);

    // Reject without notes → 400
    let res = await testFetch(`/api/v1/documents/${doc.id}/status`, {
      method: 'PUT', token: adminA.token,
      body: { status: 'draft' },
    });
    expect(res.status).toBe(400);

    // Reject with notes → 200
    res = await testFetch(`/api/v1/documents/${doc.id}/status`, {
      method: 'PUT', token: adminA.token,
      body: { status: 'draft', notes: 'Section 3 needs more detail on NIS2 requirements.' },
    });
    expect(res.status).toBe(200);
  });
});

describe('Document Versioning', () => {
  it('creates new version when content is updated', async () => {
    const doc = await createTestDocument(adminA.token, {
      title: 'Version Test',
      content: 'Version 1 content.',
    });

    await testFetch(`/api/v1/documents/${doc.id}`, {
      method: 'PUT', token: adminA.token,
      body: { content: 'Updated version 2 content.', changeSummary: 'Updated section 1.' },
    });

    const versionsRes = await testFetch(`/api/v1/documents/${doc.id}/versions`, { token: adminA.token });
    const versions = (await versionsRes.json()).data;
    expect(versions).toHaveLength(2);
    expect(versions[1].changeSummary).toBe('Updated section 1.');
  });

  it('restores old version as new version', async () => {
    const doc = await createTestDocument(adminA.token, { content: 'Original' });
    await updateDocContent(doc.id, adminA.token, 'Changed');
    await updateDocContent(doc.id, adminA.token, 'Changed again');

    // Document is now at version 3 — restore version 1
    const res = await testFetch(`/api/v1/documents/${doc.id}/restore`, {
      method: 'POST', token: adminA.token,
      body: { versionNumber: 1 },
    });
    expect(res.status).toBe(200);

    // Should now be version 4 with version 1's content
    const docRes = await testFetch(`/api/v1/documents/${doc.id}`, { token: adminA.token });
    const updated = (await docRes.json()).data;
    expect(updated.currentVersion).toBe(4);
    expect(updated.content).toBe('Original');
    expect(updated.status).toBe('draft'); // Rollback resets status
  });
});

describe('Acknowledgments', () => {
  it('acknowledges published document', async () => {
    const doc = await createPublishedDocument(adminA.token, { requiresAcknowledgment: true });

    const res = await testFetch(`/api/v1/documents/${doc.id}/acknowledge`, {
      method: 'POST', token: viewerA.token,
    });
    expect(res.status).toBe(201);
    const ack = (await res.json()).data;
    expect(ack.versionAcknowledged).toBe(doc.currentVersion);
  });

  it('is idempotent — second acknowledgment returns 200', async () => {
    const doc = await createPublishedDocument(adminA.token, { requiresAcknowledgment: true });

    await testFetch(`/api/v1/documents/${doc.id}/acknowledge`, {
      method: 'POST', token: viewerA.token,
    });
    const res = await testFetch(`/api/v1/documents/${doc.id}/acknowledge`, {
      method: 'POST', token: viewerA.token,
    });
    expect(res.status).toBe(200);
    expect((await res.json()).message).toContain('Bereits');
  });

  it('new version invalidates old acknowledgments', async () => {
    const doc = await createPublishedDocument(adminA.token, { requiresAcknowledgment: true });

    // Acknowledge version 1
    await testFetch(`/api/v1/documents/${doc.id}/acknowledge`, {
      method: 'POST', token: viewerA.token,
    });

    // Publish version 2
    await startNewVersionCycle(doc.id, adminA.token);

    // Check status — viewerA should be pending again
    const statusRes = await testFetch(`/api/v1/documents/${doc.id}/acknowledgment-status`, { token: adminA.token });
    const status = (await statusRes.json()).data;
    const pendingIds = status.pendingUsers.map((u: any) => u.id);
    expect(pendingIds).toContain(viewerA.id);
  });

  it('rejects acknowledgment on unpublished document', async () => {
    const doc = await createTestDocument(adminA.token, { requiresAcknowledgment: true });

    const res = await testFetch(`/api/v1/documents/${doc.id}/acknowledge`, {
      method: 'POST', token: viewerA.token,
    });
    expect(res.status).toBe(400);
  });
});

describe('Full-Text Search (DM-07)', () => {
  it('finds document by title keyword', async () => {
    await createPublishedDocument(adminA.token, {
      title: 'Passwortrichtlinie für Administratoren',
      content: 'Alle Admin-Passwörter müssen mindestens 16 Zeichen lang sein.',
    });

    const res = await testFetch('/api/v1/search?q=Passwort&scope=documents', { token: adminA.token });
    const results = (await res.json()).results;
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].title).toContain('Passwort');
  });

  it('returns highlighted excerpt', async () => {
    await createPublishedDocument(adminA.token, {
      title: 'Backup Policy',
      content: 'Die Backup-Strategie folgt der 3-2-1-Regel.',
    });

    const res = await testFetch('/api/v1/search?q=Backup&scope=documents', { token: adminA.token });
    const results = (await res.json()).results;
    expect(results[0].excerpt).toContain('<mark>');
  });

  it('respects RLS — Org B content not visible to Org A', async () => {
    await createPublishedDocument(userB.token, { title: 'Secret B Policy' });

    const res = await testFetch('/api/v1/search?q=Secret&scope=documents', { token: adminA.token });
    const results = (await res.json()).results;
    const titles = results.map((r: any) => r.title);
    expect(titles).not.toContain('Secret B Policy');
  });
});
```

## 2.5 Evidence API (`apps/web/src/__tests__/api/evidence.api.test.ts`)

```typescript
describe('Evidence Upload', () => {
  it('uploads evidence attached to control_test', async () => {
    const test = await createTestControlTest(adminA.token);

    const formData = new FormData();
    formData.append('file', new Blob(['test content'], { type: 'application/pdf' }), 'test-report.pdf');
    formData.append('entityType', 'control_test');
    formData.append('entityId', test.id);
    formData.append('title', 'MFA Enforcement Report');
    formData.append('category', 'report');

    const res = await testFetch('/api/v1/evidence', {
      method: 'POST', token: adminA.token,
      body: formData,
      contentType: 'multipart/form-data',
    });
    expect(res.status).toBe(201);
    const evidence = (await res.json()).data;
    expect(evidence.entityType).toBe('control_test');
    expect(evidence.fileName).toBe('test-report.pdf');
  });

  it('rejects file exceeding 50MB', async () => {
    const largeBlob = new Blob([new ArrayBuffer(51 * 1024 * 1024)]);
    const formData = new FormData();
    formData.append('file', largeBlob, 'large.pdf');
    formData.append('entityType', 'control');
    formData.append('entityId', 'some-id');
    formData.append('title', 'Too Large');

    const res = await testFetch('/api/v1/evidence', {
      method: 'POST', token: adminA.token,
      body: formData,
      contentType: 'multipart/form-data',
    });
    expect(res.status).toBe(413);
  });
});
```

---

# 3. E2E Tests (Playwright)

## 3.1 Control Register (`apps/web/src/__tests__/e2e/control-register.spec.ts`)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Control Register', () => {
  test('displays control list with correct columns', async ({ page }) => {
    await page.goto('/controls');
    await expect(page.getByText('Kontrollregister')).toBeVisible();

    // Verify table headers
    await expect(page.getByRole('columnheader', { name: 'Titel' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /Typ|Type/ })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /Status/ })).toBeVisible();
  });

  test('creates new control and navigates to detail', async ({ page }) => {
    await page.goto('/controls');
    await page.click('text=Kontrolle erstellen');

    await page.fill('[name="title"]', 'E2E Playwright Control');
    await page.selectOption('[name="controlType"]', 'preventive');
    await page.selectOption('[name="frequency"]', 'monthly');
    await page.click('text=Kontrolle erstellen');

    await expect(page).toHaveURL(/\/controls\/[a-f0-9-]+/);
    await expect(page.getByText('E2E Playwright Control')).toBeVisible();
    await expect(page.getByText('Designed')).toBeVisible();
  });

  test('filters by control type', async ({ page }) => {
    await page.goto('/controls');
    await page.click('[data-testid="filter-controlType"]');
    await page.click('text=Präventiv');

    // All visible controls should be preventive
    const typeBadges = page.locator('[data-testid="control-type-badge"]');
    const count = await typeBadges.count();
    for (let i = 0; i < count; i++) {
      await expect(typeBadges.nth(i)).toContainText(/Präventiv|Preventive/);
    }
  });

  test('shows ModuleGate teaser when ICS disabled', async ({ page }) => {
    await loginAsOrgWithDisabledIcs(page);
    await page.goto('/controls');
    await expect(page.getByText(/Modul nicht aktiviert|Module not enabled/)).toBeVisible();
  });
});
```

## 3.2 Control Test Execution (`apps/web/src/__tests__/e2e/control-test.spec.ts`)

```typescript
test.describe('Control Test Execution (K-NEW-01)', () => {
  test('executes test with separate ToD and ToE results', async ({ page }) => {
    const testId = await createControlTestViaApi();
    await page.goto(`/controls/tests/${testId}`);

    // Set ToD result
    await page.click('[data-testid="tod-effective"]');
    await page.fill('[data-testid="tod-notes"]', 'Control design matches ISO 27002 A.8.5.');

    // Set ToE result (independently)
    await page.click('[data-testid="toe-partially-effective"]');
    await page.fill('[data-testid="toe-notes"]', 'MFA enforced on 95% of accounts. 5% service accounts exempt.');

    // Upload evidence
    await page.setInputFiles('[data-testid="evidence-upload"]', 'fixtures/mfa-report.pdf');
    await expect(page.getByText('mfa-report.pdf')).toBeVisible();

    // Complete test
    await page.click('text=Test abschließen');
    await expect(page.getByText('Abgeschlossen')).toBeVisible();

    // Verify both results shown independently
    await expect(page.getByTestId('tod-result')).toContainText('Effektiv');
    await expect(page.getByTestId('toe-result')).toContainText('Teilweise');
  });

  test('shows prompt to create finding on ineffective result', async ({ page }) => {
    const testId = await createControlTestViaApi();
    await page.goto(`/controls/tests/${testId}`);

    await page.click('[data-testid="tod-effective"]');
    await page.click('[data-testid="toe-ineffective"]');
    await page.click('text=Test abschließen');

    // Finding creation prompt should appear
    await expect(page.getByText(/Finding erstellen|Create Finding/)).toBeVisible();
  });
});
```

## 3.3 RCM Matrix (`apps/web/src/__tests__/e2e/rcm-matrix.spec.ts`)

```typescript
test.describe('Risk-Control Matrix', () => {
  test('displays matrix with risks as rows and controls as columns', async ({ page }) => {
    await page.goto('/controls/rcm');
    await expect(page.getByText('Risiko-Kontroll-Matrix')).toBeVisible();

    // Matrix should have cells
    await expect(page.locator('[data-testid="rcm-cell"]')).toHaveCount.greaterThan(0);
  });

  test('highlights uncontrolled risks in red', async ({ page }) => {
    await page.goto('/controls/rcm');

    const gapRows = page.locator('[data-testid="rcm-gap-row"]');
    if (await gapRows.count() > 0) {
      await expect(gapRows.first()).toHaveCSS('background-color', /rgb\(254, 242, 242\)/); // bg-red-50
    }
  });

  test('clicking empty cell opens link creation dialog', async ({ page }) => {
    await page.goto('/controls/rcm');

    const emptyCell = page.locator('[data-testid="rcm-cell-empty"]').first();
    if (await emptyCell.isVisible()) {
      await emptyCell.click();
      await expect(page.getByText('Verknüpfung erstellen')).toBeVisible();
    }
  });
});
```

## 3.4 Document Acknowledgment Flow (`apps/web/src/__tests__/e2e/document-acknowledgment.spec.ts`)

```typescript
test.describe('Document Acknowledgment', () => {
  test('shows acknowledgment banner on unacknowledged document', async ({ page }) => {
    const docId = await createPublishedDocWithAcknowledgment();
    await loginAsViewer(page);
    await page.goto(`/documents/${docId}`);

    await expect(page.getByText('Dieses Dokument erfordert Ihre Kenntnisnahme')).toBeVisible();
    await expect(page.getByText('Gelesen und zur Kenntnis genommen')).toBeVisible();
  });

  test('acknowledge button records confirmation and updates banner', async ({ page }) => {
    const docId = await createPublishedDocWithAcknowledgment();
    await loginAsViewer(page);
    await page.goto(`/documents/${docId}`);

    await page.click('text=Gelesen und zur Kenntnis genommen');

    // Banner should change
    await expect(page.getByText(/Bestätigt am/)).toBeVisible();
    await expect(page.getByText('Gelesen und zur Kenntnis genommen')).not.toBeVisible();
  });

  test('compliance dashboard shows correct percentages', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/documents/compliance');

    await expect(page.getByText('Dokumenten-Kenntnisnahme')).toBeVisible();

    // Table should show percentage column
    const rows = page.locator('tbody tr');
    expect(await rows.count()).toBeGreaterThan(0);
  });

  test('send reminder from compliance dashboard', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/documents/compliance');

    // Expand a row with pending users
    await page.locator('tbody tr').first().click();

    // Click remind button
    const remindBtn = page.getByText('Erinnern').first();
    if (await remindBtn.isVisible()) {
      await remindBtn.click();
      await expect(page.getByText(/Erinnerung gesendet|Reminder sent/)).toBeVisible();
    }
  });
});
```

## 3.5 Document Lifecycle (`apps/web/src/__tests__/e2e/document-lifecycle.spec.ts`)

```typescript
test.describe('Document Lifecycle', () => {
  test('complete flow: create → review → reject → revise → approve → publish', async ({ page }) => {
    await loginAsAdmin(page);

    // Create document
    await page.goto('/documents/new');
    await page.fill('[name="title"]', 'E2E Lifecycle Document');
    await page.selectOption('[name="category"]', 'policy');
    await page.fill('[data-testid="content-editor"]', '# Test Policy\n\nContent here.');
    await page.click('text=Dokument erstellen');
    await expect(page).toHaveURL(/\/documents\/[a-f0-9-]+/);

    // Submit for review
    await page.click('text=Zur Prüfung einreichen');
    await page.click('text=Bestätigen');
    await expect(page.getByText('In Prüfung')).toBeVisible();

    // Reject
    await page.click('text=Zurückweisen');
    await page.fill('[placeholder*="Begründung"]', 'Needs NIS2 reference in section 2.');
    await page.click('text=Bestätigen');
    await expect(page.getByText('Entwurf')).toBeVisible();

    // Revise and resubmit
    await page.click('text=Bearbeiten');
    await page.fill('[data-testid="content-editor"]', '# Test Policy\n\nContent with NIS2 ref.');
    await page.click('text=Speichern');
    await page.click('text=Zur Prüfung einreichen');
    await page.click('text=Bestätigen');

    // Approve
    await page.click('text=Genehmigen');
    await page.click('text=Bestätigen');
    await expect(page.getByText('Freigegeben')).toBeVisible();

    // Publish
    await page.click('text=Veröffentlichen');
    await page.click('text=Bestätigen');
    await expect(page.getByText('Veröffentlicht')).toBeVisible();
  });

  test('version restore creates new version and resets to draft', async ({ page }) => {
    const docId = await createDocumentWithMultipleVersions();
    await loginAsAdmin(page);
    await page.goto(`/documents/${docId}`);

    // Go to versions tab
    await page.click('text=Versionen');
    await expect(page.getByText('v1')).toBeVisible();

    // Restore version 1
    await page.click('[data-testid="restore-v1"]');
    await page.click('text=Bestätigen');

    // Status should be draft, version should be incremented
    await expect(page.getByText('Entwurf')).toBeVisible();
  });
});
```

---

# 4. Performance Benchmarks

| Metric | Target | Test Method |
| --- | --- | --- |
| GET /controls (500 records, paginated) | < 200ms | k6 load test |
| GET /controls/rcm (200 risks × 100 controls) | < 500ms | k6 load test |
| GET /documents (500 records, paginated) | < 200ms | k6 load test |
| GET /documents full-text search (1,000 docs) | < 200ms | k6 load test |
| GET /documents/:id/acknowledgment-status (500 users) | < 100ms | Integration test with timer |
| POST /evidence (10MB PDF upload) | < 5s | Integration test with timer |
| POST /control-test-campaigns/:id/status (activate — 50 tests + tasks + notifications) | < 10s | Integration test with timer |
| GET /findings (200 records, filtered by severity + status) | < 150ms | k6 load test |
| GET /control-tests (500 records, filtered) | < 200ms | k6 load test |
| POST /documents/:id/acknowledge | < 50ms | k6 load test |

---

# 5. Security Checklist

- [ ] All ICS endpoints use `requireModule('ics')` — returns 404 when disabled
- [ ] All DMS endpoints use `requireModule('dms')` — returns 404 when disabled
- [ ] All endpoints use `requireAuth()` — returns 401 for unauthenticated
- [ ] RLS isolation: Org A cannot access Org B controls, findings, documents, evidence
- [ ] RBAC: viewer cannot create/edit/delete controls, findings, or documents
- [ ] RBAC: only admin can soft-delete controls, findings, documents, and evidence
- [ ] RBAC: finding verification (→ verified) requires auditor or risk_manager, NOT the finding's responsible_id
- [ ] RBAC: document approval requires reviewer_id or admin role
- [ ] Soft-deleted records excluded from all list queries (controls, findings, documents, evidence)
- [ ] Evidence files served via presigned URLs with 15-minute expiry — no direct S3 access
- [ ] File upload validates MIME type server-side (not just client-side extension check)
- [ ] File upload enforces 50MB max — returns 413 for oversized files
- [ ] Document content (Markdown) sanitized before rendering (prevent XSS)
- [ ] Full-text search input sanitized against SQL injection (parameterized queries with plainto_tsquery)
- [ ] Acknowledgment is idempotent — no duplicate records possible (UNIQUE constraint)
- [ ] Rate limiting on AI endpoints (control suggestions, test plan generator): 10/hour/user
- [ ] OWASP ZAP scan: 0 critical findings on all new endpoints
- [ ] Audit trail: all CRUD operations on controls, findings, documents, evidence logged with before/after diff
