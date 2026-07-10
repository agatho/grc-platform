// B1.2: server-side arctos:* metadata extraction via real XML parsing.
//
// Replaces the fragile regex parsing in arctos-grc-extractor.ts for all
// server-side read paths (version rehydrate, detailed version compare).
// Uses bpmn-moddle with the same arctos extension schema that the
// bpmn-js Modeler/Viewer register client-side, so both sides interpret
// the extension elements identically.

import { BpmnModdle, type ModdleElement } from "bpmn-moddle";
import arctosModdleExtension from "@/components/bpmn/arctos-moddle-extension.json";
import type {
  GrcMetadata,
  GrcRiskRef,
  GrcControlRef,
  GrcDocumentRef,
} from "@/components/bpmn/arctos-grc-extractor";

// One shared instance — the moddle registry is immutable after creation.
// (BpmnModdle is a factory function, not a class — see bpmn-moddle.d.ts.)
// Exported so the write-side counterpart (bpmn-arctos-write.ts) creates
// elements against the identical type registry.
export const arctosModdle = BpmnModdle({ arctos: arctosModdleExtension });
const moddle = arctosModdle;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function isModdleElement(v: unknown): v is ModdleElement {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as { $type?: unknown }).$type === "string"
  );
}

function asString(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  return String(v);
}

function asNumber(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}

function asBoolean(v: unknown): boolean {
  return v === true || v === "true";
}

/**
 * Collect the item elements of a ref container. Handles both the typed
 * moddle shape (`container.values`) and legacy "any"-element shape
 * (`container.$children`), plus flat arrays for forward compatibility.
 */
function containerItems(container: unknown): ModdleElement[] {
  if (Array.isArray(container)) return container.filter(isModdleElement);
  if (!isModdleElement(container)) return [];
  const values = (container as { values?: unknown }).values;
  if (Array.isArray(values)) return values.filter(isModdleElement);
  const children = (container as { $children?: unknown }).$children;
  if (Array.isArray(children)) return children.filter(isModdleElement);
  return [];
}

export function localType(el: ModdleElement): string {
  const idx = el.$type.indexOf(":");
  return (idx === -1 ? el.$type : el.$type.slice(idx + 1)).toLowerCase();
}

function mapRiskRef(el: ModdleElement): GrcRiskRef {
  return {
    id: asString(el.id) ?? "",
    title: asString(el.title),
    inherentScore: asNumber(el.inherentScore),
    residualScore: asNumber(el.residualScore),
    status: asString(el.status),
  };
}

function mapControlRef(el: ModdleElement): GrcControlRef {
  return {
    id: asString(el.id) ?? "",
    title: asString(el.title),
    effectiveness: asString(el.effectiveness),
    controlType: asString(el.controlType),
  };
}

function mapDocumentRef(el: ModdleElement): GrcDocumentRef {
  return {
    id: asString(el.id) ?? "",
    title: asString(el.title),
    documentType: asString(el.documentType),
  };
}

function mapGrcMetadata(el: ModdleElement): GrcMetadata {
  const meta: GrcMetadata = {};

  const lod = asString(el.lineOfDefense);
  if (lod) meta.lineOfDefense = lod;
  const profile = asString(el.complianceProfile);
  if (profile) meta.complianceProfile = profile;
  meta.isCriticalProcess = asBoolean(el.isCriticalProcess);

  const riskRefs = containerItems(el.riskRefs).map(mapRiskRef);
  if (riskRefs.length) meta.riskRefs = riskRefs;
  const controlRefs = containerItems(el.controlRefs).map(mapControlRef);
  if (controlRefs.length) meta.controlRefs = controlRefs;
  const documentRefs = containerItems(el.documentRefs).map(mapDocumentRef);
  if (documentRefs.length) meta.documentRefs = documentRefs;

  const raci = el.raci;
  if (isModdleElement(raci)) {
    meta.raci = {
      responsibleRoleId: asString(raci.responsibleRoleId),
      accountableRoleId: asString(raci.accountableRoleId),
      consultedRoleIds: asString(raci.consultedRoleIds),
      informedRoleIds: asString(raci.informedRoleIds),
    };
  }

  const bcmKpi = el.bcmKpi;
  if (isModdleElement(bcmKpi)) {
    meta.bcmKpi = {
      mtpdMinutes: asNumber(bcmKpi.mtpdMinutes),
      rtoMinutes: asNumber(bcmKpi.rtoMinutes),
      rpoMinutes: asNumber(bcmKpi.rpoMinutes),
      criticality: asString(bcmKpi.criticality),
    };
  }

  const ropa = el.ropa;
  if (isModdleElement(ropa)) {
    meta.ropa = {
      isProcessingActivity: asBoolean(ropa.isProcessingActivity),
      purpose: asString(ropa.purpose),
      legalBasis: asString(ropa.legalBasis),
      requiresDpia: asBoolean(ropa.requiresDpia),
    };
  }

  return meta;
}

/**
 * Depth-first walk of the moddle containment tree. Only follows values
 * whose $parent is the current element (containment), never references
 * (sourceRef/targetRef/...), so the walk terminates.
 */
export function walkContainment(
  el: ModdleElement,
  visit: (el: ModdleElement) => void,
): void {
  visit(el);
  for (const [key, value] of Object.entries(el)) {
    if (key.startsWith("$")) continue;
    const children = Array.isArray(value) ? value : [value];
    for (const child of children) {
      if (
        isModdleElement(child) &&
        (child as { $parent?: unknown }).$parent === el
      ) {
        walkContainment(child, visit);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a BPMN XML document and return a map of
 * `bpmnElementId → GrcMetadata` for every element that carries an
 * `arctos:grcMetadata` extension element.
 *
 * Invalid/empty XML yields an empty map (parity with the lenient
 * regex-based predecessor — callers treat metadata as best-effort).
 */
export async function parseArctosGrcMetadataMap(
  xml: string | null | undefined,
): Promise<Map<string, GrcMetadata>> {
  const out = new Map<string, GrcMetadata>();
  if (!xml || !xml.trim()) return out;

  let rootElement: ModdleElement;
  try {
    ({ rootElement } = await moddle.fromXML(xml));
  } catch {
    return out;
  }

  walkContainment(rootElement, (el) => {
    const extensionElements = el.extensionElements;
    if (!isModdleElement(extensionElements)) return;
    const values = (extensionElements as { values?: unknown }).values;
    if (!Array.isArray(values)) return;
    const metaEl = values.find(
      (v): v is ModdleElement =>
        isModdleElement(v) && localType(v) === "grcmetadata",
    );
    if (!metaEl) return;
    const elementId = asString(el.id);
    if (!elementId) return;
    out.set(elementId, mapGrcMetadata(metaEl));
  });

  return out;
}

/**
 * Extract the GRC metadata of a single element (moddle-based counterpart
 * of the legacy `extractGrcMetadata`).
 */
export async function extractGrcMetadataFromXml(
  xml: string,
  bpmnElementId: string,
): Promise<GrcMetadata | null> {
  const map = await parseArctosGrcMetadataMap(xml);
  return map.get(bpmnElementId) ?? null;
}
