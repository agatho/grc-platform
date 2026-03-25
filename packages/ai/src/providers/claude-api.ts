import Anthropic from "@anthropic-ai/sdk";
import type { AiCompletionRequest, AiCompletionResponse } from "../types";

/**
 * Claude API provider — uses Anthropic API with API key.
 * Requires ANTHROPIC_API_KEY env var (separate billing from subscription).
 */
export async function callClaudeApi(
  request: AiCompletionRequest,
): Promise<AiCompletionResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

  const client = new Anthropic({ apiKey });
  const model = request.model ?? "claude-sonnet-4-20250514";

  const systemMsg = request.messages.find((m) => m.role === "system");
  const userMsgs = request.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const response = await client.messages.create({
    model,
    max_tokens: request.maxTokens ?? 4096,
    temperature: request.temperature ?? 0.3,
    system: systemMsg?.content ?? "",
    messages: userMsgs,
  });

  const text =
    response.content[0]?.type === "text" ? response.content[0].text : "";

  return {
    text,
    provider: "claude_api",
    model,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  };
}
