// #WAVE6-STATE-01: thin discovery helper for the 10+ modules that
// have a status field but no dedicated state-machine endpoint.
//
// Each module-specific route is a 12-line wrapper that fetches its
// row, calls this helper with the enum values + canonical endpoint
// hint, and returns the JSON. The QA expectation is "match the DPIA
// reference shape" — current status + a list to help the UI render
// status-change buttons — not a full transition validator.
//
// #WAVE15-NAMING: every other state-machine endpoint (risk, vendor,
// contract, process, dsr, dpia, incident, bia, audit) returns
// `allowedNext`. This helper now emits the same key — the legacy
// `knownStatuses` is preserved as an alias so existing UI consumers
// don't break, but new code should read `allowedNext`.

export interface TransitionsResponse {
  current: string;
  /** State-aware "what can I move to next" list. */
  allowedNext: readonly string[];
  /**
   * Every value the underlying enum accepts. For modules that lack a
   * formal transition matrix this is identical to `allowedNext`.
   * @deprecated read `allowedNext` instead.
   */
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
    allowedNext: opts.knownStatuses,
    knownStatuses: opts.knownStatuses,
    endpoint: `/api/v1/${opts.module}/${opts.entityId}`,
    method: "PUT",
    bodyShape: {
      status: `<one of: ${opts.knownStatuses.join(" | ")}>`,
      reason: "<optional string>",
    },
    note: "This module has no formal state-machine matrix yet; allowedNext therefore lists every value the enum accepts. The PUT endpoint enforces server-side validation. For full transition matrices, see /risks/{id}/transitions or /dpms/dpia/{id}/transitions.",
  };
}
