# Dead-Exports-Report

_Generated: 2026-09-03T18:28:09.813Z_

Static-Analyse findet `export`-Statements ohne matching `import` im Code. Heuristik, nicht vollstaendig:

**Nicht erkannt**:

- `import * as X` Namespace-Imports (Symbole dahinter)
- Dynamic `import()` mit String-Template
- API-Nutzung per fetch / HTTP (externe Consumer)
- `export default` in Route/Page-Files (ignoriert)
- Vitest-Tests in tests/ (nicht im Scan)

**2765 potenziell tote Exports** in 470 Dateien.

## Top-20 Hot-Spots (>=3 dead exports)

| Datei                                                    | Anzahl | Exports                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/shared/src/index.ts`                           | 70     | `aesGcmDecrypt`, `normalizeNumericIPv4`, `webhookUrlRefine`, `webhookUrlRefineMessage`, `inspectZipArchive`, `SPREADSHEET_ZIP_LIMITS`, `sniffFileType`, `MAGIC_BYTE_SIGNATURES`, `ALLOWED_TRANSITIONS`, `phaseForStatus` ...                                                                                                    |
| `packages/db/src/schema/programme.ts`                    | 37     | `msTypeEnum`, `pdcaPhaseEnum`, `programmeJourneyStatusEnum`, `programmeStepStatusEnum`, `programmeApprovalStatusEnum`, `programmeSubtaskStatusEnum`, `programmeLinkKindEnum`, `programmeLinkTypeEnum`, `ProgrammeTemplate`, `ProgrammeTemplateInsert` ...                                                                       |
| `packages/shared/src/types/eam-advanced.ts`              | 30     | `TransferMechanism`, `EncryptionType`, `EncryptionAtRest`, `DataFlowFrequency`, `DataFlowStatus`, `LegalBasis`, `SchremsIiSafeguard`, `InterfaceType`, `InterfaceDirection`, `HealthStatus` ...                                                                                                                                 |
| `packages/shared/src/types/tprm.ts`                      | 29     | `VendorTier`, `VendorCategory`, `DueDiligenceStatus`, `ContractStatus`, `ContractType`, `ObligationStatus`, `ObligationType`, `Vendor`, `VendorContact`, `VendorRiskAssessment` ...                                                                                                                                             |
| `packages/shared/src/types/dora.ts`                      | 26     | `DoraIctAssetType`, `DoraThreatCategory`, `DoraLikelihood`, `DoraImpact`, `DoraRiskLevel`, `DoraTreatmentStrategy`, `DoraIctRiskStatus`, `DoraTlptTestType`, `DoraTlptStatus`, `DoraIncidentType` ...                                                                                                                           |
| `packages/shared/src/schemas/risk-evaluation.ts`         | 25     | `riskObjectTypeValues`, `riskObjectTypeSchema`, `RiskObjectType`, `evaluationPhaseValues`, `evaluationPhaseSchema`, `EvaluationPhase`, `evaluationCycleValues`, `evaluationCycleSchema`, `EvaluationCycle`, `evaluationTypeValues` ...                                                                                          |
| `packages/shared/src/types/eam-visualizations.ts`        | 25     | `LifecyclePhase`, `GridColoringMode`, `OverlayMode`, `RoadmapGroupBy`, `ContextDiagramSector`, `InsightGridData`, `GridColumn`, `GridRow`, `GridCell`, `ContextDiagramData` ...                                                                                                                                                 |
| `packages/shared/src/types/eam-governance.ts`            | 24     | `GovernanceStatus`, `GovernanceAction`, `GovernanceRole`, `BpmnPlacementType`, `BiExportFormat`, `GOVERNANCE_TRANSITIONS`, `GovernanceLogEntry`, `GovernanceTransitionRequest`, `BulkGovernanceRequest`, `GovernanceRoleAssignment` ...                                                                                         |
| `packages/shared/src/types/eam.ts`                       | 23     | `ArchitectureLayer`, `ArchitectureType`, `ArchRelationshipType`, `ElementStatus`, `EamCriticality`, `LifecycleStatus`, `TimeClassification`, `LicenseType`, `DataClassification`, `StrategicImportance` ...                                                                                                                     |
| `packages/shared/src/schemas/esg-advanced.ts`            | 22     | `createEsgAdvMaterialityAssessmentSchema`, `updateEsgAdvMaterialityAssessmentSchema`, `ESRS_TOPICS`, `createIroSchema`, `updateIroSchema`, `createStakeholderEngagementSchema`, `updateEmissionSourceSchema`, `createActivityDataSchema`, `createCustomEmissionFactorSchema`, `createCollectionCampaignSchema` ...              |
| `packages/shared/src/types/bpm-advanced.ts`              | 22     | `ProcessEventLog`, `ProcessEvent`, `DirectlyFollowsGraph`, `DfgNode`, `DfgEdge`, `ProcessConformanceResult`, `ConformanceDeviationEdge`, `PrecisionIssue`, `ReworkLoop`, `Bottleneck` ...                                                                                                                                       |
| `packages/shared/src/types/evidence-connector.ts`        | 22     | `ConnectorType`, `ConnectorStatus`, `ConnectorAuthMethod`, `ConnectorHealthStatus`, `CredentialType`, `ArtifactType`, `TestResultStatus`, `TestSeverity`, `TestCategory`, `ScheduleRunStatus` ...                                                                                                                               |
| `packages/shared/src/schemas/audit-advanced.ts`          | 21     | `createWpFolderSchema`, `updateWpFolderSchema`, `updateWorkingPaperSchema`, `WP_STATUS_TRANSITIONS`, `isValidWpTransition`, `wpTransitionSchema`, `createReviewNoteSchema`, `resolveReviewNoteSchema`, `createReviewNoteReplySchema`, `updateAuditorProfileSchema` ...                                                          |
| `packages/shared/src/types/ai-act.ts`                    | 21     | `AiRiskClassification`, `AiTechnique`, `AiAnnexCategory`, `AiProviderDeployer`, `AiSystemStatus`, `AiAssessmentType`, `AiAssessmentResult`, `AiAssessmentStatus`, `AiOversightLogType`, `AiTransparencyEntryType` ...                                                                                                           |
| `packages/shared/src/types/eam-ai.ts`                    | 21     | `LLMProviderId`, `AIValidationStatus`, `TranslationStatus`, `SuggestionReason`, `LLMProviderConfig`, `ChatMessage`, `LLMOptions`, `LLMResponse`, `AIConfigResponse`, `AIProviderStatus` ...                                                                                                                                     |
| `packages/shared/src/types/eam-dashboards.ts`            | 21     | `FunctionalFit`, `TechnicalFit`, `SixRStrategy`, `BusinessCriticality`, `FunctionalCoverage`, `StrategicAlignmentLevel`, `CapabilityLifecycleStatus`, `AssessmentDimension`, `AssessmentHistoryEntry`, `CostDashboardData` ...                                                                                                  |
| `packages/shared/src/types/tax-cms.ts`                   | 21     | `TaxCmsElementType`, `TaxCmsElementStatus`, `TaxType`, `TaxRiskCategory`, `TaxRiskStatus`, `GobdDocumentType`, `GobdArchiveStatus`, `IcfrControlType`, `IcfrProcessArea`, `IcfrAssertion` ...                                                                                                                                   |
| `packages/shared/src/types/eam-data-architecture.ts`     | 20     | `DataCategory`, `DataClassificationLevel`, `ContextType`, `ContextStatus`, `EamDataObject`, `EamDataObjectCrud`, `CrudMatrixRow`, `CrudMatrixCell`, `DataLineageGraph`, `DataLineageFlow` ...                                                                                                                                   |
| `packages/shared/src/schemas/playbook.ts`                | 19     | `playbookTriggerCategory`, `PlaybookTriggerCategory`, `playbookTriggerSeverity`, `PlaybookTriggerSeverity`, `playbookActivationStatus`, `PlaybookActivationStatus`, `playbookAssignedRole`, `SEVERITY_ORDER`, `INCIDENT_TO_PLAYBOOK_SEVERITY`, `playbookTaskTemplateSchema` ...                                                 |
| `packages/shared/src/schemas/automation.ts`              | 18     | `automationTriggerTypeValues`, `automationActionTypeValues`, `conditionOperatorValues`, `conditionComparisonOpValues`, `automationExecutionStatusValues`, `automationTemplateCategoryValues`, `automationTriggerConfigSchema`, `conditionGroupSchema`, `createTaskActionConfigSchema`, `sendNotificationActionConfigSchema` ... |
| `packages/shared/src/schemas/bi-reporting.ts`            | 18     | `biReportStatusValues`, `biWidgetTypeValues`, `biDataSourceTypeValues`, `biQueryStatusValues`, `biShareAccessValues`, `biScheduleFrequencyValues`, `biExecutionStatusValues`, `biOutputFormatValues`, `biWidgetPositionSchema`, `CreateBiReportInput` ...                                                                       |
| `packages/shared/src/types/audit-advanced.ts`            | 17     | `AuditWpFolder`, `AuditWorkingPaper`, `AuditWpReviewNote`, `AuditWpReviewNoteReply`, `AuditorProfile`, `AuditorCertification`, `AuditResourceAllocation`, `AuditTimeEntry`, `ContinuousAuditRule`, `ContinuousAuditResult` ...                                                                                                  |
| `packages/shared/src/types/control-testing-agent.ts`     | 17     | `AgentTestType`, `TestConnectorType`, `TestFrequency`, `TestExecutionStatus`, `AgentTestResult`, `AgentTestResultSeverity`, `TestTriggeredBy`, `ChecklistStatus`, `AgentChecklistResult`, `ChecklistItemResponse` ...                                                                                                           |
| `packages/shared/src/types/framework-mapping.ts`         | 17     | `FrameworkKey`, `MappingRelationshipType`, `MappingSource`, `MappingRuleType`, `CoverageStatus`, `CoverageSource`, `EvidenceStatus`, `AssessmentResult`, `RiskExposure`, `FrameworkMapping` ...                                                                                                                                 |
| `packages/shared/src/types/predictive-risk.ts`           | 17     | `PredictionModelType`, `PredictionAlgorithm`, `PredictionTargetMetric`, `PredictionModelStatus`, `PredictionType`, `PredictionEntityType`, `PredictiveTrendDirection`, `RiskLevel`, `AnomalyType`, `AnomalySeverity` ...                                                                                                        |
| `packages/shared/src/schemas/audit.ts`                   | 16     | `checklistResultValues`, `ChecklistResultValue`, `auditMethodValues`, `AuditMethodValue`, `auditRiskRatingValues`, `AuditRiskRatingValue`, `methodEntryInterviewSchema`, `methodEntryDocumentReviewSchema`, `methodEntryObservationSchema`, `methodEntryWalkthroughSchema` ...                                                  |
| `packages/shared/src/schemas/dpms-advanced.ts`           | 16     | `updateRetentionScheduleSchema`, `createRetentionExceptionSchema`, `approveDeletionSchema`, `verifyDeletionSchema`, `DELETION_TRANSITIONS`, `isValidDeletionTransition`, `createTiaAdvancedSchema`, `updateTiaAdvancedSchema`, `updateDpmsChecklistSchema`, `createDpmsSubProcessorNotificationSchema` ...                      |
| `packages/shared/src/types/abac.ts`                      | 16     | `AbacAccessLevel`, `AbacDecision`, `SimulationStatus`, `DmnStatus`, `DmnHitPolicy`, `AbacCondition`, `AbacAccessLogEntry`, `AbacTestResult`, `SimulationScenario`, `SimulationResource` ...                                                                                                                                     |
| `packages/shared/src/types/audit.ts`                     | 16     | `AuditType`, `AuditPlanStatus`, `ChecklistResult`, `AuditMethod`, `AuditRiskRating`, `MethodEntryBase`, `MethodEntryInterview`, `MethodEntryDocumentReview`, `MethodEntryObservation`, `MethodEntryWalkthrough` ...                                                                                                             |
| `packages/shared/src/types/cert-wizard.ts`               | 16     | `CertFramework`, `CertAssessmentStatus`, `CertMockAuditType`, `CertMockAuditStatus`, `CertEvidenceStatus`, `CertControlDetail`, `CertGapItem`, `CertTimelinePhase`, `CertRisk`, `CertEvidenceItem` ...                                                                                                                          |
| `packages/shared/src/types/regulatory-change.ts`         | 16     | `RegulatorySourceType`, `RegulatoryChangeType`, `RegulatoryClassification`, `RegulatoryChangeStatus`, `ImpactLevel`, `ImpactAssessmentStatus`, `RegulatoryCalendarEventType`, `CalendarPriority`, `DigestType`, `RegulatoryImpactAssessment` ...                                                                                |
| `packages/shared/src/schemas/evidence-connector.ts`      | 15     | `connectorTypeValues`, `connectorStatusValues`, `connectorAuthMethodValues`, `connectorHealthStatusValues`, `credentialTypeValues`, `artifactTypeValues`, `testResultStatusValues`, `testSeverityValues`, `testCategoryValues`, `healthCheckTypeValues` ...                                                                     |
| `packages/shared/src/types/horizon-scanner.ts`           | 15     | `HorizonSourceType`, `HorizonParserType`, `HorizonItemType`, `HorizonClassification`, `HorizonItemStatus`, `HorizonImpactLevel`, `HorizonAssessmentStatus`, `HorizonCalendarEventType`, `HorizonPriority`, `HorizonNlpTopic` ...                                                                                                |
| `packages/shared/src/schemas/dpms.ts`                    | 14     | `ropaStatusTransitionSchema`, `VALID_ROPA_STATUS_TRANSITIONS`, `createRopaDataCategorySchema`, `createRopaDataSubjectSchema`, `createRopaRecipientSchema`, `thirdCountryTransferSchema`, `dpiaStatusTransitionSchema`, `VALID_DPIA_STATUS_TRANSITIONS`, `dsrStatusTransitionSchema`, `DSR_STATUS_TRANSITIONS` ...               |
| `packages/shared/src/schemas/framework-mapping.ts`       | 14     | `frameworkKeyValues`, `mappingRelationshipTypeValues`, `mappingSourceValues`, `mappingRuleTypeValues`, `coverageStatusValues`, `coverageSourceValues`, `evidenceStatusValues`, `assessmentResultValues`, `riskExposureValues`, `upsertCoverageSchema` ...                                                                       |
| `packages/shared/src/schemas/whistleblowing-advanced.ts` | 14     | `INVESTIGATION_TRANSITIONS`, `assignInvestigatorSchema`, `recordDecisionSchema`, `createWbEvidenceSchema`, `createInterviewSchema`, `updateProtectionCaseSchema`, `createProtectionEventSchema`, `reviewProtectionEventSchema`, `DEFAULT_RETALIATION_RULES`, `createTelephoneIntakeSchema` ...                                  |
| `packages/shared/src/types/copilot-chat.ts`              | 14     | `CopilotLanguage`, `CopilotMessageRole`, `CopilotContentType`, `CopilotActionType`, `CopilotActionStatus`, `PromptCategory`, `RagSourceType`, `RagReference`, `PromptVariable`, `CopilotRagSource` ...                                                                                                                          |
| `packages/shared/src/types/eam-catalog.ts`               | 14     | `EamCatalogObjectType`, `CatalogTab`, `EamWidgetType`, `CatalogFilters`, `CatalogItem`, `CatalogResult`, `CatalogFacet`, `FacetValue`, `EamKeyword`, `HomepageLayout` ...                                                                                                                                                       |
| `packages/shared/src/types/rcsa.ts`                      | 14     | `RcsaCampaignStatus`, `RcsaCampaignFrequency`, `RcsaAssignmentStatus`, `RcsaEntityType`, `RcsaRiskTrend`, `RcsaControlEffectiveness`, `RcsaDiscrepancyType`, `RcsaTargetScope`, `RcsaCampaign`, `RcsaAssignment` ...                                                                                                            |
| `packages/db/src/schema/platform.ts`                     | 14     | `orgTypeEnum`, `lineOfDefenseEnum`, `auditActionEnum`, `accessEventTypeEnum`, `authMethodEnum`, `exportTypeEnum`, `notificationTypeEnum`, `notificationChannelEnum`, `invitationStatusEnum`, `account` ...                                                                                                                      |

## Alle Treffer (alphabetisch)

- `apps/web/src/__tests__/api/helpers/db-proxy.ts` -- `getMockDb`, `dbMockFactory`
- `apps/web/src/__tests__/api/helpers/mock-context.ts` -- `MockApiContext`
- `apps/web/src/app/(dashboard)/dashboard/modern-dashboard.tsx` -- `ModernDashboardProps`
- `apps/web/src/app/api/v1/ai/_shared/ai-route.ts` -- `PROBLEM_BASE`
- `apps/web/src/app/api/v1/audit-log/anchor/route.ts` -- `collectLeaves`, `anchorGate`, `upsertAnchor`
- `apps/web/src/app/api/v1/audit-log/integrity/route.ts` -- `computeIntegrity`
- `apps/web/src/app/api/v1/bpm/my-processes/route.ts` -- `MyProcessListItem`
- `apps/web/src/app/api/v1/eam/ai/_shared/config.ts` -- `EamAiConfigValues`, `LoadedEamAiConfig`
- `apps/web/src/app/api/v1/findings/route.ts` -- `FindingFkMismatchError`
- `apps/web/src/app/api/v1/processes/[id]/status/route.ts` -- `PUT`
- `apps/web/src/app/api/v1/processes/_lib/bpmn-lanes.ts` -- `ParsedBpmnLane`, `ParsedBpmnLanes`
- `apps/web/src/app/api/v1/processes/_lib/grc-maintenance.ts` -- `LanePatchInput`, `BiaInput`, `BiaValues`
- `apps/web/src/app/api/v1/processes/_lib/sync-process-lanes.ts` -- `LaneSyncStats`
- `apps/web/src/auth.ts` -- `FreshRoleResult`
- `apps/web/src/components/bpmn/arctos-bpmn-canvas.tsx` -- `ArctosBpmnCanvasProps`
- `apps/web/src/components/bpmn/bpmn-a11y.tsx` -- `humaniseBpmnType`, `BpmnTextAlternativeProps`
- `apps/web/src/components/bpmn/bpmn-canvas-types.ts` -- `BpmnEngineProp`, `GrcDecorationProps`
- `apps/web/src/components/bpmn/bpmn-grc-bridge.ts` -- `StepRiskInput`, `ControlCoverageInput`, `FindingInput`, `ProcessStepInput`, `CallLinkInput`, `BuildOverlayDataInput`
- `apps/web/src/components/bpmn/bpmn-viewer.tsx` -- `BpmnGrcViewerProps`
- `apps/web/src/components/bpmn/grc-view-preference.ts` -- `GrcDiagramPreference`, `UseGrcDiagramPreferenceResult`, `preferenceUrl`
- `apps/web/src/components/bpmn/grc-view-select.tsx` -- `GrcFrameworkOption`, `GrcViewSelectProps`
- `apps/web/src/components/calendar/upcoming-widget.tsx` -- `CalendarUpcomingWidget`
- `apps/web/src/components/dashboard/index.ts` -- `WIDGET_TYPE_GROUPS`
- `apps/web/src/components/dashboard/widget-registry.tsx` -- `WIDGET_TYPE_GROUPS`
- `apps/web/src/components/documents/document-signatures-tab.tsx` -- `SignatureEntry`
- `apps/web/src/components/export/export-button.tsx` -- `ExportButton`
- `apps/web/src/components/invitations/invitation-panel.tsx` -- `InvitationPanel`
- `apps/web/src/components/layout/module-tab-config.ts` -- `ModuleTab`
- `apps/web/src/components/layout/nav-config.ts` -- `NavItem`, `NavGroupKey`, `NavGroupItem`, `NavGroup`, `navItems`, `platformSectionOrder`, `sectionLabelKeys`, `FlatNavEntry`, `CondensedNavItem`
- `apps/web/src/components/risk/risk-heat-map.tsx` -- `RiskHeatMapProps`
- `apps/web/src/components/translation/index.ts` -- `LanguageTabs`, `SideBySideEditor`, `LanguageIndicator`
- `apps/web/src/components/translation/language-indicator.tsx` -- `LanguageIndicator`
- `apps/web/src/components/translation/language-tabs.tsx` -- `LanguageTabs`
- `apps/web/src/components/translation/side-by-side-editor.tsx` -- `SideBySideEditor`
- `apps/web/src/components/ui/alert-dialog.tsx` -- `AlertDialogPortal`, `AlertDialogOverlay`
- `apps/web/src/components/ui/avatar.tsx` -- `Avatar`, `AvatarImage`, `AvatarFallback`
- `apps/web/src/components/ui/badge.tsx` -- `BadgeProps`, `badgeVariants`
- `apps/web/src/components/ui/button.tsx` -- `ButtonProps`
- `apps/web/src/components/ui/card.tsx` -- `CardFooter`
- `apps/web/src/components/ui/dialog.tsx` -- `DialogPortal`, `DialogOverlay`, `DialogClose`
- `apps/web/src/components/ui/dropdown-menu.tsx` -- `DropdownMenuSeparator`, `DropdownMenuLabel`, `DropdownMenuGroup`, `DropdownMenuPortal`
- `apps/web/src/components/ui/field.tsx` -- `FieldContextValue`, `FieldProps`
- `apps/web/src/components/ui/input.tsx` -- `InputProps`
- `apps/web/src/components/ui/loading-spinner.tsx` -- `LoadingSpinner`, `LoadingPage`
- `apps/web/src/components/ui/modal-shell.tsx` -- `UseModalDialogResult`, `ModalBackdropProps`
- `apps/web/src/components/ui/select.tsx` -- `SelectGroup`, `SelectLabel`, `SelectSeparator`, `SelectScrollUpButton`, `SelectScrollDownButton`
- `apps/web/src/components/ui/separator.tsx` -- `Separator`
- `apps/web/src/components/ui/sheet.tsx` -- `SheetTrigger`, `SheetDescription`, `SheetClose`
- `apps/web/src/components/ui/skeleton.tsx` -- `Skeleton`
- `apps/web/src/components/ui/switch.tsx` -- `SwitchProps`
- `apps/web/src/components/ui/table.tsx` -- `TableFooter`, `TableCaption`
- `apps/web/src/components/ui/textarea.tsx` -- `TextareaProps`
- `apps/web/src/components/where-used/index.ts` -- `WhereUsedTab`
- `apps/web/src/components/where-used/where-used-tab.tsx` -- `WhereUsedTab`
- `apps/web/src/components/work-item/work-item-detail-layout.tsx` -- `WorkItemDetailLayout`
- `apps/web/src/hooks/use-content-language.ts` -- `useContentLanguage`
- `apps/web/src/hooks/use-grc-overlay.ts` -- `UseGrcOverlayResult`
- `apps/web/src/hooks/use-nav-preferences.tsx` -- `SidebarMode`, `NavPreferences`
- `apps/web/src/hooks/use-org-languages.ts` -- `useOrgLanguages`
- `apps/web/src/hooks/use-processes.ts` -- `useProcess`, `useProcessTree`, `useProcessVersions`
- `apps/web/src/i18n/request.ts` -- `mergeCommonNamespace`
- `apps/web/src/lib/api-client.ts` -- `FetchAllPagesOptions`
- `apps/web/src/lib/api-errors.ts` -- `ErrorType`, `ProblemDetails`, `normaliseErrorResponse`
- `apps/web/src/lib/api.ts` -- `checkCustomRoleModuleAccess`, `AuditAnnotation`, `sanitiseAuditReason`
- `apps/web/src/lib/audit-entry.ts` -- `AuditEntryInput`
- `apps/web/src/lib/audit-gates.ts` -- `AuditGateBlocker`
- `apps/web/src/lib/bpmn-arctos-rehydrate.ts` -- `RehydrationStats`, `ExportLinks`
- `apps/web/src/lib/bulk.ts` -- `BULK_MAX_ITEMS`, `BulkResult`, `BulkRequest`, `checkBulkCap`
- `apps/web/src/lib/cache-headers.ts` -- `withCacheHeaders`
- `apps/web/src/lib/cascade-runner.ts` -- `CascadeResult`
- `apps/web/src/lib/cci/data-collector.ts` -- `getOrgWeights`, `calcTaskCompliance`, `calcPolicyAckRate`, `calcTrainingCompletion`, `calcIncidentResponseData`, `calcFindingClosureRate`, `calcRCSAParticipation`, `getPreviousScore`, `calculateCCIForOrg`
- `apps/web/src/lib/document-versioning.ts` -- `DocumentFileSnapshot`, `CreateDocumentVersionParams`, `CreatedDocumentVersion`
- `apps/web/src/lib/documents/client-ip.ts` -- `ResolvedClientIp`, `trustedProxyHops`
- `apps/web/src/lib/documents/controlled-copy.ts` -- `ControlledCopyOutcome`, `ControlledCopyDownloadInfo`
- `apps/web/src/lib/documents/download-policy.ts` -- `WATERMARK_REQUIRED_STATUSES`, `CONTENT_MUTABLE_STATUSES`, `StoredIntegrity`
- `apps/web/src/lib/documents/extract-text.ts` -- `MAX_PDF_PAGES`
- `apps/web/src/lib/documents/pdf-watermark.ts` -- `WatermarkFailureReason`, `ControlledCopyInfo`, `StampabilityResult`
- `apps/web/src/lib/documents/signature-chain.ts` -- `sha256`, `SignaturePayloadV1`, `SignatureChainLink`, `SignatureLinkVerification`, `SignatureChainExpectation`, `SignatureChainDefect`, `SignatureChainVerification`
- `apps/web/src/lib/documents/signature-provider.ts` -- `SignatureRequestRow`, `SignatureRow`, `SignatureWorkflowErrorCode`, `SignatureWorkflowError`, `CreateSignatureRequestInput`, `SignatureActionInput`, `DeclineInput`, `SignResult`, `SignatureVerificationLink`, `FileIntegrityState`, `SignatureProvider`, `RecomputedFileHash`, `InHouseSignatureProvider`
- `apps/web/src/lib/documents/signature-timestamp.ts` -- `SignatureTimestamp`, `isSignatureTsaEnabled`
- `apps/web/src/lib/dpia-gates.ts` -- `DpiaGateBlocker`
- `apps/web/src/lib/entity-events.ts` -- `EntityEventParams`
- `apps/web/src/lib/export-audit.ts` -- `ExportType`, `ExportLogEntry`
- `apps/web/src/lib/feature-flags.ts` -- `BpmnEngine`, `BPMN_ENGINE_ENV_VAR`, `BPMN_ENGINE_PUBLIC_ENV_VAR`, `BPMN_ENGINE_QUERY_PARAM`, `BPMN_ENGINE_GLOBAL`, `isBpmnEngine`, `ResolveBpmnEngineOptions`, `bpmnEngine`
- `apps/web/src/lib/format-date.ts` -- `SupportedLocale`
- `apps/web/src/lib/generic-transitions.ts` -- `TransitionsResponse`
- `apps/web/src/lib/grc-overlay.ts` -- `ConformanceDeviationRow`, `BuildOverlayOptions`
- `apps/web/src/lib/import-export/column-mapper.ts` -- `ColumnMappingResult`, `getFieldDef`
- `apps/web/src/lib/import-export/export-engine.ts` -- `ExportResult`, `shouldRunInBackground`
- `apps/web/src/lib/import-export/file-parser.ts` -- `ParsedFileResult`
- `apps/web/src/lib/import-export/validation-engine.ts` -- `resolveFK`
- `apps/web/src/lib/isms/review-period.ts` -- `ReviewPeriodSource`, `ResolvedReviewPeriod`
- `apps/web/src/lib/legal.ts` -- `ImprintData`, `PrivacyData`
- `apps/web/src/lib/logger.ts` -- `__scrubForTest`
- `apps/web/src/lib/module-guard.ts` -- `RouteModuleScope`, `ROUTE_MODULE_REGISTRY`, `normalizeApiPath`, `requireModuleForRequest`, `MUTATING_ROLE_REGISTRY`, `PLATFORM_SCOPED_WRITE_PREFIXES`
- `apps/web/src/lib/module-handbook.ts` -- `HandbookSection`, `MODULE_HANDBOOKS`
- `apps/web/src/lib/pdf.ts` -- `PdfKpi`, `PdfRow`, `PdfTable`, `renderStructuredPdfBuffer`
- `apps/web/src/lib/playbook-engine.ts` -- `resolveRoleToUser`, `ActivationResult`
- `apps/web/src/lib/portal-auth.ts` -- `DdSessionRow`, `PortalSessionResult`, `ddTokenHash`
- `apps/web/src/lib/process-working-version.ts` -- `PromotedVersion`
- `apps/web/src/lib/programme/health.ts` -- `JourneyAggregates`, `loadStepAggregates`, `HealthRecomputeOutput`
- `apps/web/src/lib/programme/instantiate.ts` -- `InstantiateInput`, `InstantiateResult`
- `apps/web/src/lib/query-schema.ts` -- `QueryParseSuccess`, `QueryParseFailure`, `QueryParseResult`, `dateTimeQueryParam`
- `apps/web/src/lib/rate-limit.ts` -- `RateLimitOptions`, `RateLimitResult`, `__resetRateLimitState`, `rateLimitBucketCount`, `RateLimitPolicy`, `policyForPath`, `RequestLimitVerdict`
- `apps/web/src/lib/reporting/core.ts` -- `ReportFormat`
- `apps/web/src/lib/reporting/report-document-renderer.ts` -- `RenderReportDocumentOptions`
- `apps/web/src/lib/reports/erm-management-summary.tsx` -- `ERMManagementSummaryPDF`
- `apps/web/src/lib/request-context.ts` -- `RequestInfo`, `getRequestInfo`, `getRequestInfoFromRequest`
- `apps/web/src/lib/risk-acceptance-ui.ts` -- `AcceptanceExpiryState`, `AcceptanceListQueryOptions`, `AcceptanceApiErrorKey`, `AcceptanceApiErrorInfo`
- `apps/web/src/lib/sign-off-chain.ts` -- `sha256`, `ChainLink`, `ChainRow`
- `apps/web/src/lib/vendor-gates.ts` -- `VendorGateBlocker`
- `apps/web/src/middleware.ts` -- `config`
- `apps/worker/src/crons/process-mining-conformance.ts` -- `ModelledStep`, `ObservedTrace`, `ObservedTransition`, `TraceAnalysis`, `analyseTraces`
- `apps/worker/src/crons/signature-due-reminder.ts` -- `SignerSlot`, `selectReminderRecipients`
- `apps/worker/src/index.ts` -- `app`, `scheduler`
- `apps/worker/src/lib/db-role-guard.ts` -- `WorkerRoleVerdict`
- `apps/worker/src/lib/job-runtime.ts` -- `JobErrorContext`, `RunReport`, `JobLockBusy`, `withTransaction`
- `apps/worker/src/lib/notify.ts` -- `DedupeWindow`, `NotifyOptions`, `deriveDedupeKey`, `insertNotifications`
- `apps/worker/src/lib/org-context.ts` -- `withTransaction`
- `apps/worker/src/lib/recipients.ts` -- `ResolveOptions`, `resolveOrgRecipientsSql`
- `apps/worker/src/lib/scheduler.ts` -- `ParsedSchedule`, `cronMatches`, `RunStatus`, `SchedulerHandle`
- `apps/worker/src/webhooks/index.ts` -- `processWebhookDelivery`
- `apps/worker/src/webhooks/webhook-delivery.ts` -- `processWebhookDelivery`
- `packages/auth/src/anonymous-token.ts` -- `ResolvedInvitation`, `ResolvedScimToken`, `withAnonymousTokenContext`
- `packages/auth/src/cache/module-config-cache.ts` -- `get`, `invalidate`, `invalidateOrg`, `clearAll`
- `packages/auth/src/index.ts` -- `requireLineOfDefense`, `getRolesInOrg`, `isPublicExactOrUnder`, `containsPersonalData`, `BULK_EXPORT_MAX_ENTITY_TYPES`, `BULK_EXPORT_MAX_ROWS`, `PERSONAL_DATA_ENTITY_TYPES`
- `packages/auth/src/middleware/bulk-export-guard.ts` -- `PERSONAL_DATA_ENTITY_TYPES`, `BULK_EXPORT_MAX_ENTITY_TYPES`, `BULK_EXPORT_MAX_ROWS`, `BulkExportRequest`, `BulkExportDecision`, `containsPersonalData`
- `packages/auth/src/oidc/id-token-validator.ts` -- `IdTokenClaims`, `IdTokenValidationOptions`, `ALLOWED_ID_TOKEN_ALGORITHMS`, `decodeJwt`, `clearJwksCache`, `validateIdTokenClaims`
- `packages/auth/src/oidc/index.ts` -- `verifyPKCE`, `validateIdTokenClaims`, `clearJwksCache`, `ALLOWED_ID_TOKEN_ALGORITHMS`, `decodeJwt`
- `packages/auth/src/oidc/pkce.ts` -- `verifyPKCE`
- `packages/auth/src/oidc/token-exchange.ts` -- `TokenExchangeParams`
- `packages/auth/src/providers.ts` -- `pickAttributableOrgId`, `LOGIN_MAX_FAILED_ATTEMPTS`, `LOGIN_LOCKOUT_MINUTES`, `LoginLockState`, `LoginUserRow`, `loadRoles`, `extractRequestInfo`, `isAzureAdConfigured`
- `packages/auth/src/rbac.ts` -- `requireLineOfDefense`, `getRolesInOrg`, `HINSCHG_ISOLATED_ROLES`, `isPublicExactOrUnder`
- `packages/auth/src/saml/index.ts` -- `parseSAMLMetadata`, `encodeAuthnRequestForRedirect`, `validateSAMLSignature`, `cleanupAssertionCache`, `rejectXXE`, `assertIdpCertificateUsable`, `IDP_CERT_EXPIRY_WARNING_DAYS`
- `packages/auth/src/saml/metadata-parser.ts` -- `parseSAMLMetadata`
- `packages/auth/src/saml/request-builder.ts` -- `AuthnRequestOptions`, `encodeAuthnRequestForRedirect`
- `packages/auth/src/saml/response-validator.ts` -- `cleanupAssertionCache`, `rejectXXE`, `IDP_CERT_EXPIRY_WARNING_DAYS`, `IdpCertificateInfo`, `assertIdpCertificateUsable`, `SamlSignatureScope`, `VerifiedSamlResponse`, `validateSAMLSignature`
- `packages/auth/src/scim/filter-parser.ts` -- `ScimFilter`, `mapScimAttributeToColumn`, `buildFilterClause`
- `packages/auth/src/scim/index.ts` -- `tokenHashesEqual`, `mapScimAttributeToColumn`, `buildFilterClause`
- `packages/auth/src/scim/token-auth.ts` -- `ScimAuthContext`, `tokenHashesEqual`
- `packages/auth/src/scim/user-mapper.ts` -- `ArctosUserData`
- `packages/automation/src/action-executor.ts` -- `ActionContext`
- `packages/automation/src/condition-evaluator.ts` -- `ConditionTraceEntry`
- `packages/automation/src/entity-fields.ts` -- `getEntityFields`
- `packages/automation/src/index.ts` -- `getEntityFields`
- `packages/automation/src/rule-engine.ts` -- `AutomationEngineOptions`
- `packages/db/src/index.ts` -- `RuntimeRoleCheck`, `assertRuntimeRoleIsolation`, `client`, `reserveRequestContext`, `releaseRequestContext`, `getRequestStore`
- `packages/db/src/migrate-all.ts` -- `splitStatements`, `MigrationMode`, `classify`, `migrationOrder`, `checksum`
- `packages/db/src/programme-soa-sync.ts` -- `SoaSyncResult`
- `packages/db/src/request-context.ts` -- `RequestContextInput`, `getRequestStore`, `reserveRequestContext`, `releaseRequestContext`
- `packages/db/src/rls-audit.ts` -- `RlsScope`, `RlsStatus`, `RlsTableStatus`, `RlsAuditReport`, `TENANT_TABLE_RLS_EXCEPTIONS`
- `packages/db/src/schema/abac.ts` -- `abacPolicyRelations`, `simulationScenarioRelations`, `simulationActivityParamRelations`, `processSimulationResultRelations`, `dmnDecisionRelations`
- `packages/db/src/schema/academy.ts` -- `academyCourseTypeEnum`, `academyEnrollmentStatusEnum`, `academyLessonTypeEnum`
- `packages/db/src/schema/agents.ts` -- `agentRegistrationRelations`, `agentExecutionLogRelations`, `agentRecommendationRelations`
- `packages/db/src/schema/ai-act-extended.ts` -- `aiAuthorityCommunication`, `aiPenalty`
- `packages/db/src/schema/ai-act.ts` -- `aiSystemRelations`, `aiConformityAssessmentRelations`, `aiHumanOversightLogRelations`, `aiTransparencyEntryRelations`, `aiFriaRelations`, `aiFrameworkMappingRelations`
- `packages/db/src/schema/approval-workflow.ts` -- `approvalWorkflow`, `approvalRequest`, `approvalDecision`, `reviewCycle`, `reviewDecision`, `attestationCampaign`, `attestationResponse`
- `packages/db/src/schema/asset.ts` -- `assetTierEnum`, `assetCiaProfile`
- `packages/db/src/schema/audit-advanced.ts` -- `auditWpReviewNote`, `auditWpReviewNoteReply`, `auditTimeEntry`, `externalAuditorActivity`
- `packages/db/src/schema/audit-chain.ts` -- `auditAnchorSeal`, `auditChainVerification`, `auditSensitiveColumn`, `auditLogWriteAttempt`
- `packages/db/src/schema/audit-extras.ts` -- `auditSample`, `boardReport`, `exceptionReport`
- `packages/db/src/schema/audit-mgmt.ts` -- `auditTypeEnum`, `auditStatusEnum`, `auditPlanStatusEnum`, `checklistResultEnum`, `auditMethodValues`, `AuditMethodValue`, `auditRiskRatingValues`, `AuditRiskRatingValue`, `auditConclusionEnum`, `universeEntityTypeEnum`, `checklistSourceTypeEnum`, `auditEvidence`
- `packages/db/src/schema/bcms-advanced.ts` -- `bcExerciseTypeEnum`, `crisisCommunicationLog`, `bcExerciseScenario`, `bcExerciseInjectLog`, `crisisContactTreeRelations`, `crisisContactNodeRelations`, `bcExerciseInjectLogRelations`, `bcExerciseLessonRelations`, `recoveryProcedureRelations`, `recoveryProcedureStepRelations`, `resilienceScoreSnapshotRelations`
- `packages/db/src/schema/bcms.ts` -- `biaStatusEnum`, `bcpStatusEnum`, `crisisSeverityEnum`, `crisisStatusEnum`, `exerciseTypeEnum`, `exerciseStatusEnum`, `strategyTypeEnum`, `resourceTypeEnum`, `biaProcessImpactRelations`
- `packages/db/src/schema/benchmarking.ts` -- `maturityLevelEnum`, `maturityModuleKeyEnum`, `maturityAssessmentStatusEnum`, `roadmapItemStatusEnum`, `roadmapItemPriorityEnum`, `benchmarkIndustryEnum`
- `packages/db/src/schema/bi-reporting.ts` -- `biReportStatusEnum`, `biWidgetTypeEnum`, `biDataSourceTypeEnum`, `biQueryStatusEnum`, `biShareAccessEnum`, `biScheduleFrequencyEnum`, `biExecutionStatusEnum`, `biOutputFormatEnum`
- `packages/db/src/schema/bpm-advanced.ts` -- `processMiningSuggestion`
- `packages/db/src/schema/branding.ts` -- `reportTemplateEnum`, `orgBrandingRelations`, `userDashboardLayoutRelations`
- `packages/db/src/schema/budget.ts` -- `budgetStatusEnum`, `budgetTypeEnum`, `costTypeEnum`, `roiMethodEnum`
- `packages/db/src/schema/calendar.ts` -- `calendarEventTypeEnum`, `calendarRecurrenceEnum`
- `packages/db/src/schema/catalog.ts` -- `catalogObjectTypeEnum`, `riskCatalog`, `riskCatalogEntry`, `orgCatalogExclusion`
- `packages/db/src/schema/cert-wizard.ts` -- `certReadinessAssessmentRelations`, `certEvidencePackageRelations`, `certMockAuditRelations`
- `packages/db/src/schema/checklist.ts` -- `checklistTemplate`, `checklistInstance`
- `packages/db/src/schema/community.ts` -- `editionTypeEnum`, `contributionStatusEnum`, `contributionTypeEnum`
- `packages/db/src/schema/connector.ts` -- `connectorTypeDefinition`, `connectorFieldMapping`, `connectorSyncLog`
- `packages/db/src/schema/content-narrative.ts` -- `contentPlaceholder`, `contentRequest`, `narrativeTemplate`, `narrativeInstance`
- `packages/db/src/schema/control-embedding.ts` -- `CONTROL_EMBEDDING_DIMENSION`
- `packages/db/src/schema/control-monitoring.ts` -- `controlMonitoringRule`, `controlMonitoringResult`
- `packages/db/src/schema/control-testing-agent.ts` -- `controlTestScriptRelations`, `controlTestExecutionRelations`, `controlTestChecklistRelations`, `controlTestLearningRelations`
- `packages/db/src/schema/control.ts` -- `controlStatusEnum`, `testTypeEnum`, `testResultEnum`, `testStatusEnum`, `campaignStatusEnum`, `findingStatusEnum`, `evidenceCategoryEnum`
- `packages/db/src/schema/copilot-chat.ts` -- `copilotConversationRelations`, `copilotMessageRelations`, `copilotPromptTemplateRelations`, `copilotRagSourceRelations`, `copilotSuggestedActionRelations`, `copilotFeedbackRelations`
- `packages/db/src/schema/dashboard.ts` -- `widgetDefinitionRelations`, `customDashboardRelations`, `customDashboardWidgetRelations`
- `packages/db/src/schema/data-governance.ts` -- `dataLineageSource`, `dataLineageEntry`, `dataLink`, `dataValidationRule`, `dataValidationResult`
- `packages/db/src/schema/data-sovereignty.ts` -- `dataRegionCodeEnum`, `regionStatusEnum`, `residencyRuleTypeEnum`, `replicationStatusEnum`, `sovereigntyEventTypeEnum`, `complianceFrameworkTagEnum`
- `packages/db/src/schema/document-signature.ts` -- `documentSignatureRequestStatusEnum`, `documentSignatureStatusEnum`
- `packages/db/src/schema/document.ts` -- `documentCategoryEnum`, `documentStatusEnum`, `documentApprovalStepTypeEnum`, `documentApprovalStepStatusEnum`, `documentApprovalDecisionEnum`, `retentionBasisEnum`
- `packages/db/src/schema/dora.ts` -- `doraIctRiskRelations`, `doraTlptPlanRelations`, `doraIctIncidentRelations`, `doraIctProviderRelations`, `doraInformationSharingRelations`, `doraNis2CrossRefRelations`
- `packages/db/src/schema/dpms-advanced.ts` -- `transferImpactAssessment`, `subProcessorNotification`, `retentionScheduleRelations`, `retentionExceptionRelations`, `deletionRequestRelations`, `transferImpactAssessmentRelations`, `processorAgreementRelations`, `subProcessorNotificationRelations`, `pbdAssessmentRelations`, `consentTypeRelations`, `consentRecordRelations`
- `packages/db/src/schema/dpms.ts` -- `ropaStatusEnum`, `dpiaStatusEnum`, `dsrTypeEnum`, `dsrStatusEnum`, `breachSeverityEnum`, `breachStatusEnum`, `tiaLegalBasisEnum`, `tiaRiskRatingEnum`
- `packages/db/src/schema/eam-advanced.ts` -- `dataFlowRelations`, `applicationInterfaceRelations`, `technologyEntryRelations`, `technologyApplicationLinkRelations`, `architectureChangeRequestRelations`, `architectureChangeVoteRelations`, `architectureHealthSnapshotRelations`
- `packages/db/src/schema/eam-ai.ts` -- `eamAiConfigRelations`, `eamAiPromptTemplateRelations`, `eamAiSuggestionLogRelations`, `eamTranslationRelations`, `eamChatSessionRelations`, `eamObjectSuggestionRelations`
- `packages/db/src/schema/eam-catalog.ts` -- `eamKeywordRelations`, `eamHomepageLayoutRelations`
- `packages/db/src/schema/eam-dashboards.ts` -- `applicationAssessmentHistoryRelations`
- `packages/db/src/schema/eam-data-architecture.ts` -- `eamDataObjectRelations`, `eamDataObjectCrudRelations`, `eamContextRelations`, `eamContextAttributeRelations`, `eamOrgUnitRelations`, `eamBusinessContextRelations`
- `packages/db/src/schema/eam-governance.ts` -- `eamGovernanceLogRelations`, `eamBpmnElementPlacementRelations`
- `packages/db/src/schema/eam.ts` -- `architectureLayerEnum`, `architectureTypeEnum`, `archRelationshipTypeEnum`, `architectureElementRelations`, `architectureRelationshipRelations`, `businessCapabilityRelations`, `applicationPortfolioRelations`, `architectureRuleRelations`, `architectureRuleViolationRelations`
- `packages/db/src/schema/erm-advanced.ts` -- `bowtieElementTypeEnum`, `treatmentMilestone`, `riskEventLesson`, `bowtieTemplate`, `bowtieElementRelations`, `treatmentMilestoneRelations`, `riskInterconnectionRelations`, `emergingRiskRelations`, `riskEventRelations`, `riskEventLessonRelations`
- `packages/db/src/schema/esef-xbrl.ts` -- `xbrlTaxonomy`, `xbrlTag`, `xbrlTaggingInstance`, `esefFiling`, `consolidationGroup`, `consolidationEntry`, `euTaxonomyAssessment`
- `packages/db/src/schema/esg-advanced.ts` -- `materialityIro`, `materialityStakeholderEngagement`, `emissionActivityData`, `emissionFactor`, `supplierEsgAssessment`, `supplierEsgCorrectiveAction`, `lksgDueDiligence`, `esrsDisclosureTemplate`, `climateRiskScenario`
- `packages/db/src/schema/esg.ts` -- `materialityStatusEnum`, `dataQualityEnum`, `targetTypeEnum`, `targetStatusEnum`, `reportStatusEnum`, `esgFrequencyEnum`, `esgControlLink`
- `packages/db/src/schema/evidence-review.ts` -- `evidenceReviewJobRelations`, `evidenceReviewResultRelations`, `evidenceReviewGapRelations`
- `packages/db/src/schema/fair.ts` -- `riskMethodologyEnum`, `fairSimulationStatusEnum`
- `packages/db/src/schema/horizon-scanner.ts` -- `horizonScanSourceRelations`, `horizonScanItemRelations`, `horizonImpactAssessmentRelations`, `horizonCalendarEventRelations`
- `packages/db/src/schema/ics-advanced.ts` -- `soxScope`, `ccmConnectorRelations`, `ccmEvidenceRelations`, `soxScopeRelations`, `soxWalkthroughRelations`, `controlDeficiencyRelations`
- `packages/db/src/schema/identity.ts` -- `ssoProviderTypeEnum`, `identityProviderEnum`, `scimSyncActionEnum`, `scimSyncStatusEnum`
- `packages/db/src/schema/isms-cap.ts` -- `rootCauseAnalysis`
- `packages/db/src/schema/isms.ts` -- `protectionLevelEnum`, `assetClassificationOverrideStatusEnum`, `assessmentScopeTypeEnum`
- `packages/db/src/schema/marketplace.ts` -- `marketplaceCategoryTypeEnum`, `marketplaceListingStatusEnum`, `marketplaceVersionStatusEnum`, `marketplaceScanStatusEnum`
- `packages/db/src/schema/mobile.ts` -- `mobileSession`
- `packages/db/src/schema/module.ts` -- `moduleUiStatusEnum`
- `packages/db/src/schema/nav-preference.ts` -- `userNavPreference`
- `packages/db/src/schema/nis2-certification.ts` -- `nis2ReportTypeEnum`, `nis2ReportStatusEnum`
- `packages/db/src/schema/phase3-extras.ts` -- `mappingRelationshipEnum`, `mappingSourceEnum`, `catalogEntryMapping`, `evidenceRequest`, `inlineComment`, `messagingIntegration`, `moduleNavItem`, `reminderRule`, `soxScoping`, `tagDefinition`
- `packages/db/src/schema/platform-advanced.ts` -- `customFieldTypeEnum`, `notificationPreference`, `searchIndex`, `customFieldDefinitionRelations`, `notificationPreferenceRelations`, `searchIndexRelations`
- `packages/db/src/schema/platform.ts` -- `orgTypeEnum`, `lineOfDefenseEnum`, `auditActionEnum`, `accessEventTypeEnum`, `authMethodEnum`, `exportTypeEnum`, `notificationTypeEnum`, `notificationChannelEnum`, `invitationStatusEnum`, `account`, `session`, `verificationToken`, `platformAdmin`, `samlAssertionReplay`
- `packages/db/src/schema/playbook.ts` -- `playbookTriggerCategoryEnum`, `playbookTriggerSeverityEnum`, `playbookActivationStatusEnum`, `playbookTemplateRelations`, `playbookPhaseRelations`, `playbookTaskTemplateRelations`, `playbookActivationRelations`
- `packages/db/src/schema/predictive-risk.ts` -- `riskPredictionModelRelations`, `riskPredictionRelations`, `riskAnomalyDetectionRelations`
- `packages/db/src/schema/process-approval.ts` -- `processApprovalStepTypeEnum`, `processApprovalStepStatusEnum`
- `packages/db/src/schema/process-diagram-grc.ts` -- `processStepRopa`, `processStepDataCategory`, `processStepRecipient`, `processStepDocument`, `processEventActivityMap`, `userDiagramPreference`
- `packages/db/src/schema/process.ts` -- `processNotationEnum`, `processStatusEnum`, `stepTypeEnum`, `lodEnum`, `processVersionTypeEnum`, `processMapCategoryEnum`, `complianceProfileEnum`
- `packages/db/src/schema/programme.ts` -- `msTypeEnum`, `pdcaPhaseEnum`, `programmeJourneyStatusEnum`, `programmeStepStatusEnum`, `programmeApprovalStatusEnum`, `programmeSubtaskStatusEnum`, `programmeLinkKindEnum`, `programmeLinkTypeEnum`, `ProgrammeTemplate`, `ProgrammeTemplateInsert`, `ProgrammeTemplatePhase`, `ProgrammeTemplatePhaseInsert`, `ProgrammeTemplateStep`, `ProgrammeTemplateStepInsert`, `ProgrammeJourney`, `ProgrammeJourneyPhase`, `ProgrammeJourneyPhaseInsert`, `ProgrammeJourneyStep`, `ProgrammeJourneyStepInsert`, `ProgrammeJourneyEvent`, `ProgrammeJourneyEventInsert`, `ProgrammeTemplateSubtask`, `ProgrammeTemplateSubtaskInsert`, `ProgrammeJourneySubtask`, `ProgrammeJourneySubtaskInsert`, `ProgrammeStepLink`, `ProgrammeStepLinkInsert`, `ProgrammeApprovalEvent`, `ProgrammeApprovalEventInsert`, `PROGRAMME_APPROVAL_STATUS_VALUES`, `ProgrammeApprovalStatus`, `ProgrammeSubtaskStatus`, `ProgrammeLinkKind`, `ProgrammeLinkType`, `PDCA_PHASE_VALUES`, `PROGRAMME_JOURNEY_STATUS_VALUES`, `PROGRAMME_STEP_STATUS_VALUES`
- `packages/db/src/schema/rcsa.ts` -- `rcsaCampaignRelations`, `rcsaAssignmentRelations`, `rcsaResponseRelations`, `rcsaResultRelations`
- `packages/db/src/schema/regulatory-change.ts` -- `regulatorySourceRelations`, `regulatoryChangeRelations`, `regulatoryImpactAssessmentRelations`, `regulatoryCalendarEventRelations`, `regulatoryDigestRelations`
- `packages/db/src/schema/reporting.ts` -- `reportModuleScopeEnum`, `reportGenerationStatusEnum`, `reportOutputFormatEnum`, `reportSectionTypeEnum`, `threatFeedTypeEnum`
- `packages/db/src/schema/risk-acceptance.ts` -- `ermSyncConfig`
- `packages/db/src/schema/risk-quantification.ts` -- `rqMethodologyEnum`, `rqCalculationStatusEnum`, `rqAppetiteStatusEnum`, `rqSummaryStatusEnum`
- `packages/db/src/schema/risk.ts` -- `treatmentStatusEnum`, `kriAlertStatusEnum`, `kriTrendEnum`, `kriDirectionEnum`, `kriMeasurementFrequencyEnum`, `kriMeasurementSourceEnum`, `simulationResult`
- `packages/db/src/schema/role-dashboards.ts` -- `roleDashboardTypeEnum`, `roleDashboardWidgetCategoryEnum`
- `packages/db/src/schema/simulation.ts` -- `simulationTypeEnum`, `simulationStatusEnum`, `simulationScenarioTagEnum`
- `packages/db/src/schema/stakeholder-portal.ts` -- `portalTypeEnum`, `portalSessionStatusEnum`, `portalQuestionnaireStatusEnum`
- `packages/db/src/schema/stakeholder-register.ts` -- `stakeholderTypeEnum`, `stakeholderInfluenceEnum`, `stakeholderInterestEnum`, `stakeholderEngagementStrategyEnum`, `stakeholder`, `stakeholderExpectation`, `Stakeholder`, `StakeholderInsert`, `StakeholderExpectation`, `StakeholderExpectationInsert`, `recommendEngagementStrategy`, `STAKEHOLDER_EXPECTATION_STATUSES`, `STAKEHOLDER_EXPECTATION_TRANSITIONS`
- `packages/db/src/schema/supplier-portal.ts` -- `questionnaireTemplateStatusEnum`, `questionTypeEnum`, `ddSessionStatusEnum`
- `packages/db/src/schema/task.ts` -- `taskStatusEnum`, `taskPriorityEnum`
- `packages/db/src/schema/tax-cms.ts` -- `taxCmsElementRelations`, `taxRiskRelations`, `taxGobdArchiveRelations`, `taxIcfrControlRelations`, `taxAuditPrepRelations`
- `packages/db/src/schema/tprm-advanced.ts` -- `vendorScorecardHistory`
- `packages/db/src/schema/tprm.ts` -- `vendorStatusEnum`, `vendorTierEnum`, `vendorCategoryEnum`, `ddStatusEnum`, `contractStatusEnum`, `contractTypeEnum`, `obligationStatusEnum`, `obligationTypeEnum`, `vendorDueDiligenceQuestion`
- `packages/db/src/schema/translation.ts` -- `translationStatusValueEnum`, `translationMethodEnum`
- `packages/db/src/schema/whistleblowing-advanced.ts` -- `wbEvidence`, `wbInterview`, `wbOmbudspersonActivity`
- `packages/db/src/schema/whistleblowing.ts` -- `wbCategoryEnum`, `wbCaseStatusEnum`, `wbPriorityEnum`, `wbResolutionCategoryEnum`
- `packages/db/src/schema/work-item.ts` -- `workItemStatusGenericEnum`
- `packages/db/src/seed-demo.ts` -- `demoSeedFiles`
- `packages/db/src/seed-e2e-users.ts` -- `DEMO_TENANT_ORG_ID`, `E2E_MEMBERSHIP_EPOCH`, `E2eRoleAccount`, `E2E_ROLE_ACCOUNTS`
- `packages/db/src/seeds/cis-controls-templates.ts` -- `CIS_IG1_TEMPLATE`, `CIS_IG2_TEMPLATE`, `CIS_IG3_TEMPLATE`
- `packages/db/src/seeds/erm-dashboards.ts` -- `seedERMDashboards`
- `packages/db/src/seeds/isms-bcm-dashboards.ts` -- `seedISMSBCMDashboards`
- `packages/db/src/seeds/programme-templates.ts` -- `PROGRAMME_TEMPLATE_SEEDS`, `ProgrammeSeedResult`
- `packages/db/src/sql-result.ts` -- `SqlExecuteResult`, `rowCount`
- `packages/events/src/index.ts` -- `formatSlackPayload`, `formatTeamsPayload`, `hashSecret`, `verifySignature`, `enqueueWebhookDelivery`, `sanitizeWebhookData`
- `packages/events/src/webhook-enqueue.ts` -- `sanitizeWebhookData`, `enqueueWebhookDelivery`, `__resetWebhookEnqueueRegistration`
- `packages/events/src/webhook-formatter.ts` -- `formatSlackPayload`, `formatTeamsPayload`
- `packages/events/src/webhook-signer.ts` -- `hashSecret`, `verifySignature`
- `packages/shared/src/bpmn-validator.ts` -- `ValidationRuleLevel`, `BpmnValidationConfig`, `DEFAULT_VALIDATION_CONFIG`
- `packages/shared/src/cache/dashboard-cache.ts` -- `CacheAdapter`, `CacheMetrics`, `DashboardCache`
- `packages/shared/src/cache/index.ts` -- `DashboardCache`
- `packages/shared/src/cascades/bia-asset-criticality.ts` -- `BiaImpactInput`, `ProcessAssetLink`, `DerivedAssetClassification`, `priorityToProtectionLevel`
- `packages/shared/src/cci/calculator.ts` -- `normalizeFactor`, `normalizeFactors`, `detectTrend`, `validateWeights`
- `packages/shared/src/cci/index.ts` -- `normalizeFactor`, `normalizeFactors`, `detectTrend`, `validateWeights`
- `packages/shared/src/color-utils.ts` -- `HslColor`, `hexToHsl`, `hslToHex`, `getContrastRatio`
- `packages/shared/src/control-embedding.ts` -- `embeddingNeedsRefresh`
- `packages/shared/src/cpe-matcher.ts` -- `ParsedCpe`, `parseCpe`, `cpeMatchesSingle`, `sanitizeForPrompt`
- `packages/shared/src/dd-token.ts` -- `computeScore`
- `packages/shared/src/document-control.ts` -- `DocumentVersionNumbers`, `EffectiveDatedVersion`, `FourEyesCheckInput`, `FourEyesCheckResult`, `DOCUMENT_REVIEW_REMINDER_STAGES`, `SIGNATURE_DUE_REMINDER_STAGES`, `signatureDueReminderStage`, `SIGNATURE_ESCALATION_GRACE_MS`, `RetentionBasis`, `RetentionPurgeCandidate`
- `packages/shared/src/env-key.ts` -- `AesGcmCiphertext`, `aesGcmDecrypt`
- `packages/shared/src/esg-calculations.ts` -- `MaterialityTopicInput`, `MaterialityTopicResult`, `calculateEmissions`, `TargetProgressResult`
- `packages/shared/src/fair-simulation.ts` -- `FAIRInput`, `FAIRResult`, `DistributionBucket`, `runFAIRSimulation`
- `packages/shared/src/index.ts` -- `aesGcmDecrypt`, `normalizeNumericIPv4`, `webhookUrlRefine`, `webhookUrlRefineMessage`, `inspectZipArchive`, `SPREADSHEET_ZIP_LIMITS`, `sniffFileType`, `MAGIC_BYTE_SIGNATURES`, `ALLOWED_TRANSITIONS`, `phaseForStatus`, `validateGate1Setup`, `validateBiaTransition`, `BCP_ALLOWED_TRANSITIONS`, `CRISIS_ALLOWED_TRANSITIONS`, `validateCrisisGate9Activate`, `validateCrisisGate10Resolve`, `CA_STATUSES`, `CA_ALLOWED_TRANSITIONS`, `isNcStatus`, `isCaStatus`, `validateCaTransition`, `RISK_STATUSES`, `RISK_TRANSITIONS_REQUIRING_REASON`, `RISK_ACCEPTANCE_ALLOWED_TRANSITIONS`, `canAcceptWithRoles`, `PROGRAMME_JOURNEY_TRANSITIONS`, `isProgrammeJourneyStatus`, `PROGRAMME_STEP_TRANSITIONS`, `isProgrammeStepStatus`, `ROPA_ALLOWED_TRANSITIONS`, `validateRopaGate1Activate`, `validateDpiaGate3Start`, `validateDpiaGate3Complete`, `validateDpiaGate3Approve`, `DSR_ALLOWED_TRANSITIONS`, `validateDsrGate6Verify`, `validateDsrGate7Response`, `validateDsrGate8Close`, `BREACH_ALLOWED_TRANSITIONS`, `validateBreachGate9Assess`, `validateBreachGate10NotifyDpa`, `validateBreachGate11NotifyIndividuals`, `validateBreachGate12Close`, `validateTiaQuality`, `assessTransferRisk`, `ADEQUACY_COUNTRIES`, `decideRetention`, `validateConsentType`, `isConsentStillValid`, `AVV_ALLOWED_TRANSITIONS`, `validateAvvGateActivate`, `validateAvvTransition`, `checkAvvReviewStatus`, `countProhibitedPractices`, `countCompletedProcedures`, `computeQmsMaturity`, `assessAiRiskPortfolio`, `mapDpiaRiskToErm`, `mapFriaRightToErm`, `mapAiIncidentToErm`, `decideRiskSync`, `computeIsmsHealth`, `computeBcmsHealth`, `computeDpmsHealth`, `computeAiActHealth`, `DashboardCache`, `runFAIRSimulation`, `buildHistogram`, `buildExceedanceCurve`, `distributeLossComponents`
- `packages/shared/src/lib/asn1-der.ts` -- `encodeNull`, `encodeOid`
- `packages/shared/src/lib/bpmn-extract.ts` -- `BPMN_MODEL_NS`, `ExtractedLane`, `ExtractedNode`, `ExtractedFlow`, `ExtractedMessageFlow`, `ExtractedBpmn`
- `packages/shared/src/lib/clamav.ts` -- `ClamScanStatus`, `ClamdSocketLike`, `ClamScanOptions`, `isClamAvConfigured`, `parseClamdResponse`
- `packages/shared/src/lib/damage-index.ts` -- `computeDamageIndex`, `getDamageIndexSeverity`, `getDamageIndexColor`
- `packages/shared/src/lib/evaluation-phase-engine.ts` -- `PhaseTransitionRule`, `PhaseTransitionResult`, `getPhaseIndex`, `isPhaseCompleted`, `getValidTransitions`, `getAllPhases`
- `packages/shared/src/lib/file-signature.ts` -- `MagicSignature`, `MAGIC_BYTE_SIGNATURES`, `ALWAYS_FORBIDDEN_MIMES`, `SniffedFileType`, `sniffFileType`, `looksLikeText`, `UploadSignatureResult`, `VerifyUploadOptions`
- `packages/shared/src/lib/file-storage.ts` -- `FileStorageMeta`, `FileStorage`, `LocalFsStorage`, `S3StorageConfig`, `S3Storage`, `defaultUploadDir`, `__resetFileStorageCache`, `CrossTenantStorageKeyError`, `storageKeyOrgPrefix`, `assertKeyBelongsToOrg`
- `packages/shared/src/lib/framework-test-plans.ts` -- `TestPlanStep`, `TestPlanTemplate`, `getTestPlanTemplate`
- `packages/shared/src/lib/freetsa.ts` -- `TimestampRequestResult`, `FreeTsaOptions`, `TimestampValidationError`, `buildTimestampRequest`, `parseTimestampResponse`
- `packages/shared/src/lib/merkle-tree.ts` -- `MerkleProof`, `MERKLE_VERSION_LEGACY`, `merkleRootVersioned`, `merkleRoot`, `merkleProof`, `verifyMerkleProof`, `rootOfRawValues`, `merkleProofV2`, `verifyMerkleProofV2`
- `packages/shared/src/lib/opentimestamps-upgrade.ts` -- `UpgradeResult`
- `packages/shared/src/lib/opentimestamps.ts` -- `OtsSubmitResult`, `submitToCalendar`, `submitToAnyCalendar`, `buildOtsFile`
- `packages/shared/src/lib/sigv4.ts` -- `encodeRfc3986`, `encodeCanonicalPath`, `toAmzDate`, `deriveSigningKey`, `SigV4Input`, `SigV4Result`
- `packages/shared/src/lib/url-safety-server.ts` -- `SafeFetchOptions`, `SsrfBlockedError`
- `packages/shared/src/lib/zip-safety.ts` -- `ZipEntryInfo`, `ZipInspection`, `ZipLimits`, `SPREADSHEET_ZIP_LIMITS`, `inspectZipArchive`
- `packages/shared/src/logger.ts` -- `LogLevel`, `LogFields`, `REDACTED`, `Logger`, `__scrubForTest`
- `packages/shared/src/maturity/cmmi.ts` -- `MaturitySource`, `MIN_SAMPLES_PER_SOURCE`, `DEFAULT_WEIGHTS`, `Confidence`, `MaturityResult`
- `packages/shared/src/modules.ts` -- `ModuleDefinition`
- `packages/shared/src/nis2-compliance.ts` -- `NIS2RequirementResult`, `NIS2OverallScore`, `CertReadinessResult`, `computeRequirementStatus`, `findMissingControls`
- `packages/shared/src/process-approval.ts` -- `ApprovalStepType`, `ApprovalStepStatus`, `ApprovalDecision`, `APPROVAL_STEP_STATUS_TRANSITIONS`, `isValidApprovalStepTransition`, `approvalDecisionRequiresComment`, `ApprovalSoDContext`, `approvalConflictActors`, `violatesApprovalSeparationOfDuties`, `ApprovalChainOutcome`
- `packages/shared/src/schemas/abac.ts` -- `abacConditionSchema`, `simulationResourceSchema`, `createAbacSimulationScenarioSchema`, `updateAbacSimulationScenarioSchema`, `simulationActivityParamSchema`, `dmnColumnSchema`
- `packages/shared/src/schemas/academy.ts` -- `academyCourseTypeValues`, `academyEnrollmentStatusValues`, `academyLessonTypeValues`, `CreateAcademyCourseInput`, `CreateAcademyLessonInput`, `CreateAcademyEnrollmentInput`, `BulkEnrollInput`, `SubmitQuizAttemptInput`
- `packages/shared/src/schemas/agents.ts` -- `agentConfigSchema`, `agentRunOptionsSchema`, `agentDefaultConfigs`
- `packages/shared/src/schemas/ai-act.ts` -- `updateAiAuthorityCommunicationSchema`
- `packages/shared/src/schemas/ai-assist.ts` -- `AiDraftPolicyRequest`, `AiSuggestControlsRequest`, `AiExplainGapRequest`, `AiPolicyDraftResponse`, `aiControlSuggestionSchema`, `AiControlSuggestion`, `AiControlSuggestionsResponse`, `AiGapExplanationResponse`
- `packages/shared/src/schemas/api-platform.ts` -- `revokeApiKeySchema`, `CreateApiKeyInput`, `UpdateApiKeyInput`, `CreateDeveloperAppInput`, `UpdateDeveloperAppInput`, `CreatePlaygroundSnippetInput`, `UpdatePlaygroundSnippetInput`, `ApiUsageQuery`
- `packages/shared/src/schemas/assets.ts` -- `createWorkItemLinkSchema`
- `packages/shared/src/schemas/audit-advanced.ts` -- `createWpFolderSchema`, `updateWpFolderSchema`, `updateWorkingPaperSchema`, `WP_STATUS_TRANSITIONS`, `isValidWpTransition`, `wpTransitionSchema`, `createReviewNoteSchema`, `resolveReviewNoteSchema`, `createReviewNoteReplySchema`, `updateAuditorProfileSchema`, `createResourceAllocationSchema`, `updateResourceAllocationSchema`, `createAuditTimeEntrySchema`, `updateContinuousAuditRuleSchema`, `acknowledgeExceptionSchema`, `falsePositiveExceptionSchema`, `updateQaChecklistSchema`, `computeQaScore`, `createExternalShareSchema`, `CUSTOM_SQL_MAX_LENGTH`, `CustomSqlValidation`
- `packages/shared/src/schemas/audit-analytics.ts` -- `analysisTypeValues`, `samplingMethodValues`, `outlierMethodValues`, `trainAuditAnalyticsModelSchema`
- `packages/shared/src/schemas/audit.ts` -- `checklistResultValues`, `ChecklistResultValue`, `auditMethodValues`, `AuditMethodValue`, `auditRiskRatingValues`, `AuditRiskRatingValue`, `methodEntryInterviewSchema`, `methodEntryDocumentReviewSchema`, `methodEntryObservationSchema`, `methodEntryWalkthroughSchema`, `methodEntryTechnicalTestSchema`, `methodEntrySamplingSchema`, `methodEntryReperformanceSchema`, `methodEntrySchema`, `MethodEntryFromSchema`, `EvaluateChecklistItemInput`
- `packages/shared/src/schemas/automation.ts` -- `automationTriggerTypeValues`, `automationActionTypeValues`, `conditionOperatorValues`, `conditionComparisonOpValues`, `automationExecutionStatusValues`, `automationTemplateCategoryValues`, `automationTriggerConfigSchema`, `conditionGroupSchema`, `createTaskActionConfigSchema`, `sendNotificationActionConfigSchema`, `sendEmailActionConfigSchema`, `changeStatusActionConfigSchema`, `escalateActionConfigSchema`, `triggerWebhookActionConfigSchema`, `automationActionSchema`, `automationTriggerTypeValues`, `automationActionTypeValues`, `automationTemplateCategoryValues`
- `packages/shared/src/schemas/bcms-advanced.ts` -- `triggerNotificationSchema`, `createExerciseSchema`, `logInjectResponseSchema`, `completeStepSchema`, `ResilienceScoreFactors`, `DEFAULT_RESILIENCE_WEIGHTS`, `computeExerciseScore`, `simulateScenarioSchema`
- `packages/shared/src/schemas/bcms.ts` -- `biaStatusTransitions`, `activateCrisisSchema`
- `packages/shared/src/schemas/benchmarking.ts` -- `maturityLevelValues`, `maturityModuleKeyValues`, `maturityAssessmentStatusValues`, `roadmapItemStatusValues`, `roadmapItemPriorityValues`, `benchmarkIndustryValues`, `CreateMaturityModelInput`, `UpdateMaturityModelInput`, `CreateMaturityAssessmentInput`, `UpdateMaturityAssessmentInput`, `CreateMaturityRoadmapItemInput`, `SubmitBenchmarkInput`
- `packages/shared/src/schemas/bi-reporting.ts` -- `biReportStatusValues`, `biWidgetTypeValues`, `biDataSourceTypeValues`, `biQueryStatusValues`, `biShareAccessValues`, `biScheduleFrequencyValues`, `biExecutionStatusValues`, `biOutputFormatValues`, `biWidgetPositionSchema`, `CreateBiReportInput`, `UpdateBiReportInput`, `CreateBiReportWidgetInput`, `CreateBiDataSourceInput`, `CreateBiQueryInput`, `CreateBiShareInput`, `UpsertBiBrandConfigInput`, `CreateBiScheduledReportInput`, `TriggerBiReportExecutionInput`
- `packages/shared/src/schemas/board-kpi.ts` -- `assuranceWeightsSchema`, `postureWeightsSchema`, `assuranceModuleParamSchema`, `trendQuerySchema`
- `packages/shared/src/schemas/bpm-advanced.ts` -- `LOWER_IS_BETTER_METRICS`, `HIGHER_IS_BETTER_METRICS`, `updateKpiDefinitionSchema`, `createKpiMeasurementSchema`, `computeKpiStatus`, `LEAN_8_WASTES`, `updateVsmSchema`, `adoptTemplateSchema`, `acceptSuggestionSchema`
- `packages/shared/src/schemas/bpm-derived.ts` -- `raciRoleSchema`, `RACIRole`, `RACIOverride`, `processHealthValues`, `processHealthSchema`, `ProcessHealth`, `UpdateProcessHealth`, `metroStationSchema`, `metroLayoutSchema`, `MetroLayout`
- `packages/shared/src/schemas/branding.ts` -- `UpdateBrandingInput`, `widgetPositionSchema`, `UpdateDashboardLayoutInput`, `brandingResponseSchema`
- `packages/shared/src/schemas/calendar.ts` -- `calendarQuerySchema`, `capacityHeatmapQuerySchema`, `CALENDAR_EVENT_SOURCES`, `CalendarEventSource`
- `packages/shared/src/schemas/catalog.ts` -- `createCustomCatalogEntrySchema`, `catalogBrowserQuerySchema`
- `packages/shared/src/schemas/cloud-connector.ts` -- `cloudProviderValues`, `cloudExecutionStatusValues`, `cloudTriggerValues`, `cloudSuiteQuerySchema`, `cloudExecutionQuerySchema`, `cloudSnapshotQuerySchema`
- `packages/shared/src/schemas/community.ts` -- `editionTypeValues`, `contributionStatusValues`, `contributionTypeValues`, `UpsertCommunityEditionConfigInput`, `CreateContributionInput`
- `packages/shared/src/schemas/compliance-culture.ts` -- `cciFactorKeySchema`, `cciFactorWeightsSchema`, `cciPeriodSchema`, `cciTrendSchema`, `cciSnapshotSchema`
- `packages/shared/src/schemas/control-testing-agent.ts` -- `runTestExecutionSchema`
- `packages/shared/src/schemas/control.ts` -- `findingSeverityValues`, `FindingSeverityValue`, `normalizeFindingSeverity`, `findingStatusValues`, `FindingStatusValue`, `findingSourceValues`, `FindingSourceValue`
- `packages/shared/src/schemas/dashboard.ts` -- `dashboardWidgetPositionSchema`, `widgetDisplayOptionsSchema`, `widgetConfigSchema`, `layoutItemSchema`, `dashboardListQuerySchema`, `validateLayout`, `serializeLayout`
- `packages/shared/src/schemas/data-sovereignty.ts` -- `dataRegionCodeValues`, `regionStatusValues`, `residencyRuleTypeValues`, `replicationStatusValues`, `sovereigntyEventTypeValues`, `complianceFrameworkTagValues`, `CreateDataRegionInput`, `UpdateDataRegionInput`, `UpsertRegionTenantConfigInput`, `CreateDataResidencyRuleInput`, `CreateCrossRegionReplicationInput`
- `packages/shared/src/schemas/devops-connector.ts` -- `devopsPlatformValues`, `devopsPlatformCategoryValues`, `devopsTestCategoryValues`, `devopsResourceTypeValues`, `itCheckTypeValues`, `infraComplianceStatusValues`, `devopsTestResultQuerySchema`, `itInfraCheckQuerySchema`
- `packages/shared/src/schemas/dpms-advanced.ts` -- `updateRetentionScheduleSchema`, `createRetentionExceptionSchema`, `approveDeletionSchema`, `verifyDeletionSchema`, `DELETION_TRANSITIONS`, `isValidDeletionTransition`, `createTiaAdvancedSchema`, `updateTiaAdvancedSchema`, `updateDpmsChecklistSchema`, `createDpmsSubProcessorNotificationSchema`, `respondSubProcessorSchema`, `submitPbdAssessmentSchema`, `assessValiditySchema`, `DPIA_TRIGGER_CRITERIA`, `assessDpiaTrigger`, `computePbdScore`
- `packages/shared/src/schemas/dpms.ts` -- `ropaStatusTransitionSchema`, `VALID_ROPA_STATUS_TRANSITIONS`, `createRopaDataCategorySchema`, `createRopaDataSubjectSchema`, `createRopaRecipientSchema`, `thirdCountryTransferSchema`, `dpiaStatusTransitionSchema`, `VALID_DPIA_STATUS_TRANSITIONS`, `dsrStatusTransitionSchema`, `DSR_STATUS_TRANSITIONS`, `isValidDsrTransition`, `breachStatusTransitionSchema`, `BREACH_STATUS_TRANSITIONS`, `isValidBreachTransition`
- `packages/shared/src/schemas/eam-advanced.ts` -- `updateDataFlowSchema`, `createInterfaceSchema`, `updateInterfaceSchema`, `updateTechnologySchema`, `linkTechnologySchema`, `updateAcrSchema`, `linkRopaSchema`, `isValidHealthCheckUrl`
- `packages/shared/src/schemas/eam-ai.ts` -- `llmProviderEnum`, `bulkDescriptionSchema`
- `packages/shared/src/schemas/eam-catalog.ts` -- `catalogObjectTypeEnum`, `catalogFiltersSchema`, `mergeKeywordsSchema`, `updateKeywordsOnObjectSchema`
- `packages/shared/src/schemas/eam-dashboards.ts` -- `functionalFitEnum`, `technicalFitEnum`, `sixRStrategyEnum`, `businessCriticalityEnum`, `functionalCoverageEnum`, `strategicAlignmentEnum`, `capabilityLifecycleStatusEnum`
- `packages/shared/src/schemas/eam-data-architecture.ts` -- `dataCategoryEnum`, `dataClassificationEnum`, `contextTypeEnum`, `contextStatusEnum`, `updateDataObjectSchema`
- `packages/shared/src/schemas/eam-governance.ts` -- `governanceActionEnum`, `bpmnPlacementTypeEnum`, `biApiKeySchema`, `excelImportSchema`, `updatePersonalDataSchema`, `predecessorSchema`
- `packages/shared/src/schemas/eam.ts` -- `updateViolationStatusSchema`, `archiMateImportSchema`, `eamCsvImportSchema`
- `packages/shared/src/schemas/erm-advanced.ts` -- `bowtieElementSchema`, `bowtiePathSchema`, `createMilestoneSchema`, `updateMilestoneSchema`, `cascadeSimulationSchema`, `updateEmergingRiskSchema`, `createRiskEventLessonSchema`
- `packages/shared/src/schemas/esg-advanced.ts` -- `createEsgAdvMaterialityAssessmentSchema`, `updateEsgAdvMaterialityAssessmentSchema`, `ESRS_TOPICS`, `createIroSchema`, `updateIroSchema`, `createStakeholderEngagementSchema`, `updateEmissionSourceSchema`, `createActivityDataSchema`, `createCustomEmissionFactorSchema`, `createCollectionCampaignSchema`, `updateCollectionCampaignSchema`, `createCollectionAssignmentSchema`, `submitCollectionAssignmentSchema`, `reviewCollectionAssignmentSchema`, `createSupplierEsgAssessmentSchema`, `classifySupplierRiskSchema`, `classifySupplierEsgRisk`, `createCorrectiveActionSchema`, `updateCorrectiveActionSchema`, `createLksgDueDiligenceSchema`, `updateLksgDueDiligenceSchema`, `updateEsrsDisclosureSchema`
- `packages/shared/src/schemas/event-bus.ts` -- `entityReferenceQuerySchema`, `impactQuerySchema`, `referenceStatsQuerySchema`, `eventLogQuerySchema`, `eventFilterSchema`, `webhookDeliveryQuerySchema`, `entityTypeValues`, `relationshipValues`, `eventTypeValues`, `templateTypeValues`
- `packages/shared/src/schemas/evidence-connector.ts` -- `connectorTypeValues`, `connectorStatusValues`, `connectorAuthMethodValues`, `connectorHealthStatusValues`, `credentialTypeValues`, `artifactTypeValues`, `testResultStatusValues`, `testSeverityValues`, `testCategoryValues`, `healthCheckTypeValues`, `rotateCredentialSchema`, `connectorQuerySchema`, `testResultQuerySchema`, `artifactQuerySchema`, `testDefinitionQuerySchema`
- `packages/shared/src/schemas/extension.ts` -- `updatePluginSettingSchema`, `createMarketplaceListingSchema`, `CreatePluginInput`, `UpdatePluginInput`, `InstallPluginInput`, `UpdatePluginInstallationInput`, `UpdatePluginSettingInput`, `CreateMarketplaceListingInput`, `UpdateMarketplaceListingInput`
- `packages/shared/src/schemas/fair.ts` -- `LossComponentsInput`
- `packages/shared/src/schemas/framework-mapping.ts` -- `frameworkKeyValues`, `mappingRelationshipTypeValues`, `mappingSourceValues`, `mappingRuleTypeValues`, `coverageStatusValues`, `coverageSourceValues`, `evidenceStatusValues`, `assessmentResultValues`, `riskExposureValues`, `upsertCoverageSchema`, `bulkGapAnalysisSchema`, `frameworkMappingQuerySchema`, `coverageQuerySchema`, `gapAnalysisQuerySchema`
- `packages/shared/src/schemas/graph.ts` -- `graphStatsQuerySchema`, `graphDependencyMatrixQuerySchema`, `graphEntityTypeValues`, `graphRelationshipValues`, `graphScenarioValues`, `graphLayoutValues`
- `packages/shared/src/schemas/grc-ux.ts` -- `grcModuleValues`, `MyTodosQuery`, `timelineEventTypeValues`, `timelineEntryCreateSchema`, `TimelineEntryCreate`, `IncidentRating`, `resourceClassificationValues`, `resourceClassificationSchema`, `ResourceClassification`, `damageIndexInputSchema`, `DamageIndexInput`
- `packages/shared/src/schemas/ics-advanced.ts` -- `updateCcmConnectorSchema`, `createSoxScopeSchema`, `updateSoxScopeSchema`, `computeSoxSampleSize`, `EvaluationRule`, `CCMConnectorInterface`, `CCMEvidenceResult`, `EvaluationResult`, `DEFICIENCY_TRANSITIONS`
- `packages/shared/src/schemas/identity-saas-connector.ts` -- `identityProviderValues`, `identityTestCategoryValues`, `saasPlatformValues`, `saasCheckTypeValues`, `saasComplianceStatusValues`, `syncIntervalValues`, `identityTestResultQuerySchema`, `saasComplianceQuerySchema`
- `packages/shared/src/schemas/identity.ts` -- `samlAttributeMappingSchema`, `oidcClaimMappingSchema`, `groupRoleMappingSchema`, `scimSyncLogFilterSchema`, `toggleSsoEnforcementSchema`
- `packages/shared/src/schemas/import-export.ts` -- `importUploadSchema`, `importExecuteSchema`, `exportRequestSchema`, `VALID_IMPORT_JOB_TRANSITIONS`
- `packages/shared/src/schemas/intelligence.ts` -- `createAiPromptLogSchema`
- `packages/shared/src/schemas/isms-intelligence.ts` -- `cveSeverity`, `cveMatchStatus`, `soaGapType`, `soaSuggestionStatus`, `soaGapPriority`, `roadmapEffort`, `roadmapActionStatus`, `cveMatchStatusTransitions`, `removeAssetCpeSchema`, `cveQuerySchema`, `cveMatchQuerySchema`
- `packages/shared/src/schemas/isms.ts` -- `protectionLevel`, `incidentSeverity`, `incidentStatus`, `dependencyType`, `ismsObjectCriticality`, `createProcessAssetSchema`, `AssessmentSetupWizardInput`, `MANAGEMENT_REVIEW_ITEM_CATEGORIES`, `ManagementReviewItemCategory`, `rateMaturitySchema`
- `packages/shared/src/schemas/marketplace.ts` -- `marketplaceCategoryTypeValues`, `marketplaceListingStatusValues`, `marketplaceVersionStatusValues`, `marketplaceScanStatusValues`, `createMktplaceListingSchema`, `updateMktplaceListingSchema`, `updateMarketplaceReviewSchema`, `CreateMarketplacePublisherInput`, `CreateMktplaceListingInput`, `CreateMarketplaceVersionInput`, `CreateMarketplaceReviewInput`, `InstallListingInput`, `CreateMarketplaceCategoryInput`
- `packages/shared/src/schemas/mobile.ts` -- `bulkSendPushSchema`, `createMobileSessionSchema`, `RegisterDeviceInput`, `UpdateDeviceInput`, `SendPushNotificationInput`, `BulkSendPushInput`, `SyncRequestInput`, `CreateMobileSessionInput`, `AssetScanInput`
- `packages/shared/src/schemas/nis2-certification.ts` -- `nis2RequirementStatus`, `nis2ReportType`, `NIS2ReportType`, `nis2ReportStatus`, `NIS2ReportStatus`, `certSnapshotQuerySchema`, `nis2ReportQuerySchema`, `NIS2_NOTIFICATION_DEADLINES`, `NIS2_CHAPTERS`, `CertReadinessCheckDef`
- `packages/shared/src/schemas/onboarding.ts` -- `selectFrameworksSchema`, `selectModulesSchema`, `StartOnboardingInput`, `UpdateOnboardingStepInput`, `SelectFrameworksInput`, `SelectModulesInput`, `ApplyTemplatePackInput`, `CreateImportJobInput`, `UpdateImportJobInput`
- `packages/shared/src/schemas/platform-advanced.ts` -- `updateCustomFieldSchema`, `reorderCustomFieldsSchema`, `updateNotificationPreferenceSchema`, `searchQuerySchema`, `updateBrandingExtendedSchema`
- `packages/shared/src/schemas/platform.ts` -- `contactRoleTypes`, `inviteUserSchema`, `acceptInvitationSchema`
- `packages/shared/src/schemas/playbook.ts` -- `playbookTriggerCategory`, `PlaybookTriggerCategory`, `playbookTriggerSeverity`, `PlaybookTriggerSeverity`, `playbookActivationStatus`, `PlaybookActivationStatus`, `playbookAssignedRole`, `SEVERITY_ORDER`, `INCIDENT_TO_PLAYBOOK_SEVERITY`, `playbookTaskTemplateSchema`, `playbookPhaseSchema`, `CreatePlaybookTemplateInput`, `UpdatePlaybookTemplateInput`, `playbookListQuerySchema`, `PlaybookTemplateWithPhases`, `PlaybookPhaseWithTasks`, `PlaybookTaskTemplateType`, `PlaybookActivationType`, `PlaybookStatusResponse`
- `packages/shared/src/schemas/policy-acknowledgment.ts` -- `targetScopeSchema`, `quizQuestionSchema`, `distributionStatusTransitions`
- `packages/shared/src/schemas/process.ts` -- `approvalStepTypeValues`, `generateBpmnSchema`, `commentListQuerySchema`, `laneCarrierKinds`, `sodSeverityValues`, `biaCriticalityValues`
- `packages/shared/src/schemas/programme.ts` -- `PDCA_PHASE_VALUES`, `evidenceLinkSchema`, `EvidenceLink`, `targetModuleLinkSchema`, `TargetModuleLink`, `CreateJourneyInput`, `UpdateJourneyInput`, `UpdateStepInput`
- `packages/shared/src/schemas/rcsa.ts` -- `rcsaCampaignStatusTransitions`
- `packages/shared/src/schemas/regulatory-change.ts` -- `updateImpactAssessmentSchema`, `impactAssessmentQuerySchema`, `updateRegulatoryCalendarEventSchema`
- `packages/shared/src/schemas/regulatory-simulator.ts` -- `simulationScenarioTypeValues`, `simulationGapSchema`, `timelineMilestoneSchema`
- `packages/shared/src/schemas/reporting.ts` -- `reportSectionConfigSchema`, `reportParameterDefinitionSchema`, `reportBrandingConfigSchema`, `threatDashboardQuerySchema`
- `packages/shared/src/schemas/risk-acceptance.ts` -- `riskAcceptanceStatusSchema`, `RiskAcceptanceStatusValue`, `CreateRiskAcceptanceInput`, `RevokeRiskAcceptanceInput`, `UpdateRiskAcceptanceInput`, `RiskAcceptanceListQuery`, `acceptanceAuthorityRoleValues`, `acceptanceAuthorityEntrySchema`, `UpsertAcceptanceAuthorityInput`
- `packages/shared/src/schemas/risk-evaluation.ts` -- `riskObjectTypeValues`, `riskObjectTypeSchema`, `RiskObjectType`, `evaluationPhaseValues`, `evaluationPhaseSchema`, `EvaluationPhase`, `evaluationCycleValues`, `evaluationCycleSchema`, `EvaluationCycle`, `evaluationTypeValues`, `evaluationTypeSchema`, `EvaluationType`, `PhaseTransition`, `moduleRelevanceSchema`, `ModuleRelevance`, `riskCreateExtendedSchema`, `RiskCreateExtended`, `roleCommentFieldValues`, `roleCommentSchema`, `RoleComment`, `ManagementSummaryRequest`, `CreateRiskTreatmentLink`, `RiskValueRange`, `getRiskValueRange`, `computeRiskValue`
- `packages/shared/src/schemas/risk-propagation.ts` -- `orgRelationshipTypeValues`, `correlationTypeValues`, `correlationTimelineSchema`
- `packages/shared/src/schemas/risk-quantification.ts` -- `rqMethodologyValues`, `rqCalculationStatusValues`, `rqAppetiteStatusValues`, `rqSummaryStatusValues`, `createRqRiskAppetiteThresholdSchema`, `updateRqRiskAppetiteThresholdSchema`, `UpsertRiskQuantConfigInput`, `TriggerVarCalculationInput`, `CreateRiskAppetiteThresholdInput`, `CreateSensitivityAnalysisInput`, `CreateRiskExecutiveSummaryInput`, `ExportBoardPresentationInput`
- `packages/shared/src/schemas/role-dashboards.ts` -- `roleDashboardTypeValues`, `roleDashboardWidgetCategoryValues`, `CreateRoleDashboardConfigInput`, `UpdateRoleDashboardConfigInput`, `UpsertWidgetPreferenceInput`, `BulkUpsertWidgetPreferencesInput`
- `packages/shared/src/schemas/saas-metering.ts` -- `updateOrgSubscriptionSchema`, `bulkRecordUsageSchema`, `CreateSubscriptionPlanInput`, `UpdateSubscriptionPlanInput`, `CreateOrgSubscriptionInput`, `UpdateOrgSubscriptionInput`, `CancelSubscriptionInput`, `RecordUsageInput`, `BulkRecordUsageInput`, `CreateFeatureGateInput`, `UpdateFeatureGateInput`, `UsageQueryInput`, `BillingQueryInput`
- `packages/shared/src/schemas/simulation.ts` -- `simulationTypeValues`, `simulationStatusValues`, `simulationScenarioTagValues`, `createSimulationParameterSchema`, `CreateSimulationScenarioInput`, `StartSimulationRunInput`, `CreateSimulationParameterInput`, `CreateSimulationComparisonInput`
- `packages/shared/src/schemas/stakeholder-portal.ts` -- `portalTypeValues`, `portalSessionStatusValues`, `portalQuestionnaireStatusValues`, `CreatePortalConfigInput`, `CreatePortalSessionInput`, `UpsertPortalBrandingInput`
- `packages/shared/src/schemas/tprm-advanced.ts` -- `updateScorecardWeightsSchema`, `updateSlaDefinitionSchema`, `createTprmSlaMeasurementSchema`, `updateExitPlanSchema`, `updateSubProcessorSchema`, `createTprmSubProcessorNotificationSchema`, `reviewSubProcessorNotificationSchema`
- `packages/shared/src/schemas/tprm.ts` -- `updateVendorContactSchema`, `reviewDueDiligenceSchema`, `createDdQuestionSchema`, `updateDdQuestionSchema`, `updateSlaSchema`, `vendorListQuerySchema`, `contractListQuerySchema`, `questionOptionSchema`, `conditionalSchema`, `updateSectionSchema`, `updateQuestionSchema`, `portalResponseSchema`
- `packages/shared/src/schemas/translation.ts` -- `translatableFieldSchema`, `aiBatchTranslateSchema`
- `packages/shared/src/schemas/whistleblowing-advanced.ts` -- `INVESTIGATION_TRANSITIONS`, `assignInvestigatorSchema`, `recordDecisionSchema`, `createWbEvidenceSchema`, `createInterviewSchema`, `updateProtectionCaseSchema`, `createProtectionEventSchema`, `reviewProtectionEventSchema`, `DEFAULT_RETALIATION_RULES`, `createTelephoneIntakeSchema`, `createPostalIntakeSchema`, `createWalkInIntakeSchema`, `updateRoutingRulesSchema`, `createOmbudspersonAssignmentSchema`
- `packages/shared/src/schemas/whistleblowing.ts` -- `wbCategoryValues`, `wbCaseStatusValues`, `wbPriorityValues`, `wbResolutionCategoryValues`, `wbCaseListQuerySchema`
- `packages/shared/src/secret-crypto.ts` -- `OpenedSecret`
- `packages/shared/src/state-machines/aiact-conformity.ts` -- `ConformityChecklistResult`, `CeMarkingGateResult`, `PostMarketPlanResult`
- `packages/shared/src/state-machines/aiact-docgov.ts` -- `DataGovernanceResult`, `AnnexIvResult`, `DeclarationValidation`, `SubstantialChangeAssessment`
- `packages/shared/src/state-machines/aiact-fria-incident.ts` -- `DeployerType`, `FriaRequirementResult`, `FundamentalRight`, `FriaQualityResult`, `IncidentDeadlineResult`, `IncidentOverdueResult`
- `packages/shared/src/state-machines/aiact-gpai-report.ts` -- `GpaiSystemicRiskResult`, `GpaiObligationResult`, `AnnualReportResult`
- `packages/shared/src/state-machines/aiact-oversight.ts` -- `LoggingCapabilityResult`, `OversightAssessment`, `OversightLogQuality`, `DeployerComplianceResult`, `TransparencyResult`
- `packages/shared/src/state-machines/aiact-qms.ts` -- `countCompletedProcedures`, `computeQmsMaturity`, `QmsReadinessResult`, `Iso42001GapResult`, `AiRiskDimension`, `AiRisk`, `AiRiskAssessmentQuality`, `assessAiRiskPortfolio`
- `packages/shared/src/state-machines/aiact-system.ts` -- `AiRiskCategory`, `Blocker`, `countProhibitedPractices`
- `packages/shared/src/state-machines/bcms-bcp.ts` -- `BCP_ALLOWED_TRANSITIONS`, `Blocker`, `PublishContext`, `BcpTransitionRequest`, `BcpTransitionResult`
- `packages/shared/src/state-machines/bcms-bia.ts` -- `Blocker`, `BiaTransitionRequest`, `BiaTransitionResult`, `validateBiaTransition`
- `packages/shared/src/state-machines/bcms-crisis.ts` -- `CRISIS_ALLOWED_TRANSITIONS`, `Blocker`, `validateCrisisGate9Activate`, `validateCrisisGate10Resolve`, `CrisisTransitionRequest`, `CrisisTransitionResult`, `DoraDeadlines`
- `packages/shared/src/state-machines/bcms-exercise.ts` -- `Blocker`, `ExerciseTransitionRequest`, `ExerciseTransitionResult`
- `packages/shared/src/state-machines/cross-findings.ts` -- `FindingModule`, `NormalizedSeverity`, `CrossFindingAggregate`, `PrioritizedFinding`
- `packages/shared/src/state-machines/cross-risk-sync.ts` -- `DpiaSeverity`, `DpiaLikelihood`, `DpiaImpact`, `mapDpiaRiskToErm`, `FundamentalRightImpact`, `mapFriaRightToErm`, `mapAiIncidentToErm`, `SyncDecision`, `decideRiskSync`, `SyncBatchInput`, `SyncBatchResult`
- `packages/shared/src/state-machines/dpms-avv.ts` -- `AvvAgreementStatus`, `AVV_ALLOWED_TRANSITIONS`, `Blocker`, `AvvSnapshot`, `validateAvvGateActivate`, `AvvTransitionRequest`, `AvvTransitionResult`, `validateAvvTransition`, `AvvReviewStatus`, `checkAvvReviewStatus`
- `packages/shared/src/state-machines/dpms-breach.ts` -- `BREACH_ALLOWED_TRANSITIONS`, `Blocker`, `validateBreachGate9Assess`, `validateBreachGate10NotifyDpa`, `validateBreachGate11NotifyIndividuals`, `validateBreachGate12Close`, `BreachDeadline`, `BreachTransitionRequest`, `BreachTransitionResult`
- `packages/shared/src/state-machines/dpms-dpia.ts` -- `Blocker`, `validateDpiaGate3Start`, `validateDpiaGate3Complete`, `validateDpiaGate3Approve`, `DpiaTransitionRequest`, `DpiaTransitionResult`
- `packages/shared/src/state-machines/dpms-dsr.ts` -- `DSR_ALLOWED_TRANSITIONS`, `Blocker`, `validateDsrGate6Verify`, `validateDsrGate7Response`, `validateDsrGate8Close`, `DsrDeadline`, `DsrTransitionRequest`, `DsrTransitionResult`
- `packages/shared/src/state-machines/dpms-retention.ts` -- `RetentionScheduleRule`, `RetentionExecutionContext`, `RetentionDecision`, `decideRetention`, `ConsentTypeMeta`, `ConsentValidationResult`, `validateConsentType`, `isConsentStillValid`
- `packages/shared/src/state-machines/dpms-ropa.ts` -- `ROPA_ALLOWED_TRANSITIONS`, `Blocker`, `validateRopaGate1Activate`, `RopaTransitionRequest`, `RopaTransitionResult`
- `packages/shared/src/state-machines/dpms-tia.ts` -- `Blocker`, `TiaSnapshot`, `validateTiaQuality`, `ADEQUACY_COUNTRIES`, `LegalMechanism`, `TransferRiskAssessment`, `assessTransferRisk`
- `packages/shared/src/state-machines/grc-executive-dashboard.ts` -- `IsmsDashboardInput`, `BcmsDashboardInput`, `DpmsDashboardInput`, `AiActDashboardInput`, `HealthStatus`, `ModuleHealth`, `ExecutiveDashboardResult`, `computeIsmsHealth`, `computeBcmsHealth`, `computeDpmsHealth`, `computeAiActHealth`
- `packages/shared/src/state-machines/isms-assessment.ts` -- `AssessmentPhase`, `phaseForStatus`, `ALLOWED_TRANSITIONS`, `Blocker`, `validateGate1Setup`, `TransitionRequest`, `TransitionResult`, `PhaseChecklist`
- `packages/shared/src/state-machines/isms-nc.ts` -- `NcTransitionInput`, `NcTransitionResult`, `isNcStatus`, `CA_STATUSES`, `CaStatus`, `CA_ALLOWED_TRANSITIONS`, `isCaStatus`, `validateCaTransition`, `CloseAssertion`
- `packages/shared/src/state-machines/programme-journey.ts` -- `PROGRAMME_JOURNEY_TRANSITIONS`, `JourneyTransitionInput`, `JourneyTransitionResult`, `isProgrammeJourneyStatus`, `JourneyHealthInput`, `JourneyHealthResult`, `HealthSignal`
- `packages/shared/src/state-machines/programme-step.ts` -- `PROGRAMME_STEP_TRANSITIONS`, `StepTransitionInput`, `StepTransitionResult`, `isProgrammeStepStatus`, `StepStartPreconditionInput`, `StepStartPreconditionResult`, `StepReviewPreconditionInput`, `StepReviewPreconditionResult`, `NextBestActionsInput`
- `packages/shared/src/state-machines/risk-acceptance.ts` -- `RISK_ACCEPTANCE_ALLOWED_TRANSITIONS`, `RiskAcceptanceTransitionResult`, `AcceptanceAuthorityBand`, `ResolvedAcceptanceAuthority`, `canAcceptWithRoles`
- `packages/shared/src/state-machines/risk-status.ts` -- `RISK_STATUSES`, `RISK_TRANSITIONS_REQUIRING_REASON`, `RiskStatusTransitionInput`, `RiskStatusTransitionResult`
- `packages/shared/src/types/abac.ts` -- `AbacAccessLevel`, `AbacDecision`, `SimulationStatus`, `DmnStatus`, `DmnHitPolicy`, `AbacCondition`, `AbacAccessLogEntry`, `AbacTestResult`, `SimulationScenario`, `SimulationResource`, `SimulationActivityParam`, `SimulationResult`, `BottleneckActivity`, `HistogramBin`, `DmnColumn`, `DmnEvaluationResult`
- `packages/shared/src/types/agents.ts` -- `AgentType`, `AgentStatus`, `AgentPhase`, `RecommendationSeverity`, `RecommendationStatus`, `SuggestedAction`, `AgentConfig`, `AgentRegistration`, `AgentExecutionLog`, `AgentRecommendationData`, `CreatedAction`
- `packages/shared/src/types/ai-act.ts` -- `AiRiskClassification`, `AiTechnique`, `AiAnnexCategory`, `AiProviderDeployer`, `AiSystemStatus`, `AiAssessmentType`, `AiAssessmentResult`, `AiAssessmentStatus`, `AiOversightLogType`, `AiTransparencyEntryType`, `AiTransparencyStatus`, `AiFriaImpact`, `AiFriaStatus`, `AiFramework`, `AiImplementationStatus`, `AiAffectedPerson`, `AiRequirement`, `AiAssessmentFinding`, `AiTransparencyEntry`, `AiFriaRight`, `AiFriaConsultation`
- `packages/shared/src/types/assets.ts` -- `AssetCiaProfile`, `WorkItemLink`
- `packages/shared/src/types/audit-advanced.ts` -- `AuditWpFolder`, `AuditWorkingPaper`, `AuditWpReviewNote`, `AuditWpReviewNoteReply`, `AuditorProfile`, `AuditorCertification`, `AuditResourceAllocation`, `AuditTimeEntry`, `ContinuousAuditRule`, `ContinuousAuditResult`, `ContinuousAuditException`, `AuditQaReview`, `AuditQaChecklistItem`, `ExternalAuditorShare`, `ExternalAuditorActivity`, `CapacityDashboardEntry`, `SkillGapEntry`
- `packages/shared/src/types/audit-analytics.ts` -- `SamplingMethod`, `OutlierMethod`, `ColumnSchema`, `AnalysisSummary`, `BenfordDigitResult`, `DuplicatePair`, `SampleResult`, `OutlierResult`, `AuditAnalyticsTemplate`, `RiskFeatures`, `TrainingMetrics`, `RiskPredictionAlert`
- `packages/shared/src/types/audit.ts` -- `AuditType`, `AuditPlanStatus`, `ChecklistResult`, `AuditMethod`, `AuditRiskRating`, `MethodEntryBase`, `MethodEntryInterview`, `MethodEntryDocumentReview`, `MethodEntryObservation`, `MethodEntryWalkthrough`, `MethodEntryTechnicalTest`, `MethodEntrySampling`, `MethodEntryReperformance`, `AuditConclusion`, `UniverseEntityType`, `AuditEvidence`
- `packages/shared/src/types/automation.ts` -- `AutomationTriggerType`, `AutomationEventType`, `ConditionOperator`, `AutomationActionType`, `AutomationActionConfig`, `AutomationRule`, `AutomationRuleExecution`, `AutomationRuleTemplate`, `AutomationTemplateCategory`, `AutomationDashboardStats`
- `packages/shared/src/types/bcms-advanced.ts` -- `CrisisContactTree`, `CrisisContactNode`, `CrisisCommunicationLogEntry`, `BCExercise`, `BCExerciseScenario`, `BCExerciseInject`, `BCExerciseInjectLog`, `BCExerciseLesson`, `RecoveryProcedure`, `RecoveryProcedureStep`, `MtpdCascadeResult`, `SinglePointOfFailure`, `RecoveryReadinessRow`
- `packages/shared/src/types/bcms.ts` -- `CrisisSeverity`, `ExerciseType`, `StrategyType`, `BcpResourceType`, `CrisisLogEntryType`, `ExerciseFindingSeverity`, `BiaSupplierDependency`, `EssentialProcess`, `CrisisTeamMember`
- `packages/shared/src/types/board-kpi.ts` -- `BoardKpiRiskCategory`, `AssuranceModule`, `RiskAppetiteThresholdRow`, `SecurityPostureResult`, `PostureDomainScore`
- `packages/shared/src/types/bpm-advanced.ts` -- `ProcessEventLog`, `ProcessEvent`, `DirectlyFollowsGraph`, `DfgNode`, `DfgEdge`, `ProcessConformanceResult`, `ConformanceDeviationEdge`, `PrecisionIssue`, `ReworkLoop`, `Bottleneck`, `ProcessMiningSuggestion`, `ProcessKpiDefinition`, `ProcessKpiMeasurement`, `ProcessMaturityAssessment`, `MaturityGapAction`, `MaturityQuestionnaireItem`, `ValueStreamMap`, `VsmDiagramData`, `VsmStep`, `WasteEntry`, `VsmComparison`, `ProcessTemplate`
- `packages/shared/src/types/branding.ts` -- `OrgBranding`, `DashboardLayoutResponse`, `WidgetDefinition`
- `packages/shared/src/types/budget.ts` -- `GrcRoiCalculation`, `BudgetForecast`, `BudgetCutScenarioInput`
- `packages/shared/src/types/calendar.ts` -- `CalendarEventType`, `CalendarRecurrence`, `CalendarDeadlineStatus`, `ComplianceCalendarEvent`, `CalendarUpcomingEvent`, `ICalTokenResponse`, `CalendarDigestEvent`
- `packages/shared/src/types/catalog.ts` -- `MethodologyType`, `EnforcementLevel`, `RiskCatalog`, `RiskCatalogEntry`, `ControlCatalog`, `ControlCatalogEntry`, `OrgRiskMethodology`
- `packages/shared/src/types/cert-wizard.ts` -- `CertFramework`, `CertAssessmentStatus`, `CertMockAuditType`, `CertMockAuditStatus`, `CertEvidenceStatus`, `CertControlDetail`, `CertGapItem`, `CertTimelinePhase`, `CertRisk`, `CertEvidenceItem`, `CertMissingEvidence`, `CertMockQuestion`, `CertMockResponse`, `CertMockFinding`, `CertMockStrength`, `CertMockWeakness`
- `packages/shared/src/types/cloud-connector.ts` -- `CloudProvider`, `CloudTestExecutionStatus`, `CloudTestTrigger`, `TrendDirection`, `CloudTestSuite`, `CloudTestExecution`, `CloudTestResultEntry`, `CloudComplianceSnapshot`, `CloudDashboardStats`
- `packages/shared/src/types/compliance-culture.ts` -- `CCISnapshot`, `CCIConfiguration`, `CacheStatsEntry`
- `packages/shared/src/types/control-testing-agent.ts` -- `AgentTestType`, `TestConnectorType`, `TestFrequency`, `TestExecutionStatus`, `AgentTestResult`, `AgentTestResultSeverity`, `TestTriggeredBy`, `ChecklistStatus`, `AgentChecklistResult`, `ChecklistItemResponse`, `LearningPatternType`, `TestStep`, `StepResult`, `ConnectorLog`, `ChecklistItem`, `ControlTestLearning`, `LearningPattern`
- `packages/shared/src/types/control.ts` -- `TestType`, `ControlTestCampaign`, `DocumentApprovalStepType`, `DocumentApprovalStepStatus`, `DocumentApprovalStep`, `RetentionPolicy`
- `packages/shared/src/types/copilot-chat.ts` -- `CopilotLanguage`, `CopilotMessageRole`, `CopilotContentType`, `CopilotActionType`, `CopilotActionStatus`, `PromptCategory`, `RagSourceType`, `RagReference`, `PromptVariable`, `CopilotRagSource`, `CopilotSuggestedAction`, `CopilotFeedback`, `CopilotUsageStats`, `CopilotDashboard`
- `packages/shared/src/types/dashboard.ts` -- `DashboardVisibility`, `ChartType`, `DashboardWidgetPosition`, `WidgetDataResult`
- `packages/shared/src/types/devops-connector.ts` -- `DevopsPlatform`, `DevopsPlatformCategory`, `DevopsTestCategory`, `DevopsResourceType`, `ItCheckType`, `ItResourceType`, `InfraComplianceStatus`, `DevopsConnectorConfig`, `DevopsTestResult`, `ItInfrastructureCheck`, `DevopsDashboardStats`
- `packages/shared/src/types/dora.ts` -- `DoraIctAssetType`, `DoraThreatCategory`, `DoraLikelihood`, `DoraImpact`, `DoraRiskLevel`, `DoraTreatmentStrategy`, `DoraIctRiskStatus`, `DoraTlptTestType`, `DoraTlptStatus`, `DoraIncidentType`, `DoraIncidentClassification`, `DoraIncidentStatus`, `DoraProviderServiceType`, `DoraProviderCriticality`, `DoraComplianceStatus`, `DoraProviderStatus`, `DoraSharingType`, `DoraTlpClassification`, `DoraSharingStatus`, `DoraOverlapType`, `DoraExistingControl`, `DoraAffectedService`, `DoraTlptTargetSystem`, `DoraTlptScenario`, `DoraTlptFinding`, `DoraRemediationAction`
- `packages/shared/src/types/dpms-advanced.ts` -- `RetentionException`, `DeletionRequest`, `TransferImpactAssessment`, `CountryRiskProfile`, `ProcessorAgreement`, `SubProcessorNotification`, `PbdAssessment`, `ConsentRecord`, `ConsentDashboard`, `RetentionDashboard`
- `packages/shared/src/types/dpms.ts` -- `RopaLegalBasis`, `DsrType`, `BreachSeverity`, `DpiaRisk`, `DpiaMeasure`
- `packages/shared/src/types/eam-advanced.ts` -- `TransferMechanism`, `EncryptionType`, `EncryptionAtRest`, `DataFlowFrequency`, `DataFlowStatus`, `LegalBasis`, `SchremsIiSafeguard`, `InterfaceType`, `InterfaceDirection`, `HealthStatus`, `TechCategory`, `TechQuadrant`, `TechRing`, `AcrChangeType`, `AcrStatus`, `AcrRiskAssessment`, `VoteChoice`, `EamCloudProvider`, `ApplicationInterface`, `TechnologyEntry`, `TechnologyApplicationLink`, `AcrImpactSummary`, `ArchitectureChangeVote`, `ArchitectureHealthSnapshot`, `CloudServiceCatalogEntry`, `CrossBorderResult`, `TechnicalDebt`, `RedundancyCluster`, `EU_EEA_COUNTRIES`, `ADEQUACY_COUNTRIES`
- `packages/shared/src/types/eam-ai.ts` -- `LLMProviderId`, `AIValidationStatus`, `TranslationStatus`, `SuggestionReason`, `LLMProviderConfig`, `ChatMessage`, `LLMOptions`, `LLMResponse`, `AIConfigResponse`, `AIProviderStatus`, `PromptTemplate`, `EamPromptVariable`, `ObjectSuggestion`, `GenerateParams`, `DescriptionGenerateParams`, `TranslateParams`, `ChatRequest`, `ChatResponse`, `ChatReference`, `EamTranslationEntry`, `SuggestionEntry`
- `packages/shared/src/types/eam-catalog.ts` -- `EamCatalogObjectType`, `CatalogTab`, `EamWidgetType`, `CatalogFilters`, `CatalogItem`, `CatalogResult`, `CatalogFacet`, `FacetValue`, `EamKeyword`, `HomepageLayout`, `HomepageWidget`, `EamWidgetDefinition`, `CatalogDashboardData`, `CatalogDonut`
- `packages/shared/src/types/eam-dashboards.ts` -- `FunctionalFit`, `TechnicalFit`, `SixRStrategy`, `BusinessCriticality`, `FunctionalCoverage`, `StrategicAlignmentLevel`, `CapabilityLifecycleStatus`, `AssessmentDimension`, `AssessmentHistoryEntry`, `CostDashboardData`, `CostCategoryRow`, `CostProviderRow`, `TreemapNode`, `CostTrendPoint`, `PortfolioDistributions`, `DistributionEntry`, `SixROverview`, `PortfolioHealthIndicators`, `ApplicationAssessmentUpdate`, `BulkAssessmentRequest`, `CapabilityAssessmentUpdate`
- `packages/shared/src/types/eam-data-architecture.ts` -- `DataCategory`, `DataClassificationLevel`, `ContextType`, `ContextStatus`, `EamDataObject`, `EamDataObjectCrud`, `CrudMatrixRow`, `CrudMatrixCell`, `DataLineageGraph`, `DataLineageFlow`, `EamContext`, `EamContextAttribute`, `ContextDiff`, `ElementDiff`, `AttributeChange`, `EamOrgUnit`, `EamBusinessContext`, `OrgUnitAppMatrix`, `ItComponentDiagramNode`, `DataObjectDiagramNode`
- `packages/shared/src/types/eam-governance.ts` -- `GovernanceStatus`, `GovernanceAction`, `GovernanceRole`, `BpmnPlacementType`, `BiExportFormat`, `GOVERNANCE_TRANSITIONS`, `GovernanceLogEntry`, `GovernanceTransitionRequest`, `BulkGovernanceRequest`, `GovernanceRoleAssignment`, `BpmnElementPlacement`, `BpmnEamShape`, `BpmnBadge`, `ProcessEamMatrix`, `BiExportQuery`, `BiExportResult`, `ExcelImportPreview`, `ImportPreviewRow`, `ApplicationDetailAccordion`, `ProtectionRequirementDisplay`, `OccurrenceEntry`, `PredecessorInfo`, `LifecycleBarData`, `LifecycleBarPhase`
- `packages/shared/src/types/eam-visualizations.ts` -- `LifecyclePhase`, `GridColoringMode`, `OverlayMode`, `RoadmapGroupBy`, `ContextDiagramSector`, `InsightGridData`, `GridColumn`, `GridRow`, `GridCell`, `ContextDiagramData`, `ContextDiagramNode`, `ContextDiagramEdge`, `RoadmapData`, `RoadmapEntry`, `RoadmapPhase`, `RoadmapGroup`, `RiskPerAppData`, `AppRiskEntry`, `VulnerabilityMonitorData`, `AppVulnerabilityEntry`, `BusinessAlignmentData`, `AlignmentCapability`, `TechnicalAlignmentData`, `NonStandardTech`, `LIFECYCLE_COLORS`
- `packages/shared/src/types/eam.ts` -- `ArchitectureLayer`, `ArchitectureType`, `ArchRelationshipType`, `ElementStatus`, `EamCriticality`, `LifecycleStatus`, `TimeClassification`, `LicenseType`, `DataClassification`, `StrategicImportance`, `ViolationStatus`, `ArchitectureElement`, `ArchitectureRelationship`, `BusinessCapability`, `ApplicationPortfolio`, `ApplicationWithPortfolio`, `ArchitectureRule`, `ArchitectureRuleViolation`, `DiagramNode`, `DiagramEdge`, `SpofResult`, `PortfolioQuadrantData`, `LAYER_TYPE_MAP`
- `packages/shared/src/types/erm-advanced.ts` -- `BowtieElement`, `BowtiePath`, `BowtieData`, `TreatmentMilestone`, `RiskInterconnection`, `RiskEvent`, `RiskEventLesson`, `CascadeSimulationResult`, `InterconnectionHeatmapData`
- `packages/shared/src/types/esg-advanced.ts` -- `MaterialityAssessment`, `MaterialityIro`, `MaterialityStakeholderEngagement`, `EmissionSource`, `EmissionActivityData`, `EmissionFactor`, `CarbonDashboard`, `EsgCollectionCampaign`, `EsgCollectionAssignment`, `SupplierEsgAssessment`, `SupplierEsgCorrectiveAction`, `LksgDueDiligence`, `EsrsDisclosureTemplate`
- `packages/shared/src/types/esg.ts` -- `MaterialityStatus`, `DataQuality`, `TargetType`, `TargetStatus`, `ReportStatus`, `EsgFrequency`, `VoterType`, `EsgControlLink`
- `packages/shared/src/types/event-bus.ts` -- `EntityType`, `ReferenceRelationship`, `ReferenceWithLabel`, `ImpactNode`, `ReferenceStats`, `WebhookTemplateType`, `WebhookDeliveryStatus`, `WebhookStats`
- `packages/shared/src/types/evidence-connector.ts` -- `ConnectorType`, `ConnectorStatus`, `ConnectorAuthMethod`, `ConnectorHealthStatus`, `CredentialType`, `ArtifactType`, `TestResultStatus`, `TestSeverity`, `TestCategory`, `ScheduleRunStatus`, `HealthCheckType`, `FrameworkMappingRef`, `EvidenceConnector`, `ConnectorCredential`, `ConnectorSchedule`, `EvidenceArtifact`, `ConnectorHealthCheck`, `ConnectorTestDefinition`, `ConnectorTestResult`, `TestFinding`, `EvidenceFreshnessConfig`, `ConnectorDashboardStats`
- `packages/shared/src/types/evidence-review.ts` -- `EvidenceReviewScope`, `EvidenceReviewJobStatus`, `EvidenceClassification`, `EvidenceGapType`, `EvidenceGapSeverity`, `EvidenceGapStatus`, `EvidenceRequirementCheck`, `EvidenceReviewSummary`
- `packages/shared/src/types/fair.ts` -- `RiskMethodology`, `FairSimulationStatus`, `LossComponents`, `FAIRParameters`, `FAIRSimulationResult`, `FAIRHistogramBucket`, `FAIRExceedancePoint`, `FAIRSensitivityEntry`, `FAIRTopRisk`, `FAIRAggregateResult`
- `packages/shared/src/types/framework-mapping.ts` -- `FrameworkKey`, `MappingRelationshipType`, `MappingSource`, `MappingRuleType`, `CoverageStatus`, `CoverageSource`, `EvidenceStatus`, `AssessmentResult`, `RiskExposure`, `FrameworkMapping`, `FrameworkMappingRule`, `ControlFrameworkCoverage`, `FrameworkGapAnalysis`, `GapDetail`, `PrioritizedAction`, `FrameworkCoverageSnapshot`, `CrossFrameworkDashboard`
- `packages/shared/src/types/graph.ts` -- `GraphEdgeData`, `GraphMeta`, `GraphScenarioType`, `WhatIfDelta`, `WhatIfResponse`, `GraphEntityType`, `GraphRelationshipType`, `GRAPH_SCENARIO_TYPES`
- `packages/shared/src/types/horizon-scanner.ts` -- `HorizonSourceType`, `HorizonParserType`, `HorizonItemType`, `HorizonClassification`, `HorizonItemStatus`, `HorizonImpactLevel`, `HorizonAssessmentStatus`, `HorizonCalendarEventType`, `HorizonPriority`, `HorizonNlpTopic`, `HorizonNlpEntity`, `HorizonSuggestedControl`, `HorizonImpactAssessment`, `HorizonImpactArea`, `HorizonRequiredAction`
- `packages/shared/src/types/ics-advanced.ts` -- `CCMConnector`, `CCMEvidence`, `SOXScope`, `SOXWalkthrough`, `ControlLibraryEntry`, `ThreeLinesDashboard`, `SOXTestingPlan`
- `packages/shared/src/types/identity-saas-connector.ts` -- `SaasIdentityProvider`, `IdentityTestCategory`, `SaasPlatform`, `SaasCheckType`, `SaasComplianceStatus`, `SyncInterval`, `SyncStatus`, `IdentityConnectorConfig`, `IdentityTestResult`, `IdentityFinding`, `SaasComplianceCheck`, `IdentityDashboardStats`
- `packages/shared/src/types/identity.ts` -- `SsoProviderType`, `IdentityProvider`, `ScimSyncAction`, `ScimSyncStatus`, `OidcClaimMapping`, `SsoConfig`, `ScimToken`, `ScimTokenCreated`, `ScimSyncLogEntry`, `ScimPatchOp`, `ScimListResponse`, `ScimError`, `ScimDashboardStats`
- `packages/shared/src/types/import-export.ts` -- `ImportJobStatus`, `ImportEntityType`, `ExportFormat`, `ImportJob`, `ColumnMappingTemplate`, `ExportSchedule`
- `packages/shared/src/types/intelligence.ts` -- `CesTrend`, `ControlEffectivenessScore`, `FindingSlaConfig`, `RegulatoryFeedItem`, `RegulatoryRelevanceScore`, `AiPromptLog`, `ExecutiveKpiSnapshot`, `ExecutiveKpis`, `CesComputeResult`, `CesOverviewItem`, `AiUsageSummary`
- `packages/shared/src/types/isms-intelligence.ts` -- `CveSeverity`, `CveMatchStatus`, `SoaGapType`, `SoaSuggestionStatus`, `SoaGapPriority`, `RoadmapEffort`, `RoadmapActionStatus`, `CveReference`, `CveFeedItem`, `AssetCpe`, `CveAssetMatch`, `SoaGapAnalysisResult`, `MaturityRoadmapResult`
- `packages/shared/src/types/isms.ts` -- `DependencyType`, `Criticality`, `VulnerabilitySeverity`, `ThreatCategory`, `AssetClassification`, `ProcessAsset`, `RiskScenario`, `AssessmentScopeType`, `ControlMaturity`, `SoaEntry`, `IsmsComplianceScore`
- `packages/shared/src/types/platform-advanced.ts` -- `NotificationPreference`, `SearchResult`, `SearchFacets`, `OrgHierarchyNode`, `OrgHierarchyRollup`, `CustomFieldValidationResult`
- `packages/shared/src/types/platform.ts` -- `OrgType`, `LINES_OF_DEFENSE`, `Organization`, `UserWithRoles`, `TaskPriority`, `Task`, `Invitation`
- `packages/shared/src/types/policy-acknowledgment.ts` -- `PolicyAcknowledgmentStatus`, `QuizQuestion`, `PolicyDistribution`, `PolicyAcknowledgmentRecord`, `PolicyQuizResponseRecord`
- `packages/shared/src/types/predictive-risk.ts` -- `PredictionModelType`, `PredictionAlgorithm`, `PredictionTargetMetric`, `PredictionModelStatus`, `PredictionType`, `PredictionEntityType`, `PredictiveTrendDirection`, `RiskLevel`, `AnomalyType`, `AnomalySeverity`, `AnomalyStatus`, `InputFeature`, `TrainingConfig`, `RiskPrediction`, `ConfidenceInterval`, `ContributingFactor`, `TrendDataPoint`
- `packages/shared/src/types/process.ts` -- `ProcessNotation`, `ProcessVersionType`, `ProcessApprovalStepType`, `ProcessComment`, `ProcessReviewSchedule`, `GovernanceDashboard`, `GovernanceActivityItem`, `GovernanceRoadmapItem`, `BulkOperationResult`
- `packages/shared/src/types/rcsa.ts` -- `RcsaCampaignStatus`, `RcsaCampaignFrequency`, `RcsaAssignmentStatus`, `RcsaEntityType`, `RcsaRiskTrend`, `RcsaControlEffectiveness`, `RcsaDiscrepancyType`, `RcsaTargetScope`, `RcsaCampaign`, `RcsaAssignment`, `RcsaAssignmentWithEntity`, `RcsaResponse`, `RcsaHeatmapCell`, `RcsaTrendComparison`
- `packages/shared/src/types/regulatory-change.ts` -- `RegulatorySourceType`, `RegulatoryChangeType`, `RegulatoryClassification`, `RegulatoryChangeStatus`, `ImpactLevel`, `ImpactAssessmentStatus`, `RegulatoryCalendarEventType`, `CalendarPriority`, `DigestType`, `RegulatoryImpactAssessment`, `ImpactArea`, `AffectedEntity`, `RequiredAction`, `RegulatoryDigest`, `DigestHighlight`, `DigestRecipient`
- `packages/shared/src/types/regulatory-simulator.ts` -- `SimulationGap`, `TimelineMilestone`, `BlockingControl`, `SimulationComparison`
- `packages/shared/src/types/reporting.ts` -- `reportGenerationStatusValues`, `ReportGenerationStatus`, `ThreatFeedType`, `ReportParameterDefinition`, `ReportBrandingConfig`, `ThreatFeedSource`
- `packages/shared/src/types/risk-propagation.ts` -- `PropagationType`, `PropagationResultEntry`, `CorrelationType`, `SharedFactor`, `PropagationSimulationInput`, `PropagationSimulationResult`, `CorrelationMatrixEntry`
- `packages/shared/src/types/risk.ts` -- `KriDirection`, `KriMeasurementFrequency`, `KriMeasurementSource`, `RiskAppetite`
- `packages/shared/src/types/tax-cms.ts` -- `TaxCmsElementType`, `TaxCmsElementStatus`, `TaxType`, `TaxRiskCategory`, `TaxRiskStatus`, `GobdDocumentType`, `GobdArchiveStatus`, `IcfrControlType`, `IcfrProcessArea`, `IcfrAssertion`, `IcfrFrequency`, `IcfrAutomationLevel`, `IcfrTestResult`, `TaxAuditType`, `TaxAuditPrepStatus`, `TaxCmsRequirement`, `TaxAffectedEntity`, `TaxControl`, `TaxDocumentItem`, `TaxOpenItem`, `TaxAuditFinding`
- `packages/shared/src/types/tprm-advanced.ts` -- `VendorScorecard`, `VendorDimensionScores`, `VendorScorecardHistory`, `VendorConcentrationAnalysis`, `VendorSlaDefinition`, `VendorSlaMeasurement`, `VendorExitPlan`, `VendorSubProcessor`, `VendorSubProcessorNotification`, `DoraOutsourcingEntry`
- `packages/shared/src/types/tprm.ts` -- `VendorTier`, `VendorCategory`, `DueDiligenceStatus`, `ContractStatus`, `ContractType`, `ObligationStatus`, `ObligationType`, `Vendor`, `VendorContact`, `VendorRiskAssessment`, `VendorDueDiligence`, `VendorDueDiligenceQuestion`, `Contract`, `ContractObligation`, `ContractAmendment`, `ContractSla`, `ContractSlaMeasurement`, `LksgAssessment`, `QuestionnaireTemplateStatus`, `QuestionType`, `DdSessionStatus`, `QuestionOption`, `ConditionalRule`, `QuestionnaireTemplate`, `QuestionnaireSection`, `QuestionnaireQuestion`, `DdSession`, `DdResponse`, `DdEvidence`
- `packages/shared/src/types/translation.ts` -- `TranslationStatusValue`, `TranslationMethod`, `TranslationStatusRecord`, `TranslationProgress`, `TranslationQueueItem`, `LanguageConfig`, `TranslationHeatmapCell`, `AiTranslateRequest`, `AiTranslateResponse`, `TranslationExportOptions`, `TranslationImportPreview`
- `packages/shared/src/types/whistleblowing-advanced.ts` -- `WbInvestigation`, `WbEvidence`, `WbInterview`, `WbInvestigationLogEntry`, `WbProtectionCase`, `WbProtectionEvent`, `WbOmbudspersonAssignment`, `WbOmbudspersonActivity`, `ConflictCheckResult`, `ChannelAnalytics`, `HinSchGCompliance`
- `packages/shared/src/types/whistleblowing.ts` -- `WbCategory`, `WbCaseStatus`, `WbPriority`, `WbResolutionCategory`, `WbDirection`, `WbAuthorType`, `WbReport`, `WbCase`, `WbCaseMessage`, `WbCaseEvidence`, `WbAnonymousMailbox`, `WbMailboxView`
- `packages/shared/src/url-safety.ts` -- `normalizeNumericIPv4`, `webhookUrlRefine`, `webhookUrlRefineMessage`
- `packages/shared/src/utils/distributions.ts` -- `betaDistribution`
- `packages/shared/src/utils/fair-monte-carlo.ts` -- `LossComponent`, `HistogramBucket`, `ExceedancePoint`, `SensitivityEntry`, `SimulationResult`, `runFAIRSimulation`, `buildHistogram`, `buildExceedanceCurve`, `distributeLossComponents`
- `packages/shared/src/utils/language-resolver.ts` -- `SupportedLanguage`, `TranslatableField`, `ResolveOptions`, `ResolvedEntityMeta`, `resolveEntity`, `resolveEntities`, `wrapTranslatableField`, `getAvailableLanguages`, `TRANSLATION_SOURCE_COLUMNS`, `TRANSLATION_ENTITIES_WITHOUT_SOFT_DELETE`
- `packages/shared/src/utils/xliff.ts` -- `XliffDocument`, `XliffImportResult`
- `packages/shared/src/wb-crypto.ts` -- `wbKeyId`, `assertWbCryptoConfigured`, `ipMatchesHash`
