// AI Abstraction Layer (ADR-008)
// Multi-provider: Claude CLI (subscription), OpenAI, Gemini, Ollama
// Privacy-Router: personal data → Ollama (local), else → configured default

export { aiComplete, aiRouter, getAvailableProviders, getDefaultProvider } from "./router";
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
export { buildTranslatePrompt, buildBatchTranslatePrompt, parseBatchTranslateResponse } from "./prompts/translate";
export {
  buildSoaGapPrompt,
  buildMaturityRoadmapPrompt,
  parseSoaGapResponse,
  parseMaturityRoadmapResponse,
  type ParsedSoaGap,
  type ParsedRoadmapAction,
} from "./prompts/isms-intelligence";
