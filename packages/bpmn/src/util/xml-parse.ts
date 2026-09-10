/**
 * A small, dependency-free XML reader.
 *
 * Why not `DOMParser`? Three reasons, all of them about the measurement this
 * package exists for:
 *
 *  1. The round-trip harness has to *count* nodes exactly (Z-C, non-loss). A
 *     DOM implementation normalises some things silently (adjacent text nodes,
 *     CDATA sections, entity handling); we need to see the document as it was
 *     written, not as a browser chose to model it.
 *  2. `tsconfig.base.json` sets `lib: ["ES2022"]` — there are no DOM types in
 *     this workspace, and adding them to get a parser would be the tail wagging
 *     the dog.
 *  3. The canonicaliser (`xml-canonical.ts`) needs prefix-independent access to
 *     namespace URIs. Doing the scope resolution ourselves is a dozen lines and
 *     removes any doubt about what was compared.
 *
 * The reader is deliberately strict about well-formedness (unbalanced tags
 * throw) and deliberately lax about everything a BPMN file never contains
 * (DTD internal subsets, entity declarations, namespaces in DTDs).
 */

export interface XmlAttribute {
  /** Raw qualified name as written, e.g. `bpmn:process` or `xmlns:dc`. */
  readonly qname: string;
  /** Prefix part of the qname, `""` when unprefixed. */
  readonly prefix: string;
  /** Local part of the qname. */
  readonly local: string;
  /** Attribute value with entity references already decoded. */
  readonly value: string;
}

export interface XmlElement {
  readonly kind: "element";
  readonly qname: string;
  readonly prefix: string;
  readonly local: string;
  readonly attributes: readonly XmlAttribute[];
  readonly children: readonly XmlNode[];
}

export interface XmlText {
  readonly kind: "text";
  /** Decoded character data. */
  readonly value: string;
  /** True when the source spelled it as a `<![CDATA[…]]>` section. */
  readonly cdata: boolean;
}

export interface XmlComment {
  readonly kind: "comment";
  readonly value: string;
}

export interface XmlProcessingInstruction {
  readonly kind: "pi";
  readonly target: string;
  readonly value: string;
}

export interface XmlDoctype {
  readonly kind: "doctype";
  readonly value: string;
}

export type XmlNode =
  XmlElement | XmlText | XmlComment | XmlProcessingInstruction | XmlDoctype;

export interface XmlDocument {
  /** Everything before/after the root element, in document order. */
  readonly prolog: readonly XmlNode[];
  readonly root: XmlElement;
  readonly epilog: readonly XmlNode[];
}

export class XmlParseError extends Error {
  constructor(
    message: string,
    readonly offset: number,
  ) {
    super(`${message} (at offset ${offset})`);
    this.name = "XmlParseError";
  }
}

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

/** Decode the five predefined entities plus numeric character references. */
export function decodeEntities(input: string): string {
  if (!input.includes("&")) return input;
  return input.replace(
    /&(#x?[0-9A-Fa-f]+|[A-Za-z][A-Za-z0-9]*);/g,
    (all, ref: string) => {
      if (ref.startsWith("#x") || ref.startsWith("#X")) {
        const code = Number.parseInt(ref.slice(2), 16);
        return Number.isFinite(code) ? String.fromCodePoint(code) : all;
      }
      if (ref.startsWith("#")) {
        const code = Number.parseInt(ref.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : all;
      }
      const named = NAMED_ENTITIES[ref];
      return named ?? all;
    },
  );
}

function splitQName(qname: string): { prefix: string; local: string } {
  const idx = qname.indexOf(":");
  if (idx === -1) return { prefix: "", local: qname };
  return { prefix: qname.slice(0, idx), local: qname.slice(idx + 1) };
}

const NAME_START = /[A-Za-z_:]/;
const NAME_CHAR = /[-A-Za-z0-9._:]/;

interface OpenElement {
  qname: string;
  prefix: string;
  local: string;
  attributes: XmlAttribute[];
  children: XmlNode[];
}

/**
 * Parse an XML document. Throws {@link XmlParseError} on malformed input;
 * never returns a partial tree.
 */
export function parseXml(source: string): XmlDocument {
  let pos = 0;
  const len = source.length;
  const stack: OpenElement[] = [];
  const prolog: XmlNode[] = [];
  const epilog: XmlNode[] = [];
  let root: XmlElement | undefined;

  const emit = (node: XmlNode): void => {
    const top = stack[stack.length - 1];
    if (top) top.children.push(node);
    else if (root) epilog.push(node);
    else prolog.push(node);
  };

  const readName = (): string => {
    const start = pos;
    const first = source[pos];
    if (first === undefined || !NAME_START.test(first)) {
      throw new XmlParseError("expected a name", pos);
    }
    pos += 1;
    while (pos < len) {
      const ch = source[pos];
      if (ch === undefined || !NAME_CHAR.test(ch)) break;
      pos += 1;
    }
    return source.slice(start, pos);
  };

  const skipSpace = (): void => {
    while (pos < len) {
      const ch = source[pos];
      if (ch !== " " && ch !== "\t" && ch !== "\n" && ch !== "\r") break;
      pos += 1;
    }
  };

  while (pos < len) {
    const lt = source.indexOf("<", pos);

    if (lt === -1) {
      const rest = source.slice(pos);
      if (rest.trim().length > 0) {
        throw new XmlParseError(
          "character data outside of the root element",
          pos,
        );
      }
      break;
    }

    if (lt > pos) {
      const raw = source.slice(pos, lt);
      if (stack.length === 0) {
        if (raw.trim().length > 0) {
          throw new XmlParseError(
            "character data outside of the root element",
            pos,
          );
        }
      } else {
        emit({ kind: "text", value: decodeEntities(raw), cdata: false });
      }
      pos = lt;
    }

    // --- <!-- comment --> / <![CDATA[…]]> / <!DOCTYPE …>
    if (source.startsWith("<!--", pos)) {
      const end = source.indexOf("-->", pos + 4);
      if (end === -1) throw new XmlParseError("unterminated comment", pos);
      emit({ kind: "comment", value: source.slice(pos + 4, end) });
      pos = end + 3;
      continue;
    }
    if (source.startsWith("<![CDATA[", pos)) {
      const end = source.indexOf("]]>", pos + 9);
      if (end === -1)
        throw new XmlParseError("unterminated CDATA section", pos);
      // CDATA content is *not* entity-decoded — that is the point of CDATA.
      emit({ kind: "text", value: source.slice(pos + 9, end), cdata: true });
      pos = end + 3;
      continue;
    }
    if (source.startsWith("<!", pos)) {
      // DOCTYPE (possibly with an internal subset in brackets).
      let depth = 0;
      let i = pos + 2;
      for (; i < len; i += 1) {
        const ch = source[i];
        if (ch === "[") depth += 1;
        else if (ch === "]") depth -= 1;
        else if (ch === ">" && depth <= 0) break;
      }
      if (i >= len) throw new XmlParseError("unterminated declaration", pos);
      emit({ kind: "doctype", value: source.slice(pos + 2, i) });
      pos = i + 1;
      continue;
    }

    // --- <?target …?>
    if (source.startsWith("<?", pos)) {
      const end = source.indexOf("?>", pos + 2);
      if (end === -1)
        throw new XmlParseError("unterminated processing instruction", pos);
      const body = source.slice(pos + 2, end);
      const m = /^([^\s]+)\s*([\s\S]*)$/.exec(body);
      emit({ kind: "pi", target: m?.[1] ?? body, value: m?.[2] ?? "" });
      pos = end + 2;
      continue;
    }

    // --- </close>
    if (source.startsWith("</", pos)) {
      pos += 2;
      const name = readName();
      skipSpace();
      if (source[pos] !== ">")
        throw new XmlParseError("malformed end tag", pos);
      pos += 1;
      const open = stack.pop();
      if (!open) throw new XmlParseError(`unexpected end tag </${name}>`, pos);
      if (open.qname !== name) {
        throw new XmlParseError(
          `end tag </${name}> does not match start tag <${open.qname}>`,
          pos,
        );
      }
      const element: XmlElement = {
        kind: "element",
        qname: open.qname,
        prefix: open.prefix,
        local: open.local,
        attributes: open.attributes,
        children: open.children,
      };
      if (stack.length === 0) {
        if (root) throw new XmlParseError("more than one root element", pos);
        root = element;
      } else {
        const parent = stack[stack.length - 1];
        if (parent) parent.children.push(element);
      }
      continue;
    }

    // --- <open …> / <empty …/>
    pos += 1;
    const qname = readName();
    const { prefix, local } = splitQName(qname);
    const attributes: XmlAttribute[] = [];
    for (;;) {
      skipSpace();
      const ch = source[pos];
      if (ch === undefined)
        throw new XmlParseError("unterminated start tag", pos);
      if (ch === ">" || (ch === "/" && source[pos + 1] === ">")) break;
      const attrName = readName();
      skipSpace();
      if (source[pos] !== "=")
        throw new XmlParseError("expected '=' in attribute", pos);
      pos += 1;
      skipSpace();
      const quote = source[pos];
      if (quote !== '"' && quote !== "'") {
        throw new XmlParseError("attribute value must be quoted", pos);
      }
      pos += 1;
      const valueEnd = source.indexOf(quote, pos);
      if (valueEnd === -1)
        throw new XmlParseError("unterminated attribute value", pos);
      const rawValue = source.slice(pos, valueEnd);
      pos = valueEnd + 1;
      const split = splitQName(attrName);
      attributes.push({
        qname: attrName,
        prefix: split.prefix,
        local: split.local,
        value: decodeEntities(rawValue),
      });
    }

    const selfClosing = source[pos] === "/";
    pos += selfClosing ? 2 : 1;

    if (selfClosing) {
      const element: XmlElement = {
        kind: "element",
        qname,
        prefix,
        local,
        attributes,
        children: [],
      };
      if (stack.length === 0) {
        if (root) throw new XmlParseError("more than one root element", pos);
        root = element;
      } else {
        const parent = stack[stack.length - 1];
        if (parent) parent.children.push(element);
      }
    } else {
      stack.push({ qname, prefix, local, attributes, children: [] });
    }
  }

  if (stack.length > 0) {
    const open = stack[stack.length - 1];
    throw new XmlParseError(`unclosed element <${open?.qname ?? "?"}>`, pos);
  }
  if (!root) throw new XmlParseError("document has no root element", pos);

  return { prolog, root, epilog };
}

/** Depth-first walk over every element in the document, root first. */
export function* walkElements(
  element: XmlElement,
): Generator<XmlElement, void, undefined> {
  yield element;
  for (const child of element.children) {
    if (child.kind === "element") yield* walkElements(child);
  }
}
