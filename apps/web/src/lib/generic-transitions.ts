// #WAVE6-STATE-01: thin discovery helper for the 10+ modules that
// have a status field but no dedicated state-machine endpoint.
//
// Each module-specific route is a 12-line wrapper that fetches its
// row, calls this helper with the enum values + canonical endpoint
// hint, and returns the JSON. The QA expectation is "match the DPIA
// reference shape" — current status + a list to help the UI render
// status-change buttons — not a full transition validator.

export interface TransitionsResponse {
  current: string;
  knownStatuses: readonly string[];
  endpoint: string;
  method: string;
  bodyShape: Record<string, string>;
  note: string;
}

export function buildTransitionsResponse(opts: {
  current: string | null | undefined;
  knownStatuses: readonly string[];
  module: string;
  entityId: string;
}): TransitionsResponse {
  return {
    current: opts.current ?? "unknown",
    knownStatuses: opts.knownStatuses,
    endpoint: `/api/v1/${opts.module}/${opts.entityId}`,
    method: "PUT",
    bodyShape: {
      status: `<one of: ${opts.knownStatuses.join(" | ")}>`,
      reason: "<optional string>",
    },
    note: "This module has no formal state-machine matrix yet; knownStatuses lists every value the enum accepts. The PUT endpoint enforces server-side validation. For full transition matrices, see /risks/{id}/transitions or /dpms/dpia/{id}/transitions.",
  };
}
