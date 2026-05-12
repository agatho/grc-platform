// #WAVE6-WB-01: discovery payload for the intake channel.
// The 405 on POST /whistleblowing/cases points callers at /intake;
// hitting /intake itself returns this map so they don't 404 a second time.

function getRequestId(req: Request): string {
  return req.headers.get("x-request-id") ?? "";
}
export function GET(req: Request) {
  return Response.json({
    data: {
      module: "whistleblowing.intake",
      description:
        "HinSchG-conform anonymous tip submission. Submit at /submit — receive a report_token to check status later.",
      endpoints: [
        {
          method: "POST",
          path: "/api/v1/whistleblowing/intake/submit",
          description: "Anonymous (or contact-bearing) tip submission",
          bodyShape: {
            orgCode: "string (short org code from intake poster)",
            description: "string (tip body, min 20 chars)",
            category:
              "fraud|corruption|discrimination|harassment|safety_violation|data_protection|environment|other",
            contactEmail: "string (optional)",
            language: "de|en (default de)",
          },
        },
      ],
      requestId: getRequestId(req),
    },
  });
}
