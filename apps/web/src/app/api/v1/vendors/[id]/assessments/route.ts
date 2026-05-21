// /api/v1/vendors/[id]/assessments — Wave-24-D2 canonical alias
//
// #WAVE24-D2: Wave-24 QA found that POST /vendors/{id}/assessments
// returned 404. The actual implementation has been at
// /vendors/{id}/risk-assessments since Sprint 9. This alias matches
// the shorter form the rest of the platform uses (e.g.
// /audit-mgmt/audits/{id}/activities, /controls/{id}/tests) so the
// "/assessments" subresource name is consistent across modules.
//
// Re-exports the GET + POST handlers from risk-assessments/route.ts
// so the two URLs share a single implementation; no behavioural
// drift between alias and canonical. RBAC + body schema live in the
// underlying route and are inherited verbatim.

export { GET, POST } from "../risk-assessments/route";
