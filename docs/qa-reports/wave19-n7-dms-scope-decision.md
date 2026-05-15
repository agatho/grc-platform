# Wave-19-N7: DMS Multi-Signer Workflow — Out of Scope for v0.2

**Status:** Out of scope for ARCTOS v0.2-alpha.
**Tracker:** Wave-19 closure spec, item W19-N7.

## What the spec asked for

> 1. `POST /dms/documents {title, type, file-base64}` → 201, gespeichert mit Hash
> 2. `POST /dms/documents/{id}/versions` → neue Version
> 3. `POST /dms/documents/{id}/sign` → Multi-Signer-Workflow
> 4. `GET /dms/documents/{id}/audit-trail` → wer hat wann was geändert
> 5. Cross-Modul: `POST /dms/documents {linkedRiskId}` → in Risk-Detail sichtbar

## What ARCTOS already ships (under `/api/v1/documents`, not `/dms/`)

| Spec item                    | Endpoint                                                             | Status                                  |
| ---------------------------- | -------------------------------------------------------------------- | --------------------------------------- |
| 1. Create document           | `POST /api/v1/documents` + `POST /api/v1/documents/[id]/upload`      | ✅ Implemented (with SHA-256 file hash) |
| 2. Versions                  | `POST /api/v1/documents/[id]/versions`                               | ✅ Implemented                          |
| 3. **Multi-signer workflow** | `POST /api/v1/documents/[id]/sign`                                   | ❌ **Not implemented**                  |
| 4. Audit trail               | Available via `GET /api/v1/audit-log?entityType=document&entityId=…` | ✅ Implemented                          |
| 5. Cross-module entity links | `POST /api/v1/documents/[id]/entity-links`                           | ✅ Implemented                          |
| (bonus) Acknowledgments      | `POST /api/v1/documents/[id]/acknowledge`                            | ✅ Implemented (single-signer)          |

So 4 of 5 spec items already work today. The base path is `/api/v1/documents/`,
not `/api/v1/dms/` — this is a documentation drift, not a missing module.

## What "multi-signer" needs that isn't there

A proper multi-signer workflow implies:

1. **`document_signature_request` table** — one row per (document, signer)
   tuple with state (`pending` | `signed` | `declined`), timestamps,
   and a SHA-256 of the signed-version snapshot.
2. **Signature ordering** — sequential vs. parallel. Sequential needs
   "next signer notified when current signs"; parallel notifies all
   simultaneously.
3. **Cryptographic signing** (optional but expected by audit) —
   either a server-side hash + private-key sign, or qualified
   electronic signature (QES) per eIDAS.
4. **State-machine** — `request_created → notified → signed | declined |
expired`, with the request as a whole `complete` only when all
   signers in the same group have signed.
5. **UI** — signature-request inbox per user; "sign" button that
   shows a preview + the legal disclaimer.
6. **Notification triggers** — onCreated, onReminder (e.g. T-24h before
   expiry), onCompleted.

Estimated scope: ~3-5 days for the API + DB schema + tests, plus 2-3
days for the UI. Not a closure-PR change.

## Why ARCTOS v0.2 ships without it

The existing `acknowledge` endpoint already covers the most common
use-case ("I have read this document"), which is what most policy
documents need. True qualified electronic signatures (eIDAS QES) are
a regulatory feature that overlaps with national-CA infrastructure
(D-Trust, Bundesdruckerei in DE) and is typically bought as a
managed service (DocuSign, Adobe Sign, sproof) rather than built
in-house. ARCTOS v0.2 documents this gap and points integrators at
the existing `entity-links` + `audit-log` endpoints, which together
already satisfy the GoBD §147 + ISO 27001 §A.5.34 evidence
requirements that don't strictly need cryptographic signing.

## Recommendation

Track as **W21-DMS-MULTISIGN-01** in a future sprint. Decide between:

- **Option A: build in-house** — 5-8 days; full control, no vendor;
  not eIDAS QES (need an HSM for that).
- **Option B: integrate sproof / DocuSign** — 2-3 days; vendor cost
  per signature; eIDAS QES via the vendor's CA.

The README + `feature-catalog.md` should mention this gap explicitly
so deployers don't expect built-in signing on day one.

## Acceptance criteria for the follow-up PR

- [ ] `POST /api/v1/documents/[id]/sign-requests` creates signature requests
- [ ] `POST /api/v1/sign-requests/[id]/sign` records a signature
- [ ] State-machine: `pending → signed | declined | expired`
- [ ] Notification + email trigger on each transition
- [ ] Audit-log entry per signature with SHA-256 of the signed version
- [ ] vitest suite covering the state-machine + notification fan-out
