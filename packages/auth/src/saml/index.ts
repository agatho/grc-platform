// Sprint 20: SAML service barrel export
export { parseSAMLMetadata, fetchAndParseSAMLMetadata } from "./metadata-parser";
export { buildAuthnRequest, buildSamlRedirectUrl, encodeAuthnRequestForRedirect } from "./request-builder";
export {
  decodeSamlResponse,
  validateSAMLSignature,
  validateSAMLAssertion,
  extractSAMLAttributes,
} from "./response-validator";
