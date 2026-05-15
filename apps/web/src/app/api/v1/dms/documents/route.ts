// /api/v1/dms/documents — Canonical DMS path (Wave-21-B5)
//
// #WAVE21-B5: Wave-21 QA found that GET /api/v1/dms/documents
// returned 404. The actual DMS implementation has been at
// /api/v1/documents/** since Sprint 4 (matched the original
// `module_key=dms` but used the entity-name-only convention). This
// alias surfaces the DMS module name in the URL — matching the
// /api/v1/{module_key}/{entity} convention used by other modules
// (/bcms/bia, /dpms/dsr, /isms/incidents, ...).
//
// The alias re-exports the GET + POST handlers from /documents/route.ts
// so the two paths share a single implementation. Old /documents
// stays as the deprecated alias with an RFC-7234 Warning header
// (added separately in /documents/route.ts where applicable).

export { GET, POST } from "../../documents/route";
