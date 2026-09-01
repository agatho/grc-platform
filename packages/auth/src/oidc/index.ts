// Sprint 20: OIDC service barrel export
export { discoverOIDCEndpoints } from "./discovery";
export { generatePKCE, verifyPKCE } from "./pkce";
export { exchangeCode } from "./token-exchange";
export type { TokenExchangeParams } from "./token-exchange";
export {
  // #WP3-S02-24: async, verifies the JWT signature against the provider JWKS.
  validateIdToken,
  validateIdTokenClaims,
  clearJwksCache,
  ALLOWED_ID_TOKEN_ALGORITHMS,
  decodeJwt,
  extractOidcAttributes,
} from "./id-token-validator";
export type {
  IdTokenClaims,
  IdTokenValidationOptions,
} from "./id-token-validator";
