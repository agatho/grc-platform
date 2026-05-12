// #NIGHT-008/-016/-014: /api/v1/programmes root returned 404 because
// there is no flat "programme" entity — only journeys, templates,
// portfolio views, etc. Discovery payload + an explicit 405 on POST
// pointing the caller at /journeys (the canonical creation endpoint).

import { problem, getRequestId } from "@/lib/api-errors";

export function GET(req: Request) {
  return Response.json({
    data: {
      module: "programmes",
      description:
        "Programme cockpit — journeys (running compliance programmes), templates (ISO-27001/-31000/etc starting points), portfolio rollups, and reverse-engineering from findings",
      endpoints: [
        {
          method: "GET",
          path: "/api/v1/programmes/journeys",
          description: "List active journeys (use POST to create)",
        },
        {
          method: "POST",
          path: "/api/v1/programmes/journeys",
          description: "Start a new journey from a template",
        },
        {
          method: "GET",
          path: "/api/v1/programmes/templates",
          description: "Available templates (ISO 27001, ISO 31000, ...)",
        },
        {
          method: "GET",
          path: "/api/v1/programmes/portfolio",
          description: "Portfolio-level rollup",
        },
        {
          method: "GET",
          path: "/api/v1/programmes/my-work",
          description: "Items assigned to the current user",
        },
        {
          method: "POST",
          path: "/api/v1/programmes/reverse-from-finding",
          description: "Synthesize a journey from a finding",
        },
      ],
      requestId: getRequestId(req),
    },
  });
}

export function POST(req: Request) {
  return problem.methodNotAllowed({
    requestId: getRequestId(req),
    instance: req.url,
    method: "POST",
    allow: ["GET"],
    detail:
      "Programme creation goes through POST /api/v1/programmes/journeys (instantiate from template) or POST /api/v1/programmes/reverse-from-finding (synthesize from a finding). The bare /programmes path is read-only discovery.",
  });
}
export const PUT = POST;
export const PATCH = POST;
export const DELETE = POST;
