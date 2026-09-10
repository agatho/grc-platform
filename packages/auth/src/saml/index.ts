// Sprint 20: SAML service barrel export
export {
  parseSAMLMetadata,
  fetchAndParseSAMLMetadata,
} from "./metadata-parser";
export {
  buildAuthnRequest,
  buildSamlRedirectUrl,
  encodeAuthnRequestForRedirect,
} from "./request-builder";
export {
  decodeSamlResponse,
  // #WP3-S02-23: `verifySamlResponse` is the ONLY entry point that binds the
  // verified signature to the assertion consumed afterwards. New callers must
  // use it; `validateSAMLSignature` remains a boolean-only legacy shim.
  verifySamlResponse,
  validateSAMLSignature,
  validateSAMLAssertion,
  extractSAMLAttributes,
  cleanupAssertionCache,
  rejectXXE,
  // [ARCTOS-FULL-2026-08-31 · OP-096] Die Betriebsansicht (GET
  // /api/v1/auth/sso/config) zeigt den Zertifikatsstatus an, damit die
  // Rotation ein geplanter Vorgang ist und nicht der Tag, an dem sich
  // niemand mehr anmelden kann.
  inspectIdpCertificate,
  assertIdpCertificateUsable,
  IDP_CERT_EXPIRY_WARNING_DAYS,
} from "./response-validator";
export type {
  VerifiedSamlResponse,
  SamlSignatureScope,
  IdpCertificateInfo,
} from "./response-validator";
