// AI Abstraction Layer (ADR-008)
// Multi-provider: Claude CLI (subscription), OpenAI, Gemini, Ollama
// Privacy-Router: personal data → Ollama (local), else → configured default

export {
  aiComplete,
  aiRouter,
  aiCompleteWithFailover,
  AllProvidersFailedError,
  getAvailableProviders,
  getDefaultProvider,
  type FailoverOptions,
} from "./router";
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
