// AI Abstraction Layer (ADR-008)
// Multi-provider: Claude, OpenAI, Gemini, Ollama
// Privacy-Router: personal data → Ollama (local), else → configured default

export { aiComplete, aiRouter, getAvailableProviders, getDefaultProvider } from "./router";
export { callClaude } from "./providers/claude";
export { callOpenAI } from "./providers/openai";
export { callGemini } from "./providers/gemini";
export { callOllama } from "./providers/ollama";
export type {
  AiProvider,
  AiMessage,
  AiCompletionRequest,
  AiCompletionResponse,
  AiProviderConfig,
} from "./types";
export { DEFAULT_MODELS } from "./types";
