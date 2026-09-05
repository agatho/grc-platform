/**
 * Laufzeitschalter für den Parallelbetrieb zweier BPMN-Engines.
 *
 * Hintergrund: ARCTOS löst `bpmn-js` (Custom-Lizenz mit Wasserzeichenpflicht)
 * durch eine Eigenimplementierung auf `diagram-js` + `bpmn-moddle` (beide MIT)
 * ab. Der Plan (§5.4) verlangt ausdrücklich **keinen** Big Bang, sondern einen
 * Übergangsbetrieb, in dem beide Implementierungen im Baum liegen und zur
 * Laufzeit umschaltbar sind. Nur so lässt sich der Umstieg belegen statt
 * behaupten — und nur so gibt es einen Rückfallweg ohne Deploy (§5.7).
 *
 * ```
 * ARCTOS_BPMN_ENGINE = legacy | arctos      (Vorgabe: legacy)
 * ```
 *
 * Reihenfolge der Auswertung, von stark nach schwach:
 *
 * 1. ausdrückliches Argument (`resolveBpmnEngine({ explicit })`) — Prop, Test
 * 2. `?engine=arctos` in der Adresszeile (nur im Browser; für die Pilotphase
 *    S1 aus Plan §5.4: „nur lesende Ansichten, intern")
 * 3. `window.__ARCTOS_BPMN_ENGINE__` — Umschalten in der Konsole und in Tests,
 *    ohne die Seite neu zu laden
 * 4. `NEXT_PUBLIC_ARCTOS_BPMN_ENGINE` — die Fassung, die Next.js in das
 *    Client-Bündel einsetzt
 * 5. `ARCTOS_BPMN_ENGINE` — dieselbe Angabe serverseitig (Tests, Worker, SSR)
 * 6. Vorgabe `legacy`
 *
 * Die beiden Umgebungsvariablen werden als **wörtliche** Zugriffe geschrieben
 * (`process.env.NEXT_PUBLIC_ARCTOS_BPMN_ENGINE`), weil Next.js nur solche im
 * Client-Bündel ersetzt; ein dynamischer Zugriff wäre dort still `undefined`.
 *
 * Ein unbekannter Wert wird **nicht** geraten: er fällt auf `legacy` zurück.
 * Ein Tippfehler in der Betriebskonfiguration darf nicht dazu führen, dass
 * unbemerkt die neue Engine ausgeliefert wird.
 */

export type BpmnEngine = "legacy" | "arctos";

/** Vorgabe, wenn nichts gesetzt ist. Bewusst die alte Engine (Plan §5.4, S0). */
export const BPMN_ENGINE_DEFAULT: BpmnEngine = "legacy";

/** Name der Umgebungsvariablen — auch für Fehlermeldungen und Diagnose. */
export const BPMN_ENGINE_ENV_VAR = "ARCTOS_BPMN_ENGINE";
export const BPMN_ENGINE_PUBLIC_ENV_VAR = "NEXT_PUBLIC_ARCTOS_BPMN_ENGINE";
/** Abfrageparameter für den Aufruf-Override. */
export const BPMN_ENGINE_QUERY_PARAM = "engine";
/** Globale Variable für das Umschalten zur Laufzeit (Konsole, Tests). */
export const BPMN_ENGINE_GLOBAL = "__ARCTOS_BPMN_ENGINE__";

declare global {
  var __ARCTOS_BPMN_ENGINE__: string | undefined;
}

/** Prüft einen beliebigen Wert gegen die erlaubten Stellungen. */
export function isBpmnEngine(value: unknown): value is BpmnEngine {
  return value === "legacy" || value === "arctos";
}

function normalize(value: unknown): BpmnEngine | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return isBpmnEngine(trimmed) ? trimmed : null;
}

export interface ResolveBpmnEngineOptions {
  /** Ausdrückliche Stellung, z. B. aus einem Prop oder einem Test. */
  readonly explicit?: string | null | undefined;
  /**
   * Adresszeile, aus der `?engine=` gelesen wird. Vorgabe: die des Browsers.
   * Als Argument, damit die Auflösung eine reine Funktion bleibt.
   */
  readonly url?: string | null | undefined;
  /** Umgebung. Vorgabe: `process.env`. */
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** Laufzeit-Override. Vorgabe: `globalThis.__ARCTOS_BPMN_ENGINE__`. */
  readonly globalOverride?: string | null | undefined;
}

/**
 * Löst die Schalterstellung auf — reine Funktion, alle Quellen als Argument
 * überschreibbar. Alles, was der Adapter zur Laufzeit tut, ist diese Funktion
 * aufzurufen.
 */
export function resolveBpmnEngine(
  options: ResolveBpmnEngineOptions = {},
): BpmnEngine {
  const explicit = normalize(options.explicit);
  if (explicit) return explicit;

  const fromUrl = normalize(readEngineFromUrl(options.url));
  if (fromUrl) return fromUrl;

  const fromGlobal = normalize(
    options.globalOverride !== undefined
      ? options.globalOverride
      : readGlobalOverride(),
  );
  if (fromGlobal) return fromGlobal;

  const env = options.env ?? readEnv();
  const fromPublic = normalize(env[BPMN_ENGINE_PUBLIC_ENV_VAR]);
  if (fromPublic) return fromPublic;

  const fromServer = normalize(env[BPMN_ENGINE_ENV_VAR]);
  if (fromServer) return fromServer;

  return BPMN_ENGINE_DEFAULT;
}

/** Kurzform für den Normalfall im Browser. */
export function bpmnEngine(explicit?: string | null): BpmnEngine {
  return resolveBpmnEngine(explicit != null ? { explicit } : {});
}

/**
 * Wörtliche Zugriffe — sonst ersetzt Next.js sie im Client-Bündel nicht.
 * Beide sind einzeln abgesichert, weil `process` im Browser nur als
 * eingesetztes Objekt existiert und bei manchen Bündelungen ganz fehlt.
 */
function readEnv(): Readonly<Record<string, string | undefined>> {
  const out: Record<string, string | undefined> = {};
  try {
    out[BPMN_ENGINE_PUBLIC_ENV_VAR] =
      process.env.NEXT_PUBLIC_ARCTOS_BPMN_ENGINE;
    out[BPMN_ENGINE_ENV_VAR] = process.env.ARCTOS_BPMN_ENGINE;
  } catch {
    /* kein `process` — dann bleibt es bei der Vorgabe */
  }
  return out;
}

function readGlobalOverride(): string | undefined {
  try {
    return globalThis.__ARCTOS_BPMN_ENGINE__;
  } catch {
    return undefined;
  }
}

function readEngineFromUrl(url?: string | null): string | undefined {
  const href =
    url ??
    (typeof window !== "undefined" ? window.location?.href : undefined) ??
    undefined;
  if (!href) return undefined;
  try {
    return (
      new URL(href, "http://localhost").searchParams.get(
        BPMN_ENGINE_QUERY_PARAM,
      ) ?? undefined
    );
  } catch {
    return undefined;
  }
}
