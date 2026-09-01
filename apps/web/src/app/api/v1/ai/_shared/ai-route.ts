// [ARCTOS-FULL-2026-08-31 / WP6 · S05-09, S05-10, S05-12, S05-14]
//
// Gemeinsame Routen-Schicht für alle 23 AI-Endpunkte.
//
// Der Audit hat die Kontrollabdeckung maschinell erhoben
// (`evidence/S05_ai_route_controls.csv`): Rate-Limit auf 5 von 23,
// Ausgabevalidierung auf 3 von 23, Protokollierung auf 7 von 23 — und
// jede der fünf Rate-Limit-Implementierungen war eine andere (zwei
// eigene `Map`s, eine Zeitfenster-Liste, eine DB-Abfrage auf
// `created_at`, einmal `@/lib/rate-limit`). Diese Datei ist die eine
// Stelle, an der eine AI-Route ihre Querschnittskontrollen bekommt.
//
// Das Rate-Limit nutzt ausdrücklich `@/lib/rate-limit` (Eigentum von
// WP9) über dessen bestehende API — hier wird nichts an der Bibliothek
// geändert. Bekannte, an WP9 gemeldete Grenzen: fail-open ohne Redis und
// In-Memory-Bucket je Container.
//
// Verzeichnisname mit Unterstrich: Next.js behandelt `_shared` als
// private Ordner und erzeugt daraus keine Route.

import { NextResponse } from "next/server";
import { rateLimit, LIMITS } from "@/lib/rate-limit";
import {
  AiPolicyViolationError,
  AiOutputInvalidError,
  type AiDisclosure,
} from "@grc/ai";

const PROBLEM_BASE = "https://arctos.charliehund.de/errors";

function problem(
  status: number,
  type: string,
  title: string,
  detail: string,
  extra: Record<string, unknown> = {},
  headers: Record<string, string> = {},
): Response {
  return new Response(
    JSON.stringify({
      type: `${PROBLEM_BASE}/${type}`,
      title,
      status,
      detail,
      ...extra,
    }),
    {
      status,
      headers: {
        "Content-Type": "application/problem+json; charset=utf-8",
        ...headers,
      },
    },
  );
}

/**
 * Token-Bucket je Nutzer für AI-Aufrufe. Gibt `null` zurück, wenn der
 * Aufruf erlaubt ist, sonst die fertige 429-Antwort.
 *
 * `bucket` erlaubt es, teure Endpunkte (BPMN-Generierung, Übersetzung
 * über alle Zielsprachen) in einen eigenen, engeren Eimer zu legen,
 * statt sie sich mit den billigen zu teilen.
 */
export async function aiRateLimit(
  userId: string,
  opts: { bucket?: string; capacity?: number; windowSeconds?: number } = {},
): Promise<Response | null> {
  const limits = {
    capacity: opts.capacity ?? LIMITS.AI_ASSIST.capacity,
    windowSeconds: opts.windowSeconds ?? LIMITS.AI_ASSIST.windowSeconds,
  };
  const limit = await rateLimit({
    key: `ai:${opts.bucket ?? "assist"}:${userId}`,
    ...limits,
  });
  if (limit.allowed) return null;
  return problem(
    429,
    "rate-limited",
    "Rate limit exceeded",
    `AI-Rate-Limit erreicht. Erneut versuchen in ${limit.retryAfterSeconds}s.`,
    {},
    { "Retry-After": String(limit.retryAfterSeconds) },
  );
}

/**
 * Einheitliche Fehlerabbildung für AI-Aufrufe.
 *
 *   403 — die Richtlinie der Organisation verbietet den Aufruf. Das ist
 *         der sichtbare Fehlschlag, den S05-01 verlangt: er ersetzt den
 *         stillen Cloud-Fallback.
 *   503 — der Betreiber hat überhaupt keinen Provider freigeschaltet.
 *   422 — das Modell hat etwas geliefert, das dem Schema nicht genügt
 *         (S05-09). Es wird NICHTS persistiert.
 *   502 — der Provider selbst ist ausgefallen.
 */
export function aiErrorResponse(err: unknown): Response {
  if (err instanceof AiPolicyViolationError) {
    const status = err.code === "no_provider_configured" ? 503 : 403;
    return problem(
      status,
      status === 503 ? "ai-not-configured" : "ai-policy-violation",
      status === 503
        ? "Kein KI-Provider konfiguriert"
        : "KI-Richtlinie der Organisation",
      err.message,
      {
        code: err.code,
        egressMode: err.egressMode,
        permittedProviders: err.permittedProviders,
        requestedProvider: err.requestedProvider,
      },
    );
  }
  if (err instanceof AiOutputInvalidError) {
    return problem(
      422,
      "ai-output-invalid",
      "Unbrauchbare Modellantwort",
      "Das Modell hat keine Antwort im erwarteten Format geliefert. Es wurde nichts gespeichert.",
      { rawSample: err.rawSample },
    );
  }
  const message = err instanceof Error ? err.message : String(err);
  return problem(
    502,
    "ai-provider-failure",
    "KI-Provider nicht erreichbar",
    message,
  );
}

/**
 * Antwort-Hülle für AI-Ergebnisse. Der Transparenzhinweis (AI Act
 * Art. 50) reist ab jetzt MIT der Antwort — vorher hing er an drei
 * einzelnen React-Komponenten, die ihn hartkodiert hatten (S05-12), und
 * er nannte den Empfänger der Daten nicht.
 */
export function aiJson<T extends Record<string, unknown>>(
  data: T,
  disclosure: AiDisclosure,
  init?: { status?: number },
): Response {
  return NextResponse.json(
    { data: { ...data, aiDisclosure: disclosure } },
    { status: init?.status ?? 200 },
  );
}

export { PROBLEM_BASE };
