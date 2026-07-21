// B1.3: server-side arctos:* metadata WRITE path via the moddle object model.
//
// Replaces the regex/string-concatenation writer `injectGrcMetadata` in
// arctos-grc-extractor.ts. The XML is loaded with bpmn-moddle (arctos
// extension registered — same registry as the parse side and the bpmn-js
// Modeler/Viewer), the arctos:grcMetadata extension element is set/replaced
// per element on the object model, and the document is re-serialized with
// toXML. Round-trip safe:
//   - foreign extensionElements entries (camunda, zeebe, ...) are preserved
//   - an existing arctos:grcMetadata is replaced, never duplicated
//   - the xmlns:arctos declaration is emitted by the moddle writer itself

import type { ModdleElement } from "bpmn-moddle";
import type {
  GrcMetadata,
  GrcRiskRef,
  GrcControlRef,
  GrcDocumentRef,
} from "@/components/bpmn/arctos-grc-extractor";
import {
  arctosModdle,
  isModdleElement,
  localType,
  walkContainment,
} from "@/lib/bpmn-arctos-parse";

/** Drop undefined / null / empty-string entries (parity with the old writer). */
function pruned(record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record)) {
    if (v === undefined || v === null || v === "") continue;
    out[k] = v;
  }
  return out;
}

function createRefContainer(
  containerType: string,
  itemType: string,
  items: ReadonlyArray<GrcRiskRef | GrcControlRef | GrcDocumentRef>,
): ModdleElement | null {
  const values = items
    .filter((it) => it.id)
    .map((it) => arctosModdle.create(itemType, pruned({ ...it })));
  if (values.length === 0) return null;
  const container = arctosModdle.create(containerType, { values });
  for (const v of values) v.$parent = container;
  return container;
}

/**
 * Build the arctos:GrcMetadata moddle element for one node. Returns null
 * when the metadata carries no content at all — in that case any existing
 * arctos:grcMetadata is removed but no empty element is written.
 */
function createGrcMetadataElement(meta: GrcMetadata): ModdleElement | null {
  const attrs: Record<string, unknown> = {};
  if (meta.lineOfDefense) attrs.lineOfDefense = meta.lineOfDefense;
  if (meta.complianceProfile) attrs.complianceProfile = meta.complianceProfile;
  if (meta.calledProcessId) attrs.calledProcessId = meta.calledProcessId;
  if (meta.isCriticalProcess) attrs.isCriticalProcess = true;

  const el = arctosModdle.create("arctos:GrcMetadata", attrs);
  let hasContent = Object.keys(attrs).length > 0;

  const attach = (key: string, child: ModdleElement | null) => {
    if (!child) return;
    child.$parent = el;
    el[key] = child;
    hasContent = true;
  };

  attach(
    "riskRefs",
    createRefContainer(
      "arctos:RiskRefs",
      "arctos:RiskRef",
      meta.riskRefs ?? [],
    ),
  );
  attach(
    "controlRefs",
    createRefContainer(
      "arctos:ControlRefs",
      "arctos:ControlRef",
      meta.controlRefs ?? [],
    ),
  );
  attach(
    "documentRefs",
    createRefContainer(
      "arctos:DocumentRefs",
      "arctos:DocumentRef",
      meta.documentRefs ?? [],
    ),
  );

  const raci = pruned(meta.raci ?? {});
  if (Object.keys(raci).length > 0) {
    attach("raci", arctosModdle.create("arctos:Raci", raci));
  }
  const bcmKpi = pruned(meta.bcmKpi ?? {});
  if (Object.keys(bcmKpi).length > 0) {
    attach("bcmKpi", arctosModdle.create("arctos:BcmKpi", bcmKpi));
  }
  const ropa = pruned(meta.ropa ?? {});
  if (Object.keys(ropa).length > 0) {
    attach("ropa", arctosModdle.create("arctos:Ropa", ropa));
  }

  return hasContent ? el : null;
}

/**
 * Set/replace the `arctos:grcMetadata` extension element on every element
 * listed in `metadataMap` (keyed by BPMN element id) and return the
 * re-serialized XML.
 *
 * - Unknown element ids are skipped.
 * - Existing arctos:grcMetadata entries are replaced, never duplicated.
 * - All other extensionElements entries are preserved untouched.
 * - Empty metadata removes an existing arctos:grcMetadata without writing
 *   an empty replacement.
 * - Unparseable XML is returned unchanged (lenient parity with the legacy
 *   regex writer — metadata injection is best-effort).
 */
export async function injectGrcMetadataModdle(
  xml: string,
  metadataMap: ReadonlyMap<string, GrcMetadata>,
): Promise<string> {
  if (!xml || !xml.trim() || metadataMap.size === 0) return xml;

  let rootElement: ModdleElement;
  try {
    ({ rootElement } = await arctosModdle.fromXML(xml));
  } catch {
    return xml;
  }

  const byId = new Map<string, ModdleElement>();
  walkContainment(rootElement, (el) => {
    if (typeof el.id === "string" && el.id) byId.set(el.id, el);
  });

  let changed = false;
  for (const [elementId, meta] of metadataMap) {
    const el = byId.get(elementId);
    if (!el) continue;

    const replacement = createGrcMetadataElement(meta);

    const existingExt = el.extensionElements;
    const ext = isModdleElement(existingExt) ? existingExt : null;
    const existingValues =
      ext && Array.isArray(ext.values)
        ? (ext.values as unknown[]).filter(isModdleElement)
        : [];
    const kept = existingValues.filter((v) => localType(v) !== "grcmetadata");
    const removedExisting = kept.length !== existingValues.length;

    if (!replacement && !removedExisting) continue;

    const nextValues: ModdleElement[] = [...kept];
    if (replacement) nextValues.push(replacement);

    if (ext) {
      if (nextValues.length === 0) {
        el.extensionElements = undefined;
      } else {
        ext.values = nextValues;
        if (replacement) replacement.$parent = ext;
      }
    } else if (replacement) {
      const newExt = arctosModdle.create("bpmn:ExtensionElements", {
        values: [replacement],
      });
      newExt.$parent = el;
      replacement.$parent = newExt;
      el.extensionElements = newExt;
    }
    changed = true;
  }

  if (!changed) return xml;

  const { xml: out } = await arctosModdle.toXML(rootElement, { format: true });
  return out;
}
