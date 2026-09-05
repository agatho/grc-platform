// api-scim.ts
//
// [ARCTOS-FULL-2026-08-31 / Welle 4b-7 · OP-079 / OP-084]
//
// Die vier SCIM-Routen unter `app/api/v1/scim/v2/**` waren die einzigen
// ungewickelten Routen mit echtem Datenbankpfad, die man NICHT einfach in
// `withErrorHandler` stecken kann: der Wickel normalisiert jede Fehlerantwort
// auf `application/problem+json`, und ein SCIM-Client (Entra ID, Okta,
// OneLogin) verlangt nach RFC 7644 §3.12 `application/scim+json` mit
//
//     { "schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"],
//       "status": "422", "detail": "…" }
//
// Ein Problem-Details-Objekt an dieser Stelle ist für den Bereitsteller kein
// Fehler mit Erklärung, sondern eine unlesbare Antwort. Deshalb ein zweiter
// Wickel mit derselben Aufgabe und der richtigen Form: eine Stelle, an der
// jeder unbehandelte Fehler zu einer Antwort wird, statt zu einem 500er mit
// LEEREM Rumpf.
//
// Der leere Rumpf war der Ausgangszustand, gemessen am 2026-09-04: von den
// neun SCIM-Handlern hatten fünf überhaupt kein `try`. Ein SCIM-Bereitsteller,
// der eine Kennung schickt, die keine UUID ist — der Normalfall bei einem
// frisch verbundenen Verzeichnis —, löste in
// `scim/v2/Users/[id]` ein `invalid input syntax for type uuid` aus; die Route
// hatte dafür keinen Pfad, Next.js antwortete mit 500 ohne Rumpf, und der
// Bereitsteller protokollierte „unknown error".
//
// Die drei übrigen Handler HATTEN ein `catch` — und gaben `err.message`
// wörtlich zurück (§ derselbe Befund wie OP-174). Beides ist hier erledigt.

import { log } from "@/lib/logger";
import { sanitiseDbError, getRequestId } from "@/lib/api-errors";

export const SCIM_CONTENT_TYPE = "application/scim+json";

/**
 * [Welle 4b-7 · OP-079] Begründung für die 501 der vier Gruppen-Handler.
 * Sie steht hier und nicht in `Groups/route.ts`, weil eine `route.ts` im App
 * Router ausser den HTTP-Methoden und den bekannten Konfigurationsnamen
 * nichts exportieren darf — ein zusätzlicher Export lässt den Typprüflauf
 * des Produktionsbaus fallen.
 */
export const GROUPS_UNSUPPORTED_DETAIL =
  "Group provisioning is not supported by this service provider. " +
  "Provision users via /Users and manage authorization through ARCTOS roles.";

/** Antwortkörper in SCIM-Form. */
export function scimResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": SCIM_CONTENT_TYPE },
  });
}

/** SCIM-Fehlerobjekt nach RFC 7644 §3.12. */
export function scimError(
  detail: string,
  status: number,
  scimType?: string,
): Response {
  return scimResponse(
    {
      schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
      detail,
      status: String(status),
      ...(scimType ? { scimType } : {}),
    },
    status,
  );
}

interface PgLike {
  code?: string;
  detail?: string;
  message?: string;
}

/**
 * Dieselbe Zuordnung wie in `withErrorHandler` — Constraint- und
 * Formatverstösse als 400 (SCIM kennt kein 422; RFC 7644 §3.12 listet für
 * „unlesbare oder unzulässige Nutzdaten" 400 mit `scimType: invalidValue`),
 * Verbindungsabbrüche als 503, alles Übrige als 500. In KEINEM Fall geht der
 * Treibertext mit hinaus; er steht im Log unter derselben `requestId`.
 */
const CONSTRAINT_CODES = new Set(["23502", "23503", "23505", "23514", "23P01"]);
const INVALID_INPUT_CODES = new Set(["22P02", "22008", "22023", "22001"]);
const TIMEOUT_CODES = new Set([
  "CONNECT_TIMEOUT",
  "CONNECTION_ENDED",
  "CONNECTION_DESTROYED",
  "CONNECTION_CLOSED",
]);

type ScimHandler<TCtx> = (req: Request, ctx: TCtx) => Promise<Response>;

export function withScimErrorHandler<TCtx = unknown>(
  handler: ScimHandler<TCtx>,
  routeLabel: string,
): (req: Request, ctx?: TCtx) => Promise<Response> {
  return async (req, ctx) => {
    const requestId = getRequestId(req);
    try {
      return await handler(req, ctx as TCtx);
    } catch (err) {
      const e = err as PgLike;
      const logger = log.withContext({
        route: routeLabel,
        url: req.url,
        method: req.method,
        requestId,
        pgCode: e.code,
      });

      if (
        e.code &&
        (CONSTRAINT_CODES.has(e.code) || INVALID_INPUT_CODES.has(e.code))
      ) {
        logger.warn("scim: rejected payload", {
          message: e.message,
          detail: e.detail,
        });
        return scimError(sanitiseDbError(e).detail, 400, "invalidValue");
      }

      if (e.code && TIMEOUT_CODES.has(e.code)) {
        logger.error("scim: database unavailable", { message: e.message });
        return scimError(
          "The directory service is temporarily unavailable. Retry shortly.",
          503,
        );
      }

      logger.error("scim: unhandled handler error", {
        message: e.message ?? String(err),
        stack:
          err instanceof Error ? err.stack?.split("\n").slice(0, 5) : undefined,
      });
      return scimError(
        `An unexpected error occurred. The full error has been logged server-side; include requestId ${requestId} when reporting.`,
        500,
      );
    }
  };
}
