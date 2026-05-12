// #NIGHT-036: helper for 308 alias routes.
// 308 (Permanent Redirect) preserves the request method, so a POST
// sent to the legacy slug arrives at the new endpoint as a POST,
// not coerced to a GET like 301 would do.

export function alias308(req: Request, target: string): Response {
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
