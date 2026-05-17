// BPM Overhaul Phase 5: GRC attribute extractor + injector for BPMN XML.
//
// Reads/writes `arctos:*` extension elements on BPMN activity nodes. Works
// without modifying bpmn-js core — we use simple regex on the raw XML, which
// is sufficient for the round-trip preservation use case. When the bpmn-js
// moddle extension is loaded the in-memory model also surfaces these as
// proper objects on the element.

export interface GrcRiskRef {
  id: string;
  title?: string;
  inherentScore?: number;
  residualScore?: number;
  status?: string;
}

export interface GrcControlRef {
  id: string;
  title?: string;
  effectiveness?: string;
  controlType?: string;
}

export interface GrcDocumentRef {
  id: string;
  title?: string;
  documentType?: string;
}

export interface GrcMetadata {
  lineOfDefense?: string;
  complianceProfile?: string;
  isCriticalProcess?: boolean;
  riskRefs?: GrcRiskRef[];
  controlRefs?: GrcControlRef[];
  documentRefs?: GrcDocumentRef[];
  raci?: {
    responsibleRoleId?: string;
    accountableRoleId?: string;
    consultedRoleIds?: string;
    informedRoleIds?: string;
  };
  bcmKpi?: {
    mtpdMinutes?: number;
    rtoMinutes?: number;
    rpoMinutes?: number;
    criticality?: string;
  };
  ropa?: {
    isProcessingActivity?: boolean;
    purpose?: string;
    legalBasis?: string;
    requiresDpia?: boolean;
  };
}

const NS = "https://arctos.grc/schema/bpmn/1.0";

/**
 * Ensure the BPMN root declares xmlns:arctos. Idempotent.
 */
export function ensureArctosNamespace(xml: string): string {
  if (xml.includes("xmlns:arctos=")) return xml;
  return xml.replace(
    /<(bpmn:)?definitions\b([^>]*)>/,
    (_m, prefix, attrs) => `<${prefix ?? ""}definitions${attrs} xmlns:arctos="${NS}">`,
  );
}

function escapeAttr(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderRefs<T extends Record<string, any>>(tag: string, items: T[]): string {
  return items
    .map((it) => {
      const attrs = Object.entries(it)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => `${k}="${escapeAttr(String(v))}"`)
        .join(" ");
      return `      <arctos:${tag} ${attrs}/>`;
    })
    .join("\n");
}

function renderMetadata(meta: GrcMetadata): string {
  const segments: string[] = ['    <arctos:grcMetadata'];
  if (meta.lineOfDefense) segments[0] += ` lineOfDefense="${escapeAttr(meta.lineOfDefense)}"`;
  if (meta.complianceProfile)
    segments[0] += ` complianceProfile="${escapeAttr(meta.complianceProfile)}"`;
  if (meta.isCriticalProcess) segments[0] += ` isCriticalProcess="true"`;
  segments[0] += ">";

  if (meta.riskRefs?.length) {
    segments.push("      <arctos:riskRefs>");
    segments.push(renderRefs("riskRef", meta.riskRefs));
    segments.push("      </arctos:riskRefs>");
  }
  if (meta.controlRefs?.length) {
    segments.push("      <arctos:controlRefs>");
    segments.push(renderRefs("controlRef", meta.controlRefs));
    segments.push("      </arctos:controlRefs>");
  }
  if (meta.documentRefs?.length) {
    segments.push("      <arctos:documentRefs>");
    segments.push(renderRefs("documentRef", meta.documentRefs));
    segments.push("      </arctos:documentRefs>");
  }
  if (meta.raci && Object.keys(meta.raci).length) {
    const attrs = Object.entries(meta.raci)
      .filter(([, v]) => v != null && v !== "")
      .map(([k, v]) => `${k}="${escapeAttr(String(v))}"`)
      .join(" ");
    segments.push(`      <arctos:raci ${attrs}/>`);
  }
  if (meta.bcmKpi && Object.keys(meta.bcmKpi).length) {
    const attrs = Object.entries(meta.bcmKpi)
      .filter(([, v]) => v != null && v !== "")
      .map(([k, v]) => `${k}="${escapeAttr(String(v))}"`)
      .join(" ");
    segments.push(`      <arctos:bcmKpi ${attrs}/>`);
  }
  if (meta.ropa && Object.keys(meta.ropa).length) {
    const attrs = Object.entries(meta.ropa)
      .filter(([, v]) => v != null && v !== "")
      .map(([k, v]) => `${k}="${escapeAttr(String(v))}"`)
      .join(" ");
    segments.push(`      <arctos:ropa ${attrs}/>`);
  }
  segments.push("    </arctos:grcMetadata>");
  return segments.join("\n");
}

/**
 * Inject GRC metadata into a BPMN activity element.
 * Replaces any existing extensionElements/arctos:grcMetadata for that node.
 */
export function injectGrcMetadata(
  xml: string,
  bpmnElementId: string,
  meta: GrcMetadata,
): string {
  let out = ensureArctosNamespace(xml);

  // Find the element opening tag (userTask, serviceTask, task, gateway, event, etc.)
  const elemRegex = new RegExp(
    `<(bpmn:)?[A-Za-z]+\\b[^>]*\\bid="${escapeRegex(bpmnElementId)}"[^>]*?>`,
    "i",
  );
  const m = out.match(elemRegex);
  if (!m) return out; // element not found
  const openTag = m[0];
  const openIdx = m.index!;
  // Find matching close tag (naive — assumes simple structure inside)
  const tagName = openTag.match(/^<((?:bpmn:)?[A-Za-z]+)/)?.[1] ?? "";
  if (!tagName) return out;

  // Self-closing? Convert to open/close.
  if (openTag.endsWith("/>")) {
    const replacement = openTag.replace(/\/>$/, ">") + `</${tagName}>`;
    out = out.slice(0, openIdx) + replacement + out.slice(openIdx + openTag.length);
  }

  // Find close tag index
  const closeIdx = out.indexOf(`</${tagName}>`, openIdx);
  if (closeIdx === -1) return out;
  const innerStart = out.indexOf(">", openIdx) + 1;
  const inner = out.slice(innerStart, closeIdx);

  const metaXml = renderMetadata(meta);
  // Remove any existing arctos:grcMetadata
  const innerCleaned = inner.replace(
    /<(bpmn:)?extensionElements>[\s\S]*?<\/(bpmn:)?extensionElements>/g,
    (m) => {
      // Drop existing arctos:grcMetadata inside
      return m.replace(/<arctos:grcMetadata[\s\S]*?<\/arctos:grcMetadata>/g, "");
    },
  );

  // Determine if we have an extensionElements block to nest into
  let newInner: string;
  if (/<(bpmn:)?extensionElements>/.test(innerCleaned)) {
    newInner = innerCleaned.replace(
      /<(bpmn:)?extensionElements>/,
      (m) => `${m}\n${metaXml}`,
    );
  } else {
    newInner = `\n  <bpmn:extensionElements>\n${metaXml}\n  </bpmn:extensionElements>${innerCleaned}`;
  }

  return out.slice(0, innerStart) + newInner + out.slice(closeIdx);
}

/**
 * Extract GRC metadata from a BPMN XML for the given element id.
 */
export function extractGrcMetadata(xml: string, bpmnElementId: string): GrcMetadata | null {
  const block = extractElementInner(xml, bpmnElementId);
  if (!block) return null;
  const meta: GrcMetadata = {};
  const root = block.match(
    /<arctos:grcMetadata([^>]*)>([\s\S]*?)<\/arctos:grcMetadata>/,
  );
  if (!root) return null;
  const attrs = parseAttrs(root[1]);
  meta.lineOfDefense = attrs.lineOfDefense;
  meta.complianceProfile = attrs.complianceProfile;
  meta.isCriticalProcess = attrs.isCriticalProcess === "true";

  meta.riskRefs = parseRefs<GrcRiskRef>(root[2], "riskRef", ["id", "title", "inherentScore", "residualScore", "status"]);
  meta.controlRefs = parseRefs<GrcControlRef>(root[2], "controlRef", [
    "id",
    "title",
    "effectiveness",
    "controlType",
  ]);
  meta.documentRefs = parseRefs<GrcDocumentRef>(root[2], "documentRef", [
    "id",
    "title",
    "documentType",
  ]);
  const raciMatch = root[2].match(/<arctos:raci\b([^/]*)\/>/);
  if (raciMatch) meta.raci = parseAttrs(raciMatch[1]) as any;
  const bcmMatch = root[2].match(/<arctos:bcmKpi\b([^/]*)\/>/);
  if (bcmMatch) {
    const a = parseAttrs(bcmMatch[1]);
    meta.bcmKpi = {
      mtpdMinutes: a.mtpdMinutes ? parseInt(a.mtpdMinutes, 10) : undefined,
      rtoMinutes: a.rtoMinutes ? parseInt(a.rtoMinutes, 10) : undefined,
      rpoMinutes: a.rpoMinutes ? parseInt(a.rpoMinutes, 10) : undefined,
      criticality: a.criticality,
    };
  }
  const ropaMatch = root[2].match(/<arctos:ropa\b([^/]*)\/>/);
  if (ropaMatch) {
    const a = parseAttrs(ropaMatch[1]);
    meta.ropa = {
      isProcessingActivity: a.isProcessingActivity === "true",
      purpose: a.purpose,
      legalBasis: a.legalBasis,
      requiresDpia: a.requiresDpia === "true",
    };
  }
  return meta;
}

function extractElementInner(xml: string, bpmnElementId: string): string | null {
  const elemRegex = new RegExp(
    `<(bpmn:)?([A-Za-z]+)\\b[^>]*\\bid="${escapeRegex(bpmnElementId)}"[^>]*?>`,
    "i",
  );
  const m = xml.match(elemRegex);
  if (!m) return null;
  const tagName = `${m[1] ?? ""}${m[2]}`;
  const start = m.index! + m[0].length;
  const close = xml.indexOf(`</${tagName}>`, start);
  if (close === -1) return null;
  return xml.slice(start, close);
}

function parseAttrs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  s.replace(/(\w+)="([^"]*)"/g, (_match, k, v) => {
    out[k] = unescapeAttr(v);
    return "";
  });
  return out;
}

function parseRefs<T extends Record<string, any>>(
  inner: string,
  tag: string,
  fields: string[],
): T[] {
  const re = new RegExp(`<arctos:${tag}\\b([^/]*)\\/>`, "g");
  const out: T[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(inner)) !== null) {
    const a = parseAttrs(m[1]);
    const obj: any = {};
    for (const f of fields) {
      if (a[f] !== undefined) {
        const n = Number(a[f]);
        obj[f] = !isNaN(n) && /Score|Minutes/i.test(f) ? n : a[f];
      }
    }
    out.push(obj as T);
  }
  return out;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function unescapeAttr(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
