/**
 * The moddle registry for the ARCTOS BPMN engine.
 *
 * The extension descriptor in `arctos-moddle-extension.json` is a **byte copy**
 * of `apps/web/src/components/bpmn/arctos-moddle-extension.json`, the file that
 * is handed to `bpmn-js` today as `moddleExtensions.arctos`. It is copied rather
 * than imported because this package must not depend on `apps/web` (§2.5 of the
 * plan). `test/model/extension-parity.test.ts` asserts the two files are still
 * byte-identical, so the copy cannot silently drift.
 *
 * Three properties of that descriptor carry existing production data and must
 * not change (Bestandsaufnahme §1.6, plan §5.2):
 *
 *   - `uri`    `https://arctos.grc/schema/bpmn/1.0`
 *   - `prefix` `arctos`
 *   - `xml.tagAlias: "lowerCase"` — the type `GrcMetadata` is written as
 *     `<arctos:grcMetadata>`, and `localType()` on the read side compares
 *     case-insensitively against `"grcmetadata"`. A registry that omits
 *     `tagAlias` produces XML that older readers cannot find, *silently*.
 */

import { BpmnModdle, type BpmnModdleInstance } from "bpmn-moddle";
import arctosModdleExtension from "./arctos-moddle-extension.json";

/** Namespace URI of the ARCTOS extension. Frozen — existing XML depends on it. */
export const ARCTOS_NAMESPACE = "https://arctos.grc/schema/bpmn/1.0";
/** Canonical prefix of the ARCTOS extension. */
export const ARCTOS_PREFIX = "arctos";
/** Local name of the metadata root, lower-cased as `tagAlias` produces it. */
export const ARCTOS_METADATA_LOCAL_TYPE = "grcmetadata";

export const BPMN_NAMESPACE = "http://www.omg.org/spec/BPMN/20100524/MODEL";
export const BPMNDI_NAMESPACE = "http://www.omg.org/spec/BPMN/20100524/DI";
export const DC_NAMESPACE = "http://www.omg.org/spec/DD/20100524/DC";
export const DI_NAMESPACE = "http://www.omg.org/spec/DD/20100524/DI";

/** The extension descriptor exactly as `apps/web` registers it. */
export const arctosExtensionDescriptor: unknown = arctosModdleExtension;

/**
 * Create a moddle registry with the ARCTOS extension registered.
 *
 * A registry is immutable after construction, so one shared instance is enough
 * for reading and writing; {@link arctosModdle} is that instance. Additional
 * extension packages can be passed for tests that need a foreign vocabulary
 * registered as a first-class type rather than kept as `$children`.
 */
export function createArctosModdle(
  additionalPackages: Record<string, unknown> = {},
): BpmnModdleInstance {
  return BpmnModdle({ arctos: arctosModdleExtension, ...additionalPackages });
}

/** Shared registry. Read and write paths must use the same one. */
export const arctosModdle: BpmnModdleInstance = createArctosModdle();
