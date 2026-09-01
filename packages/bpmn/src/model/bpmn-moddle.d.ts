/**
 * Type surface for `bpmn-moddle@10`, which ships no types of its own.
 *
 * Kept deliberately close to `apps/web/src/types/bpmn-moddle.d.ts` so that the
 * two declarations cannot drift into disagreement, but widened where this
 * package needs more than the web app does (warnings, `$parent`,
 * `fromXML` type hints, `toXML` options).
 *
 * Note: the ESM build (`dist/index.js`, the only entry in the exports map) has
 * NO default export — `BpmnModdle` is a *named* factory function.
 */
declare module "bpmn-moddle" {
  export interface ModdleElement {
    $type: string;
    id?: string;
    /** Attributes moddle did not recognise, kept verbatim. */
    $attrs?: Record<string, unknown>;
    /** Children moddle did not recognise, kept verbatim. */
    $children?: ModdleElement[];
    $parent?: ModdleElement;
    [key: string]: unknown;
  }

  export interface ModdleWarning {
    message?: string;
    element?: ModdleElement;
    property?: string;
    [key: string]: unknown;
  }

  export interface FromXmlResult {
    rootElement: ModdleElement;
    elementsById: Record<string, ModdleElement>;
    references: unknown[];
    warnings: ModdleWarning[];
  }

  export interface ToXmlOptions {
    format?: boolean;
    preamble?: boolean;
    /** Extra namespace prefix → uri declarations forced onto the root. */
    [key: string]: unknown;
  }

  export interface BpmnModdleInstance {
    fromXML(xml: string, typeName?: string): Promise<FromXmlResult>;
    toXML(
      element: ModdleElement,
      options?: ToXmlOptions,
    ): Promise<{ xml: string }>;
    /** Instantiate a typed element, e.g. `create("arctos:GrcMetadata", {…})`. */
    create(type: string, properties?: Record<string, unknown>): ModdleElement;
    getType(type: string): unknown;
  }

  /** Factory — pre-registers the BPMN packages plus the given extensions. */
  export function BpmnModdle(
    additionalPackages?: Record<string, unknown>,
    options?: Record<string, unknown>,
  ): BpmnModdleInstance;
}
