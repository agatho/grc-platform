import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AiCompletionRequest, AiCompletionResponse } from "../types";

export async function callGemini(
  request: AiCompletionRequest,
): Promise<AiCompletionResponse> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_AI_API_KEY is not configured");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = request.model ?? "gemini-2.0-flash";
  const generativeModel = genAI.getGenerativeModel({ model });

  // Combine system + user messages into a single prompt for Gemini
  const systemMsg = request.messages.find((m) => m.role === "system");
  const userMsgs = request.messages.filter((m) => m.role !== "system");

  const parts: string[] = [];
  if (systemMsg) parts.push(`[System Instructions]\n${systemMsg.content}\n`);
  for (const msg of userMsgs) {
    parts.push(
      `[${msg.role === "user" ? "User" : "Assistant"}]\n${msg.content}`,
    );
  }

  const result = await generativeModel.generateContent({
    contents: [{ role: "user", parts: [{ text: parts.join("\n\n") }] }],
    generationConfig: {
      maxOutputTokens: request.maxTokens ?? 4096,
      temperature: request.temperature ?? 0.3,
    },
  });

  const response = result.response;
  const text = response.text();

  return {
    text,
    provider: "gemini",
    model,
    usage: {
      inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
    },
  };
}
