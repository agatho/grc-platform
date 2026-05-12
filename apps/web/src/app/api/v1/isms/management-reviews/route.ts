// #NIGHT-005: legacy plural slug. The canonical API lives at
// /api/v1/isms/reviews. Return a 308 with Location so well-behaved
// clients follow it transparently.
//
// 308 (not 301) preserves the request method, so a POST sent to the
// old slug arrives at /reviews as a POST, not a GET.

function redirect308(req: Request, target: string): Response {
  const url = new URL(req.url);
  const newUrl = `${url.origin}${target}${url.search}`;
  return new Response(
    JSON.stringify({
      type: "https://arctos.charliehund.de/errors/permanent-redirect",
      title: "Permanent Redirect",
      status: 308,
      detail: `This endpoint moved to ${target}. Update your client.`,
      location: newUrl,
    }),
    {
      status: 308,
      headers: {
        "content-type": "application/problem+json; charset=utf-8",
        location: newUrl,
      },
    },
  );
}

export function GET(req: Request) {
  return redirect308(req, "/api/v1/isms/reviews");
}
export const POST = GET;
export const PUT = GET;
export const DELETE = GET;
