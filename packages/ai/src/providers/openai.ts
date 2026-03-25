import OpenAI from "openai";
import type { AiCompletionRequest, AiCompletionResponse } from "../types";

export async function callOpenAI(
  request: AiCompletionRequest,
): Promise<AiCompletionResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const client = new OpenAI({ apiKey });
  const model = request.model ?? "gpt-4o";

  const messages = request.messages.map((m) => ({
    role: m.role as "system" | "user" | "assistant",
    content: m.content,
  }));

  const response = await client.chat.completions.create({
    model,
    max_tokens: request.maxTokens ?? 4096,
    temperature: request.temperature ?? 0.3,
    messages,
  });

  const text = response.choices[0]?.message?.content ?? "";

  return {
    text,
    provider: "openai",
    model,
    usage: {
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
    },
  };
}
