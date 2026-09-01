/**
 * Plain-data shapes for the ARCTOS GRC extension.
 *
 * These mirror `arctos-moddle-extension.json` one-for-one. They exist so that
 * application code can hold GRC metadata without carrying moddle elements
 * around, and so that a mismatch between the descriptor and the code that reads
 * it becomes a compile error rather than an `undefined` at runtime.
 */

export type LineOfDefense = string;

export interface GrcRiskRef {
  readonly id: string;
  readonly title?: string;
  readonly inherentScore?: number;
  readonly residualScore?: number;
  readonly status?: string;
}

export interface GrcControlRef {
  readonly id: string;
  readonly title?: string;
  readonly effectiveness?: string;
  readonly controlType?: string;
}

export interface GrcDocumentRef {
  readonly id: string;
  readonly title?: string;
  readonly documentType?: string;
}

export interface GrcRaci {
  readonly responsibleRoleId?: string;
  readonly accountableRoleId?: string;
  /** Comma-separated in the XML; kept verbatim, not split. */
  readonly consultedRoleIds?: string;
  readonly informedRoleIds?: string;
}

export interface GrcBcmKpi {
  readonly mtpdMinutes?: number;
  readonly rtoMinutes?: number;
  readonly rpoMinutes?: number;
  readonly criticality?: string;
}

export interface GrcRopa {
  readonly isProcessingActivity: boolean;
  readonly purpose?: string;
  readonly legalBasis?: string;
  readonly requiresDpia: boolean;
}

/** The full `<arctos:grcMetadata>` payload of a single flow node. */
export interface GrcMetadata {
  readonly lineOfDefense?: LineOfDefense;
  readonly complianceProfile?: string;
  readonly calledProcessId?: string;
  readonly isCriticalProcess: boolean;
  readonly riskRefs: readonly GrcRiskRef[];
  readonly controlRefs: readonly GrcControlRef[];
  readonly documentRefs: readonly GrcDocumentRef[];
  readonly raci?: GrcRaci;
  readonly bcmKpi?: GrcBcmKpi;
  readonly ropa?: GrcRopa;
}

/** A rectangle from `dc:Bounds`. */
export interface Bounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}
