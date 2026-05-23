// Central helper for resolving the public base URL.
//
// #DEP-CONFIG-2: previously 8 SSO/SCIM/test routes had
// `process.env.NEXTAUTH_URL ?? "https://localhost:3000"`. On a
// misconfigured prod deploy that lost the env var, OIDC callbacks
// and SAML responses would silently point at localhost — login
// just stops working without any clear signal in the logs (other
// than the IDP's "callback URL didn't match" rejection).
//
// This helper fails fast on prod when the env var is missing, so
// the misconfiguration shows up at deploy time (in /api/v1/health
// or any route that calls this) rather than during a customer's
// SSO attempt.

const DEV_FALLBACK = "https://localhost:3000";

/**
 * Resolve the public base URL of this deployment. Throws in
 * production if NEXTAUTH_URL is unset; returns "https://localhost:3000"
 * in dev/test for ergonomics.
 *
 * Call this once per route handler; do not cache the result across
 * requests (env vars are stable, but the throw-on-missing is the
 * useful side effect).
 */
export function getBaseUrl(): string {
  const url = process.env.NEXTAUTH_URL;
  if (url) return url;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXTAUTH_URL is required in production — SSO callbacks, SAML " +
        "responses, and SCIM endpoints all need a stable public origin. " +
        "Set it in docker-compose.production.yml or the env file.",
    );
  }
  return DEV_FALLBACK;
}
