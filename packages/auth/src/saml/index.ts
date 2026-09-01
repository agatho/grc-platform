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
} from "./response-validator";
export type {
  VerifiedSamlResponse,
  SamlSignatureScope,
} from "./response-validator";
