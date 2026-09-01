/**
 * Canonicalisation and structural accounting for BPMN XML.
 *
 * This implements the comparison basis of the four round-trip assurances in
 * §5.1 of `ARCTOS_BPMN_ENGINE_PLAN.md`:
 *
 *   Z-A  canonical equivalence  → {@link canonicalize} + {@link diffCanonical}
 *   Z-B  idempotence            → byte comparison, no help needed from here
 *   Z-C  non-loss               → {@link countNodes} + {@link diffCounts}
 *   Z-D  read-preserve-write    → byte comparison, no help needed from here
 *
 * The canonical form deliberately erases exactly four things and nothing else:
 *
 *   1. namespace *prefixes* — every name is rewritten to `{uri}local`, so
 *      `bpmn:task`, `b:task` and a default-namespaced `task` collapse;
 *   2. attribute *order* — attributes are sorted by canonical name;
 *   3. insignificant whitespace — whitespace-only text nodes are dropped,
 *      remaining text is trimmed (internal whitespace is preserved, because
 *      inside `<bpmn:documentation>` it is content);
 *   4. numeric spelling — attribute values that are numbers are rounded to
 *      six decimals and re-printed, so `152`, `152.0` and `152.0000001` agree.
 *
 * Everything else survives, including comments, processing instructions,
 * CDATA content (though not the fact that it *was* CDATA — see
 * {@link CanonicalizeOptions.keepCdataDistinction}), and every attribute of
 * every foreign namespace.
 */

import {
  parseXml,
  walkElements,
  type XmlDocument,
  type XmlElement,
  type XmlNode,
} from "./xml-parse.js";

export const XMLNS_URI = "http://www.w3.org/2000/xmlns/";
export const XSI_URI = "http://www.w3.org/2001/XMLSchema-instance";

export interface CanonicalizeOptions {
  /** Decimal places numeric attribute values are rounded to. Default 6. */
  readonly numericPrecision?: number;
  /** Keep comments in the canonical form. Default `true`. */
  readonly keepComments?: boolean;
  /**
   * Emit `cdata` rather than `text` for CDATA sections. Default `false`:
   * `<a><![CDATA[x]]></a>` and `<a>x</a>` are the same document to an XML
   * consumer, and no BPMN tool preserves the distinction.
   */
  readonly keepCdataDistinction?: boolean;
  /**
   * Sort sibling nodes, making the form independent of document order.
   * Default `true`, because Z-A in the plan is stated over an element *set*
   * plus per-element attributes, not over a sequence: BPMN gives sibling order
   * no meaning inside `<bpmn:process>`, and `moddle-xml` writes children back
   * in schema order rather than source order.
   *
   * Two exceptions keep their document order even when sorting is on, because
   * there the sequence *is* the content:
   *   - the children of a `BPMNEdge` (the waypoint polyline);
   *   - any element with genuine mixed content (text next to elements).
   *
   * Pass `false` to measure whether source order survived — that is reported
   * separately rather than folded into Z-A.
   */
  readonly sortSiblings?: boolean;
}

interface NsScope {
  readonly map: ReadonlyMap<string, string>;
  readonly defaultUri: string;
}

const EMPTY_SCOPE: NsScope = { map: new Map(), defaultUri: "" };

function pushScope(scope: NsScope, element: XmlElement): NsScope {
  let map: Map<string, string> | undefined;
  let defaultUri = scope.defaultUri;
  for (const attr of element.attributes) {
    if (attr.qname === "xmlns") {
      defaultUri = attr.value;
    } else if (attr.prefix === "xmlns") {
      map ??= new Map(scope.map);
      map.set(attr.local, attr.value);
    }
  }
  if (!map && defaultUri === scope.defaultUri) return scope;
  return { map: map ?? scope.map, defaultUri };
}

function resolveElementName(scope: NsScope, element: XmlElement): string {
  const uri = element.prefix
    ? (scope.map.get(element.prefix) ?? "")
    : scope.defaultUri;
  return uri ? `{${uri}}${element.local}` : element.local;
}

function resolveAttrName(
  scope: NsScope,
  prefix: string,
  local: string,
): string {
  // Unprefixed attributes are never in the default namespace (XML Namespaces §6.2).
  if (!prefix) return local;
  const uri = scope.map.get(prefix) ?? "";
  return uri ? `{${uri}}${local}` : `${prefix}:${local}`;
}

const NUMERIC = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

function normalizeValue(value: string, precision: number): string {
  if (!NUMERIC.test(value)) return value;
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  const rounded = Number(n.toFixed(precision));
  // `toFixed` then `Number` drops trailing zeros; `-0` collapses to `0`.
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

/**
 * Merge adjacent text/CDATA runs and drop whitespace-only ones. A run is
 * merged *before* trimming so that `foo<![CDATA[ bar]]>` and `foo bar` agree.
 */
function normalizeChildren(
  children: readonly XmlNode[],
  keepCdata: boolean,
): XmlNode[] {
  const out: XmlNode[] = [];
  let buffer = "";
  let bufferHadCdata = false;
  const flush = (): void => {
    if (buffer.length === 0) return;
    const trimmed = buffer.trim();
    if (trimmed.length > 0) {
      out.push({
        kind: "text",
        value: trimmed,
        cdata: keepCdata && bufferHadCdata,
      });
    }
    buffer = "";
    bufferHadCdata = false;
  };
  for (const child of children) {
    if (child.kind === "text") {
      buffer += child.value;
      bufferHadCdata ||= child.cdata;
      continue;
    }
    flush();
    out.push(child);
  }
  flush();
  return out;
}

/** Local name of an element after prefix resolution, e.g. `{uri}BPMNEdge` → `BPMNEdge`. */
function localOf(canonicalName: string): string {
  const brace = canonicalName.lastIndexOf("}");
  return brace === -1 ? canonicalName : canonicalName.slice(brace + 1);
}

/** Render one node into an indented block of lines. */
function render(
  node: XmlNode,
  scope: NsScope,
  depth: number,
  opts: Required<CanonicalizeOptions>,
): string[] {
  const pad = "  ".repeat(depth);
  switch (node.kind) {
    case "comment":
      return opts.keepComments ? [`${pad}<!--${node.value.trim()}-->`] : [];
    case "pi":
      // The XML declaration is not a PI in the data model and carries no
      // document content; every serialiser writes its own.
      return node.target.toLowerCase() === "xml"
        ? []
        : [`${pad}<?${node.target} ${node.value.trim()}?>`];
    case "doctype":
      return [`${pad}<!${node.value.trim()}>`];
    case "text":
      return [
        `${pad}${node.cdata ? "cdata" : "text"} ${JSON.stringify(node.value)}`,
      ];
    case "element":
      break;
  }

  const childScope = pushScope(scope, node);
  const name = resolveElementName(childScope, node);
  const lines: string[] = [`${pad}<${name}>`];

  const attrs: string[] = [];
  for (const attr of node.attributes) {
    if (attr.qname === "xmlns" || attr.prefix === "xmlns") continue;
    const attrName = resolveAttrName(childScope, attr.prefix, attr.local);
    let value = normalizeValue(attr.value, opts.numericPrecision);
    // `xsi:type` holds a QName; canonicalise its prefix too, or two documents
    // that differ only in prefix spelling would compare unequal.
    if (attrName === `{${XSI_URI}}type`) {
      const colon = value.indexOf(":");
      if (colon > 0) {
        const uri = childScope.map.get(value.slice(0, colon));
        if (uri) value = `{${uri}}${value.slice(colon + 1)}`;
      } else if (childScope.defaultUri) {
        value = `{${childScope.defaultUri}}${value}`;
      }
    }
    attrs.push(`${pad}  @${attrName}=${JSON.stringify(value)}`);
  }
  attrs.sort();
  lines.push(...attrs);

  const kids = normalizeChildren(node.children, opts.keepCdataDistinction);
  const hasText = kids.some((k) => k.kind === "text");
  const hasElements = kids.some((k) => k.kind === "element");
  const orderIsContent =
    localOf(name) === "BPMNEdge" || (hasText && hasElements);
  const blocks = kids.map((child) =>
    render(child, childScope, depth + 1, opts),
  );
  if (opts.sortSiblings && !orderIsContent) {
    blocks.sort((a, b) => {
      const ja = a.join("\n");
      const jb = b.join("\n");
      return ja < jb ? -1 : ja > jb ? 1 : 0;
    });
  }
  for (const block of blocks) lines.push(...block);

  lines.push(`${pad}</${name}>`);
  return lines;
}

/**
 * Produce the canonical form of an XML document as a newline-separated,
 * line-oriented text. Two documents are canonically equivalent iff their
 * canonical forms are string-equal; {@link diffCanonical} explains where they
 * are not.
 */
export function canonicalize(
  xml: string,
  options: CanonicalizeOptions = {},
): string {
  const opts: Required<CanonicalizeOptions> = {
    numericPrecision: options.numericPrecision ?? 6,
    keepComments: options.keepComments ?? true,
    keepCdataDistinction: options.keepCdataDistinction ?? false,
    sortSiblings: options.sortSiblings ?? true,
  };
  const doc: XmlDocument = parseXml(xml);
  const lines: string[] = [];
  for (const node of doc.prolog)
    lines.push(...render(node, EMPTY_SCOPE, 0, opts));
  lines.push(...render(doc.root, EMPTY_SCOPE, 0, opts));
  for (const node of doc.epilog)
    lines.push(...render(node, EMPTY_SCOPE, 0, opts));
  return lines.join("\n");
}

export interface CanonicalDifference {
  /** 1-based line number in the *source* canonical form (or where it would be). */
  readonly line: number;
  /** `"removed"` — only in the source; `"added"` — only in the round-trip. */
  readonly kind: "removed" | "added";
  readonly text: string;
  /** Innermost element the differing line sits in, as `{uri}local`. */
  readonly context: string;
}

/**
 * Longest common subsequence of two line arrays, as a list of matched index
 * pairs. Bounded: for inputs whose product exceeds `maxCells` the alignment
 * falls back to positional comparison, which over-reports but never lies about
 * *whether* the documents differ.
 */
function lcsPairs(
  a: readonly string[],
  b: readonly string[],
  maxCells: number,
): [number, number][] {
  const n = a.length;
  const m = b.length;
  if (n * m > maxCells) {
    const pairs: [number, number][] = [];
    for (let i = 0; i < Math.min(n, m); i += 1)
      if (a[i] === b[i]) pairs.push([i, i]);
    return pairs;
  }
  // dp[i][j] = LCS length of a[i…] and b[j…]
  const width = m + 1;
  const dp = new Int32Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i * width + j] =
        a[i] === b[j]
          ? (dp[(i + 1) * width + (j + 1)] ?? 0) + 1
          : Math.max(
              dp[(i + 1) * width + j] ?? 0,
              dp[i * width + (j + 1)] ?? 0,
            );
    }
  }
  const pairs: [number, number][] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      pairs.push([i, j]);
      i += 1;
      j += 1;
    } else if (
      (dp[(i + 1) * width + j] ?? 0) >= (dp[i * width + (j + 1)] ?? 0)
    ) {
      i += 1;
    } else {
      j += 1;
    }
  }
  return pairs;
}

/**
 * Difference between two canonical forms, aligned so that a single dropped
 * attribute reports as one removed line rather than desynchronising everything
 * that follows.
 *
 * Reports every difference up to `limit`, not just the first — a harness that
 * stops at the first difference makes a broken serialiser look like a single
 * small problem.
 */
export function diffCanonical(
  beforeCanonical: string,
  afterCanonical: string,
  limit = 60,
): CanonicalDifference[] {
  const a = beforeCanonical.split("\n");
  const b = afterCanonical.split("\n");

  // Track the enclosing element for every source line, so a difference can say
  // where it sits without the reader counting braces.
  const contexts: string[] = [];
  const stack: string[] = [];
  for (const line of a) {
    const trimmed = line.trim();
    if (trimmed.startsWith("</")) {
      contexts.push(stack[stack.length - 1] ?? "(root)");
      stack.pop();
      continue;
    }
    if (
      trimmed.startsWith("<") &&
      !trimmed.startsWith("<!") &&
      !trimmed.startsWith("<?")
    ) {
      stack.push(trimmed.slice(1, -1));
    }
    contexts.push(stack[stack.length - 1] ?? "(root)");
  }

  const pairs = lcsPairs(a, b, 8_000_000);
  const out: CanonicalDifference[] = [];
  let ai = 0;
  let bi = 0;
  const flush = (untilA: number, untilB: number): void => {
    while (ai < untilA && out.length < limit) {
      const text = a[ai];
      if (text !== undefined) {
        out.push({
          line: ai + 1,
          kind: "removed",
          text: text.trim(),
          context: contexts[ai] ?? "(root)",
        });
      }
      ai += 1;
    }
    ai = untilA;
    while (bi < untilB && out.length < limit) {
      const text = b[bi];
      if (text !== undefined) {
        out.push({
          line: ai + 1,
          kind: "added",
          text: text.trim(),
          context: contexts[Math.min(ai, contexts.length - 1)] ?? "(root)",
        });
      }
      bi += 1;
    }
    bi = untilB;
  };
  for (const [pa, pb] of pairs) {
    flush(pa, pb);
    ai = pa + 1;
    bi = pb + 1;
  }
  flush(a.length, b.length);
  return out;
}

export interface NodeCounts {
  /** `{uri}local` → number of elements with that name. */
  readonly elements: ReadonlyMap<string, number>;
  /** `{uri}local/@{uri}attr` → number of occurrences. */
  readonly attributes: ReadonlyMap<string, number>;
  /** Normalised text content → number of occurrences. */
  readonly texts: ReadonlyMap<string, number>;
  readonly totalElements: number;
  readonly totalAttributes: number;
  readonly totalTexts: number;
}

function bump(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

/**
 * Count every element, attribute and non-whitespace text node in a document.
 * Namespace declarations are excluded: they are bookkeeping, and a serialiser
 * is free to hoist or drop them as long as the resolved names stay the same
 * (which the element/attribute keys, being URI-qualified, verify).
 */
export function countNodes(
  xml: string,
  options: CanonicalizeOptions = {},
): NodeCounts {
  const precision = options.numericPrecision ?? 6;
  const doc = parseXml(xml);
  const elements = new Map<string, number>();
  const attributes = new Map<string, number>();
  const texts = new Map<string, number>();

  const visit = (element: XmlElement, parentScope: NsScope): void => {
    const scope = pushScope(parentScope, element);
    const name = resolveElementName(scope, element);
    bump(elements, name);
    for (const attr of element.attributes) {
      if (attr.qname === "xmlns" || attr.prefix === "xmlns") continue;
      bump(
        attributes,
        `${name}/@${resolveAttrName(scope, attr.prefix, attr.local)}`,
      );
    }
    for (const child of normalizeChildren(element.children, false)) {
      if (child.kind === "element") visit(child, scope);
      else if (child.kind === "text") {
        bump(texts, normalizeValue(child.value, precision));
      }
    }
  };
  visit(doc.root, EMPTY_SCOPE);

  const sum = (m: Map<string, number>): number => {
    let total = 0;
    for (const v of m.values()) total += v;
    return total;
  };
  return {
    elements,
    attributes,
    texts,
    totalElements: sum(elements),
    totalAttributes: sum(attributes),
    totalTexts: sum(texts),
  };
}

export interface CountDifference {
  readonly kind: "element" | "attribute" | "text";
  readonly key: string;
  readonly before: number;
  readonly after: number;
}

/**
 * Z-C is an *inclusion*, not an equality: the output may contain more than the
 * input (added DI, for instance) but never less. `losses` therefore lists only
 * keys whose count went down; `additions` is reported separately so a reviewer
 * can see what the serialiser invented without that counting as a failure.
 */
export interface CountComparison {
  readonly losses: readonly CountDifference[];
  readonly additions: readonly CountDifference[];
}

export function diffCounts(
  before: NodeCounts,
  after: NodeCounts,
): CountComparison {
  const losses: CountDifference[] = [];
  const additions: CountDifference[] = [];
  const compare = (
    kind: CountDifference["kind"],
    a: ReadonlyMap<string, number>,
    b: ReadonlyMap<string, number>,
  ): void => {
    const keys = new Set([...a.keys(), ...b.keys()]);
    for (const key of [...keys].sort()) {
      const beforeCount = a.get(key) ?? 0;
      const afterCount = b.get(key) ?? 0;
      if (afterCount < beforeCount)
        losses.push({ kind, key, before: beforeCount, after: afterCount });
      else if (afterCount > beforeCount)
        additions.push({ kind, key, before: beforeCount, after: afterCount });
    }
  };
  compare("element", before.elements, after.elements);
  compare("attribute", before.attributes, after.attributes);
  compare("text", before.texts, after.texts);
  return { losses, additions };
}

/** Every element name (`{uri}local`) that occurs in the document, sorted. */
export function elementNames(xml: string): string[] {
  const doc = parseXml(xml);
  const names = new Set<string>();
  const visit = (element: XmlElement, parentScope: NsScope): void => {
    const scope = pushScope(parentScope, element);
    names.add(resolveElementName(scope, element));
    for (const child of element.children) {
      if (child.kind === "element") visit(child, scope);
    }
  };
  visit(doc.root, EMPTY_SCOPE);
  return [...names].sort();
}

/** Count of elements in the document, for quick corpus statistics. */
export function elementCount(xml: string): number {
  return [...walkElements(parseXml(xml).root)].length;
}
