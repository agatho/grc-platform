// B1.2: minimal type surface for bpmn-moddle (the package ships no types).
// Only the API used by src/lib/bpmn-arctos-parse.ts and
// src/lib/bpmn-arctos-write.ts is declared.
//
// Note: the ESM build (dist/index.js, the only file referenced by the
// package's exports map) has NO default export — it exports the factory
// function `BpmnModdle` (alias of SimpleBpmnModdle) as a named export.

declare module "bpmn-moddle" {
  export interface ModdleElement {
    $type: string;
    id?: string;
    // moddle elements carry arbitrary schema-defined properties
    [key: string]: unknown;
  }

  export interface FromXmlResult {
    rootElement: ModdleElement;
    warnings: unknown[];
  }

  export interface BpmnModdleInstance {
    fromXML(xml: string): Promise<FromXmlResult>;
    toXML(
      element: ModdleElement,
      options?: { format?: boolean },
    ): Promise<{ xml: string }>;
    /** Instantiate a typed element, e.g. `create("arctos:GrcMetadata", {...})`. */
    create(
      type: string,
      properties?: Record<string, unknown>,
    ): ModdleElement;
  }

  /** Factory — pre-registers the BPMN packages plus the given extensions. */
  export function BpmnModdle(
    additionalPackages?: Record<string, unknown>,
    options?: Record<string, unknown>,
  ): BpmnModdleInstance;
}
