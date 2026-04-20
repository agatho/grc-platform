import type { AiCompletionRequest, AiCompletionResponse } from "../types";

/**
 * LM Studio — local model provider exposing an OpenAI-compatible REST API.
 *
 * Unlike Ollama, LM Studio ships a GUI and exposes `/v1/chat/completions`
 * on a local port (default 1234). We prefer a plain `fetch` over the
 * OpenAI SDK because LM Studio has historically deviated from the spec
 * on trailing-slash handling and on non-OpenAI fields in the response.
 *
 * Privacy: data stays on the host; no egress to vendor cloud.
 */
export async function callLmStudio(
  request: AiCompletionRequest,
): Promise<AiCompletionResponse> {
  const baseUrl = (
    process.env.LMSTUDIO_BASE_URL ?? "http://localhost:1234"
  ).replace(/\/$/, "");
  const model =
    request.model ?? process.env.LMSTUDIO_DEFAULT_MODEL ?? "local-model";

  const messages = request.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // LM Studio ignores Bearer but we set it for proxies that don't.
      Authorization: `Bearer ${process.env.LMSTUDIO_API_KEY ?? "lm-studio"}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: request.temperature ?? 0.3,
      max_tokens: request.maxTokens ?? 4096,
      stream: false,
    }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => "Unknown error");
    throw new Error(`LM Studio error (${response.status}): ${err}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    model?: string;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  return {
    text: data.choices?.[0]?.message?.content ?? "",
    provider: "lmstudio",
    model: data.model ?? model,
    usage: {
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
    },
  };
}
