// #NIGHT-036: /api/v1/admin/organizations 308-redirect to the
// canonical /api/v1/organizations.

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
  return redirect308(req, "/api/v1/organizations");
}
export const POST = GET;
export const PUT = GET;
export const DELETE = GET;
