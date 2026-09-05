// B1.2: minimal type surface for bpmn-moddle (the package ships no types).
//
// Kept in step with `packages/bpmn/src/model/bpmn-moddle.d.ts`. Two ambient
// declarations of the same module in two TypeScript programs are a standing
// invitation to drift — and they did: this file used to be the narrower of the
// two, which made `import ... from "@grc/bpmn"` fail to type-check inside this
// app the moment the package's own `src/model/io.ts` came along for the ride
// (STUFE2-B2-EINBINDUNG.md §5.1). The declarations are now identical in
// substance; when one changes, change both.
//
// Note: the ESM build (dist/index.js, the only file referenced by the
// package's exports map) has NO default export — it exports the factory
// function `BpmnModdle` (alias of SimpleBpmnModdle) as a named export.

declare module "bpmn-moddle" {
  export interface ModdleElement {
    $type: string;
    id?: string;
    /** Attributes moddle did not recognise, kept verbatim. */
    $attrs?: Record<string, unknown>;
    /** Children moddle did not recognise, kept verbatim. */
    $children?: ModdleElement[];
    $parent?: ModdleElement;
    // moddle elements carry arbitrary schema-defined properties
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
    /** Instantiate a typed element, e.g. `create("arctos:GrcMetadata", {...})`. */
    create(type: string, properties?: Record<string, unknown>): ModdleElement;
    getType(type: string): unknown;
  }

  /** Factory — pre-registers the BPMN packages plus the given extensions. */
  export function BpmnModdle(
    additionalPackages?: Record<string, unknown>,
    options?: Record<string, unknown>,
  ): BpmnModdleInstance;
}
