// Sprint 20: OIDC Token Exchange — Authorization code for tokens
import type { OidcTokenResponse } from "@grc/shared";

export interface TokenExchangeParams {
  tokenEndpoint: string;
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret?: string;
  codeVerifier: string; // PKCE is mandatory
}

/**
 * Exchange an authorization code for tokens using the OIDC token endpoint.
 * Always includes PKCE code_verifier (S256 method, mandatory per security rules).
 *
 * @param params - Token exchange parameters
 * @returns Token response with access_token and id_token
 */
export async function exchangeCode(
  params: TokenExchangeParams,
): Promise<OidcTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
    client_id: params.clientId,
    code_verifier: params.codeVerifier,
  });

  if (params.clientSecret) {
    body.set("client_secret", params.clientSecret);
  }

  const response = await fetch(params.tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `OIDC token exchange failed: ${response.status} — ${errorBody}`,
    );
  }

  const tokens = await response.json();

  if (!tokens.access_token) {
    throw new Error("OIDC token exchange: missing access_token in response");
  }
  if (!tokens.id_token) {
    throw new Error("OIDC token exchange: missing id_token in response");
  }

  return {
    access_token: tokens.access_token,
    id_token: tokens.id_token,
    token_type: tokens.token_type ?? "Bearer",
    expires_in: tokens.expires_in ?? 3600,
    refresh_token: tokens.refresh_token,
    scope: tokens.scope,
  };
}
