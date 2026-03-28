// Sprint 51: Provider-Agnostic LLM Abstraction Layer
// ZERO vendor lock-in — all LLM calls go through this interface

export interface LLMProvider {
  id: string;
  name: string;
  chat(messages: ChatMessage[], options?: LLMOptions): Promise<LLMResponse>;
  isConfigured(): boolean;
  validateConfig(): Promise<{ valid: boolean; error?: string }>;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
}

export interface LLMResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  provider: string;
  model: string;
  finishReason?: string;
}

export interface LLMProviderConfig {
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  organizationId?: string;
  azureDeployment?: string;
  azureApiVersion?: string;
}

// ──────────────────────────────────────────────────────────────
// OpenAI Provider
// ──────────────────────────────────────────────────────────────

export class OpenAIProvider implements LLMProvider {
  id = "openai";
  name = "OpenAI";
  private config: LLMProviderConfig;

  constructor(config: LLMProviderConfig) {
    this.config = config;
  }

  isConfigured(): boolean {
    return !!this.config.apiKey && this.config.apiKey.length > 10;
  }

  async validateConfig(): Promise<{ valid: boolean; error?: string }> {
    if (!this.isConfigured()) return { valid: false, error: "API key missing" };
    try {
      const response = await fetch(`${this.config.baseUrl ?? "https://api.openai.com/v1"}/models`, {
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
      });
      return { valid: response.ok, error: response.ok ? undefined : `HTTP ${response.status}` };
    } catch (err) {
      return { valid: false, error: err instanceof Error ? err.message : "Connection failed" };
    }
  }

  async chat(messages: ChatMessage[], options?: LLMOptions): Promise<LLMResponse> {
    const response = await fetch(`${this.config.baseUrl ?? "https://api.openai.com/v1"}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
        ...(this.config.organizationId ? { "OpenAI-Organization": this.config.organizationId } : {}),
      },
      body: JSON.stringify({
        model: this.config.model ?? "gpt-4o",
        messages,
        max_tokens: options?.maxTokens ?? this.config.maxTokens ?? 4096,
        temperature: options?.temperature ?? this.config.temperature ?? 0.7,
      }),
    });

    const data = await response.json();
    return {
      text: data.choices?.[0]?.message?.content ?? "",
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
      provider: "openai",
      model: this.config.model ?? "gpt-4o",
      finishReason: data.choices?.[0]?.finish_reason,
    };
  }
}

// ──────────────────────────────────────────────────────────────
// Anthropic Provider
// ──────────────────────────────────────────────────────────────

export class AnthropicProvider implements LLMProvider {
  id = "anthropic";
  name = "Anthropic";
  private config: LLMProviderConfig;

  constructor(config: LLMProviderConfig) {
    this.config = config;
  }

  isConfigured(): boolean {
    return !!this.config.apiKey && this.config.apiKey.length > 10;
  }

  async validateConfig(): Promise<{ valid: boolean; error?: string }> {
    if (!this.isConfigured()) return { valid: false, error: "API key missing" };
    return { valid: true };
  }

  async chat(messages: ChatMessage[], options?: LLMOptions): Promise<LLMResponse> {
    const systemMsg = messages.find((m) => m.role === "system");
    const nonSystemMessages = messages.filter((m) => m.role !== "system");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": this.config.apiKey!,
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.config.model ?? "claude-sonnet-4-20250514",
        max_tokens: options?.maxTokens ?? this.config.maxTokens ?? 4096,
        system: systemMsg?.content,
        messages: nonSystemMessages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    const data = await response.json();
    return {
      text: data.content?.[0]?.text ?? "",
      usage: data.usage ? {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: (data.usage.input_tokens ?? 0) + (data.usage.output_tokens ?? 0),
      } : undefined,
      provider: "anthropic",
      model: this.config.model ?? "claude-sonnet-4-20250514",
      finishReason: data.stop_reason,
    };
  }
}

// ──────────────────────────────────────────────────────────────
// Azure OpenAI Provider
// ──────────────────────────────────────────────────────────────

export class AzureOpenAIProvider implements LLMProvider {
  id = "azure_openai";
  name = "Azure OpenAI";
  private config: LLMProviderConfig;

  constructor(config: LLMProviderConfig) {
    this.config = config;
  }

  isConfigured(): boolean {
    return !!this.config.apiKey && !!this.config.baseUrl && !!this.config.azureDeployment;
  }

  async validateConfig(): Promise<{ valid: boolean; error?: string }> {
    if (!this.isConfigured()) return { valid: false, error: "API key, base URL, or deployment missing" };
    return { valid: true };
  }

  async chat(messages: ChatMessage[], options?: LLMOptions): Promise<LLMResponse> {
    const apiVersion = this.config.azureApiVersion ?? "2024-02-15-preview";
    const url = `${this.config.baseUrl}/openai/deployments/${this.config.azureDeployment}/chat/completions?api-version=${apiVersion}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "api-key": this.config.apiKey!, "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        max_tokens: options?.maxTokens ?? this.config.maxTokens ?? 4096,
        temperature: options?.temperature ?? this.config.temperature ?? 0.7,
      }),
    });

    const data = await response.json();
    return {
      text: data.choices?.[0]?.message?.content ?? "",
      provider: "azure_openai",
      model: this.config.azureDeployment ?? "unknown",
    };
  }
}

// ──────────────────────────────────────────────────────────────
// Ollama Provider (local/self-hosted)
// ──────────────────────────────────────────────────────────────

export class OllamaProvider implements LLMProvider {
  id = "ollama";
  name = "Ollama (Local)";
  private config: LLMProviderConfig;

  constructor(config: LLMProviderConfig) {
    this.config = config;
  }

  isConfigured(): boolean {
    return !!this.config.baseUrl;
  }

  async validateConfig(): Promise<{ valid: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.config.baseUrl ?? "http://localhost:11434"}/api/tags`);
      return { valid: response.ok };
    } catch {
      return { valid: false, error: "Cannot connect to Ollama" };
    }
  }

  async chat(messages: ChatMessage[], options?: LLMOptions): Promise<LLMResponse> {
    const response = await fetch(`${this.config.baseUrl ?? "http://localhost:11434"}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.config.model ?? "llama3",
        messages,
        stream: false,
      }),
    });

    const data = await response.json();
    return {
      text: data.message?.content ?? "",
      provider: "ollama",
      model: this.config.model ?? "llama3",
    };
  }
}

// ──────────────────────────────────────────────────────────────
// Mistral Provider
// ──────────────────────────────────────────────────────────────

export class MistralProvider implements LLMProvider {
  id = "mistral";
  name = "Mistral";
  private config: LLMProviderConfig;

  constructor(config: LLMProviderConfig) {
    this.config = config;
  }

  isConfigured(): boolean {
    return !!this.config.apiKey;
  }

  async validateConfig(): Promise<{ valid: boolean; error?: string }> {
    if (!this.isConfigured()) return { valid: false, error: "API key missing" };
    return { valid: true };
  }

  async chat(messages: ChatMessage[], options?: LLMOptions): Promise<LLMResponse> {
    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.config.model ?? "mistral-large-latest",
        messages,
        max_tokens: options?.maxTokens ?? this.config.maxTokens ?? 4096,
        temperature: options?.temperature ?? this.config.temperature ?? 0.7,
      }),
    });

    const data = await response.json();
    return {
      text: data.choices?.[0]?.message?.content ?? "",
      provider: "mistral",
      model: this.config.model ?? "mistral-large-latest",
    };
  }
}

// ──────────────────────────────────────────────────────────────
// Custom OpenAI-Compatible Provider
// ──────────────────────────────────────────────────────────────

export class CustomOpenAICompatibleProvider implements LLMProvider {
  id = "custom";
  name = "Custom (OpenAI-compatible)";
  private config: LLMProviderConfig;

  constructor(config: LLMProviderConfig) {
    this.config = config;
  }

  isConfigured(): boolean {
    return !!this.config.baseUrl;
  }

  async validateConfig(): Promise<{ valid: boolean; error?: string }> {
    if (!this.config.baseUrl) return { valid: false, error: "Base URL missing" };
    return { valid: true };
  }

  async chat(messages: ChatMessage[], options?: LLMOptions): Promise<LLMResponse> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.config.apiKey) headers.Authorization = `Bearer ${this.config.apiKey}`;

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: this.config.model ?? "default",
        messages,
        max_tokens: options?.maxTokens ?? this.config.maxTokens ?? 4096,
        temperature: options?.temperature ?? this.config.temperature ?? 0.7,
      }),
    });

    const data = await response.json();
    return {
      text: data.choices?.[0]?.message?.content ?? "",
      provider: "custom",
      model: this.config.model ?? "default",
    };
  }
}

// ──────────────────────────────────────────────────────────────
// Factory
// ──────────────────────────────────────────────────────────────

export function createLLMProvider(config: LLMProviderConfig): LLMProvider {
  switch (config.provider) {
    case "openai":
      return new OpenAIProvider(config);
    case "anthropic":
      return new AnthropicProvider(config);
    case "azure_openai":
      return new AzureOpenAIProvider(config);
    case "ollama":
      return new OllamaProvider(config);
    case "mistral":
      return new MistralProvider(config);
    case "custom":
      return new CustomOpenAICompatibleProvider(config);
    default:
      throw new Error(`Unknown LLM provider: ${config.provider}`);
  }
}
