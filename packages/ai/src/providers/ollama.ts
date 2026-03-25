import type { AiCompletionRequest, AiCompletionResponse } from "../types";

/**
 * Ollama — local model provider for privacy-sensitive data (GDPR).
 * Runs on the same network as the application server.
 * No data leaves the infrastructure.
 */
export async function callOllama(
  request: AiCompletionRequest,
): Promise<AiCompletionResponse> {
  const baseUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
  const model = request.model ?? "llama3.1:8b";

  const messages = request.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      options: {
        temperature: request.temperature ?? 0.3,
        num_predict: request.maxTokens ?? 4096,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => "Unknown error");
    throw new Error(`Ollama error (${response.status}): ${err}`);
  }

  const data = await response.json();

  return {
    text: data.message?.content ?? "",
    provider: "ollama",
    model,
    usage: {
      inputTokens: data.prompt_eval_count ?? 0,
      outputTokens: data.eval_count ?? 0,
    },
  };
}
