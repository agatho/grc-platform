# State-Machine Pattern for Status-Bearing Entities

> **Audience:** API authors adding a new module that has a status/state field.
> **Context:** Wave 6 QA (#WAVE6-STATE-01) found inconsistent handling — some
> modules accepted `status` directly on `PUT`, others rejected it and required
> a dedicated `/transition` endpoint, and a third group exposed neither, so
> the UI couldn't even discover what was possible.

## TL;DR

Pick **one of two shapes** per module. Document which one in the route file's
header comment so reviewers don't re-litigate it later.

| Shape                                           | Use when                                                                                                                                                                         |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Status on `PUT /entity/[id]`**             | Status changes are operational and don't need rich audit context (no reason, no side-effects beyond `status` itself).                                                            |
| **B. Dedicated `POST /entity/[id]/transition`** | Transitions need a `reason`, trigger downstream side-effects (notifications, work-item state, audit annotation), or have to reject illegal transitions with a structured matrix. |

In both cases, `GET /entity/[id]/transitions` is **mandatory** for UI discovery.

## Shape A: status on PUT

```ts
// PUT /api/v1/<entity>/[id]
//
// Status pattern: A — direct PUT.
// Updates `status` inline with the rest of the entity. Server-side
// validation rejects values outside the enum; no transition matrix.
const updated = updateEntitySchema.parse(await req.json());
// ... persist ...
```

Use the generic discovery helper for the corresponding GET:

```ts
// GET /api/v1/<entity>/[id]/transitions
import { buildTransitionsResponse } from "@/lib/generic-transitions";

return Response.json({
  data: buildTransitionsResponse({
    current: row.status,
    knownStatuses: ENTITY_STATUSES, // from @grc/db enum
    module: "<entity>",
    entityId: id,
  }),
});
```

**Modules currently on Shape A:**

- `bcms/bia/[id]` (status field on bia_assessment)
- `audit-mgmt/audits/[id]`
- `vendors/[id]`
- `work-items/[id]/status`
- `tasks/[id]/status`
- `isms/assessments/[id]`

## Shape B: dedicated transition endpoint

```ts
// POST /api/v1/<entity>/[id]/status
//
// Status pattern: B — transition endpoint with matrix.
// Body: { status: <enum>, reason?: <string max 2000> }
// Rejects illegal transitions with 422 problem+json. Audit-log row
// carries the reason via withAuditContext({ reason }).
const { status, reason } = riskStatusTransitionSchema.parse(await req.json());

const allowed = validateRiskStatusTransition(row.status, status);
if (!allowed) {
  return problem.validation({
    requestId,
    detail: `Cannot transition from '${row.status}' to '${status}'`,
    errors: [{ path: "status", message: "illegal transition" }],
  });
}

await withAuditContext(
  ctx,
  async (tx) => {
    /* update */
  },
  { reason },
);
```

The matching `GET /transitions` returns the **allowed-from-current** subset, not
just the full enum:

```ts
return Response.json({
  data: {
    current: row.status,
    allowedNext: ALLOWED_TRANSITIONS[row.status],
    knownStatuses: RISK_STATUSES,
    endpoint: `/api/v1/risks/${id}/status`,
    method: "POST",
    bodyShape: { status: "<enum>", reason: "<optional string>" },
  },
});
```

**Modules currently on Shape B:**

- `risks/[id]/status` — `validateRiskStatusTransition` matrix
- `bcms/bia/[id]/finalize` — single-shot gate (`draft → finalised`)
- `programmes/journeys/[id]/steps/[stepId]/transition` — programme step gate
- `isms/nonconformities/[id]` (status sub-route) — CAPA workflow

## When in doubt

Default to **Shape A**. The transition matrix in Shape B is a specialised tool
for entities where the _order_ of state changes is itself a compliance control
(risk lifecycle = ISO 31000; programme journeys = audit trail; BIA finalise =
single one-way commitment). For everything else, the audit-log row already
captures who/what/when — re-encoding that as a matrix is busywork.

If you start with Shape A and later realise transitions need a reason or a
matrix, migrate to Shape B in a separate PR. Don't bolt a half-implemented
matrix onto a Shape-A route — the result is the inconsistency Wave 6 flagged.

## Discovery contract (both shapes)

`GET /api/v1/<entity>/[id]/transitions` MUST return:

- `current` — the entity's status today
- `knownStatuses` — every enum value the schema accepts
- `endpoint` + `method` + `bodyShape` — how to actually trigger a change

Shape B routes additionally return `allowedNext` (subset of `knownStatuses`
reachable from `current`). The UI uses this to grey out impossible buttons.
