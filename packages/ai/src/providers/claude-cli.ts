import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { AiCompletionRequest, AiCompletionResponse } from "../types";

const execFileAsync = promisify(execFile);

/**
 * Claude CLI provider — uses Claude Code in print mode (-p).
 * Authenticates via the user's Claude subscription (Pro/Team/Enterprise).
 * No API key needed — uses the same auth as the interactive Claude Code CLI.
 *
 * Requires: `claude` CLI installed and authenticated on the system.
 */
export async function callClaudeCli(
  request: AiCompletionRequest,
): Promise<AiCompletionResponse> {
  const claudePath = process.env.CLAUDE_CLI_PATH ?? "claude";

  // Build the prompt from messages
  const systemMsg = request.messages.find((m) => m.role === "system");
  const userMsgs = request.messages.filter((m) => m.role !== "system");

  const parts: string[] = [];
  if (systemMsg) parts.push(systemMsg.content);
  for (const msg of userMsgs) {
    parts.push(msg.content);
  }
  const prompt = parts.join("\n\n");

  // Build CLI args
  const args: string[] = [
    "-p", prompt,          // print mode: non-interactive, outputs response and exits
    "--output-format", "text",
  ];

  // Add max tokens if specified
  if (request.maxTokens) {
    args.push("--max-turns", "1");
  }

  // Add system prompt via --system-prompt if available
  if (systemMsg) {
    args.push("--system-prompt", systemMsg.content);
    // Rebuild prompt without system message
    const userPrompt = userMsgs.map((m) => m.content).join("\n\n");
    args[1] = userPrompt;
  }

  try {
    const { stdout, stderr } = await execFileAsync(claudePath, args, {
      timeout: 120_000, // 2 minute timeout
      maxBuffer: 10 * 1024 * 1024, // 10 MB
      env: { ...process.env },
    });

    if (stderr && !stdout) {
      throw new Error(`Claude CLI error: ${stderr}`);
    }

    return {
      text: stdout.trim(),
      provider: "claude_cli",
      model: "claude-subscription",
      usage: undefined, // CLI doesn't report token usage
    };
  } catch (err: unknown) {
    const error = err as Error & { code?: string; killed?: boolean };

    if (error.killed) {
      throw new Error("Claude CLI timed out after 120 seconds");
    }
    if (error.code === "ENOENT") {
      throw new Error(
        `Claude CLI not found at '${claudePath}'. Install it or set CLAUDE_CLI_PATH in .env`,
      );
    }
    throw new Error(`Claude CLI failed: ${error.message}`);
  }
}
