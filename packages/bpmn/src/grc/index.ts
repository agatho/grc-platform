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
  type GrcLaneData,
  type GrcLineOfDefense,
  type GrcObjectRef,
  type GrcOutageScenario,
  type GrcOverlayData,
  type GrcRaci,
  type GrcRisk,
  type GrcRoleRef,
  type GrcRopa,
  type GrcSimulation,
  type GrcSodRule,
} from "./contract.js";

export {
  asOfDate,
  computeCoverage,
  computeEvidence,
  computeFindings,
  computeFrameworkElement,
  computeRetention,
  conformanceGate,
  daysBetween,
  EVIDENCE_DUE_SOON_DAYS,
  FINDING_DUE_SOON_DAYS,
  HIGH_RISK_SCORE,
  MEDIUM_RISK_SCORE,
  personalDataStage,
  riskLevel,
  riskProfileOf,
  rollupRisk,
  SHORT_RETENTION_MONTHS,
  summarizeFramework,
  type ConformanceGate,
  type CoverageResult,
  type CoverageStage,
  type EvidenceResult,
  type EvidenceStage,
  type FindingResult,
  type FrameworkElementResult,
  type FrameworkSummary,
  type PersonalDataStage,
  type RetentionResult,
  type RetentionStage,
  type RiskProfile,
} from "./analysis.js";

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
} from "./graph.js";

export {
  bearingRole,
  computeSelfControls,
  computeSod,
  type SelfControlFinding,
  type SodConflict,
  type SodEndpoint,
  type SodResult,
} from "./sod.js";

export {
  computeTrustBoundaries,
  type TrustCrossing,
  type TrustResult,
} from "./trust.js";

export {
  formatMinutes,
  simulateOutage,
  type OutageResult,
  type OutageState,
  type OutageStep,
} from "./outage.js";

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
  type GrcPinSignal,
  type GrcShapeSignal,
  type GrcSlot,
  type GrcStripeSignal,
  type OwnedSignal,
  type SlotResolution,
  type SuppressedSignal,
} from "./slots.js";

export {
  buildLayerContext,
  createLayerRegistry,
  type BuildContextOptions,
  type GrcFilter,
  type GrcLayer,
  type GrcLayerContext,
  type GrcLayerRegistry,
  type GrcLegendEntry,
} from "./layers.js";

export {
  ALL_LAYERS,
  carriesGrcData,
  flowWidth,
  MAX_DRAWN_ARCS,
  openFindingsFilter,
  outageFilter,
  PRIORITY,
  shortRetentionFilter,
} from "./catalog.js";

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
} from "./views.js";

export {
  buildOverlayModel,
  describeEdgeForAnnouncement,
  describeElementForAnnouncement,
  type BuildOverlayOptions,
  type GrcEdgeDecoration,
  type GrcElementDecoration,
  type GrcLegendGroup,
  type GrcOverlayModel,
} from "./engine.js";

export {
  decorateGrc,
  shapeCodingPath,
  type DecorateOptions,
  type GrcDecorationResult,
} from "./decorate.js";

export {
  buildGrcTextAlternative,
  renderGrcTextAlternativeTable,
  type GrcTextAlternative,
  type GrcTextColumn,
  type GrcTextRow,
} from "./text-alternative.js";

export {
  announcementFor,
  badgesOf,
  diagramAnnouncement,
  GrcBadgeCursor,
  type BadgeCursorHost,
  type GrcBadgeEntry,
} from "./announce.js";

export {
  renderGrcDefinitions,
  renderGrcScene,
  toGrcSvgString,
  type GrcRenderOptions,
  type GrcRenderResult,
} from "./render.js";

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
} from "./tokens.js";

export {
  contrastRatio,
  lightness,
  perceptualDistance,
  relativeLuminance,
  simulateCvd,
  type ColorVisionDeficiency,
} from "./contrast.js";
