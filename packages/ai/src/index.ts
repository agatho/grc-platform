// AI Abstraction Layer (ADR-008)
//
// [ARCTOS-FULL-2026-08-31 / WP6]
// Der produktive Weg ist `aiCompleteGoverned()` (governed.ts): Er
// entscheidet den Provider nach der Richtlinie der Organisation
// (fail-closed), validiert die Modellausgabe gegen ein Schema,
// protokolliert Provider und Jurisdiktion und liefert den
// Transparenzhinweis mit. `aiComplete()` bleibt der Low-Level-Weg für
// Aufrufer ohne Org-Kontext — auch er ist fail-closed, kennt aber nur
// die Betreiber-Ebene.
//
// `llm-provider.ts` (428 Zeilen, „ZERO vendor lock-in", nirgends
// importiert, ohne `response.ok`-Prüfung) ist mit S05-16 entfernt
// worden; die verdrahtete Abstraktion ist dieses Modul.

export {
  aiComplete,
  aiRouter,
  aiCompleteWithFailover,
  AllProvidersFailedError,
  getAvailableProviders,
  getLocalProviders,
  getDefaultProvider,
  operatorPolicySnapshot,
  localModelRegion,
  isAiProvider,
  ALL_PROVIDERS,
  type FailoverOptions,
} from "./router";
export {
  AiPolicyViolationError,
  DEFAULT_LOCAL_REGION,
  EU_ADEQUATE_REGIONS,
  EU_BOUND_COUNTRIES,
  AI_EGRESS_MODES,
  isAiEgressMode,
  defaultPolicySnapshot,
  evaluateProvider,
  selectProvider,
  providerPlacements,
  modeFromDataResidency,
  type AiEgressMode,
  type AiPolicyViolationCode,
  type OrgAiPolicySnapshot,
  type ProviderPlacement,
  type ProviderSelection,
  type ResidencyRuleSnapshot,
} from "./policy";
export {
  loadOrgAiPolicy,
  invalidateOrgAiPolicy,
  type LoadedOrgAiPolicy,
} from "./org-policy";
export {
  aiCompleteGoverned,
  AiOutputInvalidError,
  type AiDisclosure,
  type GovernedRequest,
  type GovernedResult,
  type OutputSchema,
} from "./governed";
export {
  buildDataPrompt,
  buildDataPromptWithNonce,
  safeText,
  safeTextList,
  safeData,
  DEFAULT_FIELD_CAP,
  type DataPromptArgs,
} from "./prompt-safety";
export {
  generateEmbedding,
  getEmbeddingProvider,
  padToStorageDimension,
  EMBEDDING_VECTOR_DIMENSION,
  type EmbeddingProvider,
  type EmbeddingProviderInfo,
} from "./embeddings";
export { callClaudeCli } from "./providers/claude-cli";
export { callClaudeApi } from "./providers/claude-api";
export { callOpenAI } from "./providers/openai";
export { callGemini } from "./providers/gemini";
export { callOllama } from "./providers/ollama";
export { callLmStudio } from "./providers/lmstudio";
export type {
  AiProvider,
  AiMessage,
  AiCompletionRequest,
  AiCompletionResponse,
  AiProviderConfig,
} from "./types";
export { DEFAULT_MODELS } from "./types";
export * from "./output-schemas";
export {
  buildTranslatePrompt,
  buildBatchTranslatePrompt,
  parseBatchTranslateResponse,
} from "./prompts/translate";
export {
  buildSoaGapPrompt,
  buildMaturityRoadmapPrompt,
  parseSoaGapResponse,
  parseMaturityRoadmapResponse,
  type ParsedSoaGap,
  type ParsedRoadmapAction,
} from "./prompts/isms-intelligence";
export {
  buildTextToBpmnPrompt,
  buildRiskSuggestionPrompt,
  buildControlSuggestionPrompt,
  buildDiagramOptimizationPrompt,
  buildFrameworkMappingPrompt,
  safeJsonParse,
} from "./prompts/bpm";
export {
  buildChecklistGenerationPrompt,
  buildFindingSuggestionPrompt,
  buildAuditConclusionPrompt,
} from "./prompts/audit";
export {
  buildVendorClassifyPrompt,
  buildDdQuestionDraftPrompt,
} from "./prompts/tprm";
export {
  buildRopaFieldDraftPrompt,
  buildDpiaMeasureDraftPrompt,
} from "./prompts/dpms";
export {
  buildPolicyDraftPrompt,
  type PolicyDraftPromptArgs,
  type PolicyDraftRequirement,
} from "./prompts/dms";
export {
  buildControlAdvisorPrompt,
  type ControlAdvisorPromptArgs,
  type ControlAdvisorCandidate,
} from "./prompts/erm";
export {
  buildGapExplanationPrompt,
  type GapExplanationPromptArgs,
} from "./prompts/compliance";
export {
  buildIcsControlSuggestionPrompt,
  buildTestPlanPrompt,
  buildRcmGapPrompt,
  buildRootCausePatternPrompt,
} from "./prompts/ics";
export {
  buildRegulatoryRelevancePrompt,
  buildCopilotPrompt,
  buildEamDescriptionPrompt,
  buildEamSuggestionsPrompt,
  GRC_MODULES,
  type CopilotRagSnippet,
} from "./prompts/platform";
