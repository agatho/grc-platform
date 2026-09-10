/**
 * Reading and writing BPMN 2.0 XML through `bpmn-moddle`.
 *
 * This is the whole model layer of the spike: `importXml` turns XML into a
 * moddle tree, `exportXml` turns it back. Everything the round-trip harness
 * measures goes through these two functions.
 *
 * The one behaviour that is *not* plain moddle is Z-D (plan §5.1,
 * read-preserve-write): a definitions tree that was imported and never touched
 * remembers its source text and hands it back verbatim on export. That makes
 * the most common production path — open a diagram, create a version, export —
 * byte-identical rather than merely equivalent, which is as close to the
 * owner's "bit-treu" requirement as a re-serialising stack can get.
 */

import type { ModdleElement, ModdleWarning } from "bpmn-moddle";
import { arctosModdle } from "./moddle";
import type { BpmnModdleInstance } from "bpmn-moddle";

export interface ImportResult {
  readonly definitions: ModdleElement;
  readonly warnings: readonly ModdleWarning[];
}

export interface ImportOptions {
  /** Registry to parse with. Defaults to the shared ARCTOS registry. */
  readonly moddle?: BpmnModdleInstance;
  /**
   * Remember the source text on the returned tree so a later {@link exportXml}
   * can return it verbatim (Z-D). Default `true`.
   */
  readonly preserveSource?: boolean;
}

export interface ExportOptions {
  readonly moddle?: BpmnModdleInstance;
  /** Pretty-print. Default `true` — matches today's `saveXML({format:true})`. */
  readonly format?: boolean;
  /**
   * Honour the preserved source text when the tree is unmodified (Z-D).
   * Default `false`, because the round-trip harness must be able to measure
   * the *serialiser*, not the shortcut. Production callers pass `true`.
   */
  readonly preferPreservedSource?: boolean;
}

/**
 * Hidden slot for the source text. A symbol keeps it off `Object.keys`, out of
 * `toXML` (moddle only serialises schema-declared properties), and out of
 * anything that structurally clones or diffs the tree.
 */
const SOURCE_TEXT = Symbol.for("arctos.bpmn.sourceText");
/** Set to `true` by {@link markModified} as soon as anything edits the tree. */
const SOURCE_DIRTY = Symbol.for("arctos.bpmn.sourceDirty");

interface SourceCarrier {
  [SOURCE_TEXT]?: string;
  [SOURCE_DIRTY]?: boolean;
}

export class BpmnImportError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "BpmnImportError";
  }
}

export class BpmnExportError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "BpmnExportError";
  }
}

/**
 * Parse BPMN 2.0 XML into a moddle tree.
 *
 * Warnings are returned, never thrown or swallowed: `moddle-xml` reports
 * unresolvable references and unknown elements this way, and for the migration
 * measurement those are exactly the interesting cases.
 */
export async function importXml(
  xml: string,
  options: ImportOptions = {},
): Promise<ImportResult> {
  const moddle = options.moddle ?? arctosModdle;
  let result;
  try {
    result = await moddle.fromXML(xml, "bpmn:Definitions");
  } catch (error) {
    throw new BpmnImportError(
      `failed to import BPMN XML: ${error instanceof Error ? error.message : String(error)}`,
      error,
    );
  }
  const definitions = result.rootElement;
  if (options.preserveSource !== false) {
    const carrier = definitions as unknown as SourceCarrier;
    carrier[SOURCE_TEXT] = xml;
    carrier[SOURCE_DIRTY] = false;
  }
  return { definitions, warnings: result.warnings ?? [] };
}

/**
 * Serialise a moddle tree back to BPMN 2.0 XML.
 *
 * With `preferPreservedSource: true` and an untouched tree this returns the
 * original text unchanged (Z-D). Otherwise it re-serialises through moddle,
 * which normalises attribute order, prefixes, quoting and indentation — that
 * normalisation is precisely what Z-A and Z-B measure.
 */
export async function exportXml(
  definitions: ModdleElement,
  options: ExportOptions = {},
): Promise<string> {
  if (options.preferPreservedSource) {
    const preserved = getPreservedSource(definitions);
    if (preserved !== undefined) return preserved;
  }
  const moddle = options.moddle ?? arctosModdle;
  try {
    const { xml } = await moddle.toXML(definitions, {
      format: options.format ?? true,
    });
    return xml;
  } catch (error) {
    throw new BpmnExportError(
      `failed to export BPMN XML: ${error instanceof Error ? error.message : String(error)}`,
      error,
    );
  }
}

/**
 * The source text an untouched imported tree still carries, or `undefined`
 * when the tree was built in memory or has been marked modified.
 */
export function getPreservedSource(
  definitions: ModdleElement,
): string | undefined {
  const carrier = definitions as unknown as SourceCarrier;
  if (carrier[SOURCE_DIRTY]) return undefined;
  return carrier[SOURCE_TEXT];
}

/**
 * Declare that the tree has been edited. In the finished engine this is called
 * by the command stack on every `commandStack.changed`; here it is the explicit
 * hook the tests use to prove that Z-D stops applying after the first edit.
 */
export function markModified(definitions: ModdleElement): void {
  const carrier = definitions as unknown as SourceCarrier;
  carrier[SOURCE_DIRTY] = true;
}

/** True while the tree may still be exported byte-identically (Z-D holds). */
export function isUnmodified(definitions: ModdleElement): boolean {
  return getPreservedSource(definitions) !== undefined;
}

/**
 * Import and immediately re-export — the operation the round-trip assurances
 * are stated over. Always re-serialises (the Z-D shortcut is off).
 */
export async function roundTrip(
  xml: string,
  options: ImportOptions & ExportOptions = {},
): Promise<{ xml: string; warnings: readonly ModdleWarning[] }> {
  const { definitions, warnings } = await importXml(xml, options);
  const out = await exportXml(definitions, {
    ...options,
    preferPreservedSource: false,
  });
  return { xml: out, warnings };
}
