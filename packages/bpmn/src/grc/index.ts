/**
 * `@grc/bpmn/grc` — die GRC-Diagrammschicht.
 *
 * Sie bringt GRC-Information auf die Diagrammfläche und ist der Teil, der aus
 * einem BPMN-Editor ein GRC-Werkzeug macht (Plan §3). Sie arbeitet **ohne
 * Datenbankzugriff**: Sie bekommt einen typisierten Datensatz (`GrcOverlayData`,
 * die Nutzlast des geplanten Overlay-Endpunkts), rechnet daraus ein
 * Überlagerungsmodell, zeichnet es ins SVG und meldet Interaktionen nach oben.
 *
 * Aufbau in vier Schichten — jede für sich prüfbar:
 *
 * ```
 * contract.ts  Was die Anwendung liefert und was zurückkommt
 *      ↓
 * analysis / sod / trust / outage    reine Rechenkerne, kein DOM
 *      ↓
 * layers + catalog + views + slots   Signale, Budget, Sichten
 *      ↓
 * engine.ts → decorate.ts / text-alternative.ts / announce.ts
 *             (SVG)        (Tabelle)              (Live-Region)
 * ```
 *
 * Die drei Ausgabewege ganz unten benutzen **dasselbe** Modell. Eine Ampel, die
 * man sieht, aber nicht hört, kann so nicht entstehen.
 */

export {
  EMPTY_OVERLAY_DATA,
  // [STUFE2-E] Der Typ war im Vertrag deklariert, aber nicht ausgeliefert —
  // der Overlay-Endpunkt fuellt `elements[].conformance.matchKind` seit
  // Migration 0451 und braucht ihn, um den String zu pruefen statt ihn zu
  // behaupten.
  type GrcActivityMatchKind,
  type GrcAsset,
  type GrcBia,
  type GrcCalledProcess,
  type GrcComments,
  type GrcConformanceElement,
  type GrcConformanceSummary,
  type GrcControl,
  type GrcControlEffectiveness,
  type GrcCriticality,
  type GrcDataCategory,
  type GrcDiagramData,
  type GrcEdgeData,
  type GrcElementData,
  type GrcFinding,
  type GrcFindingSeverity,
  type GrcFrameworkMapping,
  type GrcFrameworkSelection,
  type GrcInteraction,
  type GrcInteractionHandler,
  type GrcKri,
  type GrcLaneData,
  type GrcLaneQualification,
  type GrcLineOfDefense,
  type GrcIncident,
  type GrcObservedTransition,
  type GrcObjectRef,
  type GrcOutageScenario,
  type GrcOverlayData,
  type GrcRaci,
  type GrcRisk,
  type GrcRoleRef,
  type GrcRopa,
  type GrcSimulation,
  type GrcSodRule,
  type GrcValidationFinding,
  type GrcValidationSeverity,
  type GrcWorkItem,
} from "./contract";

export {
  asOfDate,
  computeCoverage,
  computeEvidence,
  computeFindings,
  computeFrameworkElement,
  computeIncidents,
  computeKri,
  computeLaneCosts,
  computeRetention,
  computeWorkItems,
  conformanceGate,
  daysBetween,
  EVIDENCE_DUE_SOON_DAYS,
  FINDING_DUE_SOON_DAYS,
  HIGH_RISK_SCORE,
  isKriStale,
  KRI_STALE_FACTOR,
  MEDIUM_RISK_SCORE,
  personalDataStage,
  riskLevel,
  riskProfileOf,
  rollupRisk,
  SHORT_RETENTION_MONTHS,
  summarizeFramework,
  WORK_ITEM_DUE_SOON_DAYS,
  type ConformanceGate,
  type CoverageResult,
  type CoverageStage,
  type EvidenceResult,
  type EvidenceStage,
  type FindingResult,
  type FrameworkElementResult,
  type FrameworkSummary,
  type IncidentResult,
  type KriResult,
  type LaneCostEntry,
  type LaneCostResult,
  type PersonalDataStage,
  type RetentionResult,
  type RetentionStage,
  type RiskProfile,
  type WorkItemResult,
} from "./analysis";

export {
  buildGrcGraph,
  centerOf,
  descendants,
  isContainer,
  laneOf,
  midpointOf,
  onCommonPath,
  reachableFrom,
  type GrcGraph,
} from "./graph";

export {
  bearingRole,
  computeSelfControls,
  computeSod,
  type SelfControlFinding,
  type SodConflict,
  type SodEndpoint,
  type SodResult,
} from "./sod";

export {
  computeTrustBoundaries,
  type TrustCrossing,
  type TrustResult,
} from "./trust";

export {
  formatMinutes,
  simulateOutage,
  type OutageResult,
  type OutageState,
  type OutageStep,
} from "./outage";

export {
  MAX_BADGES,
  resolveSlots,
  SLOT_ORDER,
  type GrcArcSignal,
  type GrcBadgeSignal,
  type GrcBannerSignal,
  type GrcDiagramSignal,
  type GrcEdgeSignal,
  type GrcElementSignal,
  type GrcGhostEdgeSignal,
  type GrcGutterSignal,
  type GrcLaneFooterSignal,
  type GrcPinSignal,
  type GrcShapeSignal,
  type GrcSlot,
  type GrcStripeSignal,
  type OwnedSignal,
  type SlotResolution,
  type SuppressedSignal,
} from "./slots";

export {
  buildLayerContext,
  createLayerRegistry,
  type BuildContextOptions,
  type GrcFilter,
  type GrcLayer,
  type GrcLayerContext,
  type GrcLayerRegistry,
  type GrcLegendEntry,
} from "./layers";

export {
  ALL_LAYERS,
  carriesGrcData,
  flowWidth,
  MAX_DRAWN_ARCS,
  openFindingsFilter,
  outageFilter,
  PRIORITY,
  shortRetentionFilter,
  describeQualificationGaps,
} from "./catalog";

export {
  defaultRegistry,
  defaultViewForRole,
  GRC_VIEWS,
  resolveView,
  ROLE_DEFAULT_VIEW,
  viewById,
  type GrcView,
  type GrcViewId,
  type ResolvedView,
} from "./views";

export {
  buildOverlayModel,
  describeEdgeForAnnouncement,
  describeElementForAnnouncement,
  type BuildOverlayOptions,
  type GrcEdgeDecoration,
  type GrcElementDecoration,
  type GrcLegendGroup,
  type GrcOverlayModel,
} from "./engine";

export {
  decorateGrc,
  shapeCodingPath,
  type DecorateOptions,
  type GrcDecorationResult,
} from "./decorate";

export {
  buildGrcTextAlternative,
  renderGrcTextAlternativeTable,
  type GrcTextAlternative,
  type GrcTextColumn,
  type GrcTextRow,
} from "./text-alternative";

export {
  announcementFor,
  badgesOf,
  diagramAnnouncement,
  GrcBadgeCursor,
  type BadgeCursorHost,
  type GrcBadgeEntry,
} from "./announce";

export {
  renderGrcDefinitions,
  renderGrcScene,
  toGrcSvgString,
  type GrcRenderOptions,
  type GrcRenderResult,
} from "./render";

export {
  BADGE,
  badgeWidth,
  GRC_PALETTE,
  HATCH_SPACING,
  TONE_GLYPH,
  TONE_WORD,
  type GrcTone,
  type HatchDensity,
  type ToneColors,
} from "./tokens";

export {
  contrastRatio,
  lightness,
  perceptualDistance,
  relativeLuminance,
  simulateCvd,
  type ColorVisionDeficiency,
} from "./contrast";
