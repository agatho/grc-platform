import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { AiCompletionRequest, AiCompletionResponse } from "../types";

const execFileAsync = promisify(execFile);

// [ARCTOS-FULL-2026-08-31 / WP6 · S05-05]
//
// Drei Härtungen gegenüber dem Auditstand:
//
//  1. **Prompt nicht mehr in `argv`.** Der vollständige Prompt — inklusive
//     Risiko-, ROPA- und Vorfalltexten — stand in der Kommandozeile des
//     `claude`-Prozesses und war damit über `/proc/<pid>/cmdline` bzw.
//     `ps auxww` für jeden lokalen Benutzer im selben PID-Namespace
//     lesbar. Der Prompt geht jetzt über **stdin**; `argv` enthält nur
//     noch Schalter. (`--system-prompt` bleibt in argv: er ist eine
//     Konstante des Builders, kein Nutzerinhalt — siehe Prüfung unten,
//     die das erzwingt.)
//  2. **Minimales Environment.** `env: { ...process.env }` reichte
//     `DATABASE_URL`, `APP_DATABASE_URL`, `AUTH_SECRET`, `RESEND_API_KEY`
//     und sämtliche Provider-Keys an den Subprozess weiter. Der
//     Subprozess bekommt jetzt eine Allowlist: PATH, HOME und die
//     `CLAUDE_*`/`ANTHROPIC_*`-Variablen, die er für seine eigene
//     Authentifizierung braucht.
//  3. **Werkzeug-Allowlist.** Es wurden weder `--allowedTools`/
//     `--disallowedTools` noch ein Permission-Mode gesetzt; ein
//     allgemeiner Coding-Agent lief mit angreiferbeeinflusstem Text auf
//     dem Applikationsserver. Jetzt: `--disallowedTools` für alle
//     Werkzeuge mit Seiteneffekt und
//     `--permission-mode plan` (überschreibbar via
//     `CLAUDE_CLI_PERMISSION_MODE`, falls eine CLI-Version den Schalter
//     anders nennt — der Aufruf scheitert dann sichtbar statt still
//     unbeschränkt zu laufen).

/** Werkzeuge, die eine Textvervollständigung nie braucht. */
const DISALLOWED_TOOLS = [
  "Bash",
  "Edit",
  "Write",
  "NotebookEdit",
  "Read",
  "Glob",
  "Grep",
  "WebFetch",
  "WebSearch",
  "Task",
].join(",");

/** Variablen, die der Subprozess sehen darf. Alles andere bleibt draußen. */
function subprocessEnv(): Record<string, string> {
  const allowPrefixes = ["CLAUDE_", "ANTHROPIC_"];
  const allowExact = new Set([
    "PATH",
    "HOME",
    "LANG",
    "LC_ALL",
    "TZ",
    "TMPDIR",
    "XDG_CONFIG_HOME",
    "XDG_CACHE_HOME",
    "NODE_EXTRA_CA_CERTS",
    "HTTPS_PROXY",
    "HTTP_PROXY",
    "NO_PROXY",
  ]);
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined) continue;
    if (allowExact.has(k) || allowPrefixes.some((p) => k.startsWith(p))) {
      env[k] = v;
    }
  }
  // Der CLI-Pfad selbst ist kein Auth-Material und wird nicht gebraucht.
  delete env.CLAUDE_CLI_PATH;
  return env;
}

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

  const systemMsg = request.messages.find((m) => m.role === "system");
  const userMsgs = request.messages.filter((m) => m.role !== "system");
  const userPrompt = userMsgs.map((m) => m.content).join("\n\n");

  // Prompt kommt über stdin (`-p` ohne Argument liest stdin).
  const args: string[] = ["-p", "--output-format", "text"];

  args.push("--disallowedTools", DISALLOWED_TOOLS);
  args.push(
    "--permission-mode",
    process.env.CLAUDE_CLI_PERMISSION_MODE ?? "plan",
  );
  args.push("--max-turns", "1");

  if (systemMsg) {
    args.push("--append-system-prompt", systemMsg.content);
  }

  try {
    const child = execFileAsync(claudePath, args, {
      timeout: 120_000, // 2 minute timeout
      maxBuffer: 10 * 1024 * 1024, // 10 MB
      // `NodeJS.ProcessEnv` ist im Repo so augmentiert, dass NODE_ENV
      // Pflicht ist. Die Allowlist ist bewusst eine reine Untermenge —
      // der Cast hält das Env klein, statt NODE_ENV nur der Typprüfung
      // wegen an den Subprozess durchzureichen.
      env: subprocessEnv() as NodeJS.ProcessEnv,
    });
    child.child.stdin?.end(userPrompt);
    const { stdout, stderr } = await child;

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
      // Kein Pfad in der Fehlermeldung: sie wird bei ?probe=true an
      // authentifizierte Nutzer zurückgegeben (S05-14).
      throw new Error(
        "Claude CLI not found. Install it or set CLAUDE_CLI_PATH in the server environment.",
      );
    }
    throw new Error(`Claude CLI failed: ${error.message}`);
  }
}
