// AI Privacy Router (ADR-008)
export async function aiRouter(opts: {
  prompt: string;
  containsPersonalData: boolean;
  useCase: string;
}) {
  if (opts.containsPersonalData) {
    // Route to Ollama (local)
    return callOllama(opts.prompt);
  }
  // Route to Claude API
  return callClaude(opts.prompt);
}

async function callClaude(prompt: string) {
  // TODO: Implement with @anthropic-ai/sdk
  return { text: "", provider: "claude_api" as const };
}

async function callOllama(prompt: string) {
  // TODO: Implement with local Ollama instance
  return { text: "", provider: "ollama_local" as const };
}
