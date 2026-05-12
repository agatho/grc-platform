// #NIGHT-031: GET /api/v1/bcms/crisis/dashboard was crashing with 500
// because the request was being routed to the dynamic [id] handler
// with id="dashboard" — which then ran an `eq(crisisScenario.id, "dashboard")`
// against a uuid column and crashed on invalid_text_representation.
//
// The UI's crisis-dashboard view aggregates from /bcms/dashboard +
// the /crisis list endpoint, not from a dedicated /crisis/dashboard.
// Returning a 404 with a hint short-circuits the [id] catch.

import { problem, getRequestId } from "@/lib/api-errors";

export function GET(req: Request) {
  return problem.notFound({
    requestId: getRequestId(req),
    instance: req.url,
    detail:
      "There is no /bcms/crisis/dashboard resource. The UI dashboard at /bcms/crisis aggregates from GET /api/v1/bcms/dashboard and GET /api/v1/bcms/crisis (list).",
  });
}
