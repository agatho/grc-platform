import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as platform from "./schema/platform";
import * as risk from "./schema/risk";
import * as processSchema from "./schema/process";
import * as taskSchema from "./schema/task";
import * as moduleSchema from "./schema/module";
import * as assetSchema from "./schema/asset";
import * as workItemSchema from "./schema/work-item";
import * as controlSchema from "./schema/control";
import * as documentSchema from "./schema/document";
import * as catalogSchema from "./schema/catalog";
import * as ismsSchema from "./schema/isms";
import * as bcmsSchema from "./schema/bcms";
import * as dpmsSchema from "./schema/dpms";
import * as auditMgmtSchema from "./schema/audit-mgmt";
import * as tprmSchema from "./schema/tprm";
import * as supplierPortalSchema from "./schema/supplier-portal";
import * as esgSchema from "./schema/esg";
import * as intelligenceSchema from "./schema/intelligence";
import * as whistleblowingSchema from "./schema/whistleblowing";
import * as budgetSchema from "./schema/budget";
import * as brandingSchema from "./schema/branding";
import * as rcsaSchema from "./schema/rcsa";
import * as policyAcknowledgmentSchema from "./schema/policy-acknowledgment";
import * as playbookSchema from "./schema/playbook";
import * as calendarSchema from "./schema/calendar";
import * as dashboardSchema from "./schema/dashboard";
import * as importExportSchema from "./schema/import-export";
import * as identitySchema from "./schema/identity";
import * as translationSchema from "./schema/translation";
import * as eventBusSchema from "./schema/event-bus";
import * as boardKpiSchema from "./schema/board-kpi";
import * as nis2CertificationSchema from "./schema/nis2-certification";
import * as fairSchema from "./schema/fair";
import * as ismsIntelligenceSchema from "./schema/isms-intelligence";
import * as complianceCultureSchema from "./schema/compliance-culture";
import * as automationSchema from "./schema/automation";
import * as reportingSchema from "./schema/reporting";
import * as regulatorySimulatorSchema from "./schema/regulatory-simulator";
import * as riskPropagationSchema from "./schema/risk-propagation";
import * as auditAnalyticsSchema from "./schema/audit-analytics";
import * as abacSchema from "./schema/abac";
import * as agentsSchema from "./schema/agents";
import * as eamSchema from "./schema/eam";
import * as eamAdvancedSchema from "./schema/eam-advanced";
import * as platformAdvancedSchema from "./schema/platform-advanced";
import * as ermAdvancedSchema from "./schema/erm-advanced";
import * as icsAdvancedSchema from "./schema/ics-advanced";
import * as bcmsAdvancedSchema from "./schema/bcms-advanced";
import * as dpmsAdvancedSchema from "./schema/dpms-advanced";
import * as auditAdvancedSchema from "./schema/audit-advanced";
import * as tprmAdvancedSchema from "./schema/tprm-advanced";
import * as esgAdvancedSchema from "./schema/esg-advanced";
import * as whistleblowingAdvancedSchema from "./schema/whistleblowing-advanced";
import * as bpmAdvancedSchema from "./schema/bpm-advanced";
import * as eamDashboardsSchema from "./schema/eam-dashboards";
import * as eamDataArchitectureSchema from "./schema/eam-data-architecture";
import * as eamAiSchema from "./schema/eam-ai";
import * as eamCatalogSchema from "./schema/eam-catalog";
import * as eamGovernanceSchema from "./schema/eam-governance";
import * as riskEvaluationSchema from "./schema/risk-evaluation";
import * as incidentTimelineSchema from "./schema/incident-timeline";
import * as processRaciSchema from "./schema/process-raci";
import * as apiPlatformSchema from "./schema/api-platform";
import * as extensionSchema from "./schema/extension";
import * as onboardingSchema from "./schema/onboarding";
import * as mobileSchema from "./schema/mobile";
import * as saasMeteringSchema from "./schema/saas-metering";
import * as evidenceConnectorSchema from "./schema/evidence-connector";
import * as cloudConnectorSchema from "./schema/cloud-connector";
import * as identitySaasConnectorSchema from "./schema/identity-saas-connector";
import * as devopsConnectorSchema from "./schema/devops-connector";
import * as frameworkMappingSchema from "./schema/framework-mapping";
import * as copilotChatSchema from "./schema/copilot-chat";
import * as evidenceReviewSchema from "./schema/evidence-review";
import * as regulatoryChangeSchema from "./schema/regulatory-change";
import * as controlTestingAgentSchema from "./schema/control-testing-agent";
import * as predictiveRiskSchema from "./schema/predictive-risk";
import * as doraSchema from "./schema/dora";
import * as aiActSchema from "./schema/ai-act";
import * as taxCmsSchema from "./schema/tax-cms";
import * as horizonScannerSchema from "./schema/horizon-scanner";
import * as certWizardSchema from "./schema/cert-wizard";
// Sprint 77: Embedded BI und Report Builder
import * as biReportingSchema from "./schema/bi-reporting";
// Sprint 78: GRC Benchmarking und Maturity Model
import * as benchmarkingSchema from "./schema/benchmarking";
// Sprint 79: Unified Risk Quantification Dashboard
import * as riskQuantificationSchema from "./schema/risk-quantification";
// Sprint 80: Multi-Region Deployment und Data Sovereignty
import * as dataSovereigntySchema from "./schema/data-sovereignty";
// Sprint 81: Role-Based Experience Redesign
import * as roleDashboardsSchema from "./schema/role-dashboards";
// Sprint 82: Integration Marketplace
import * as marketplaceSchema from "./schema/marketplace";
// Sprint 83: External Stakeholder Portals
import * as stakeholderPortalSchema from "./schema/stakeholder-portal";
// Sprint 84: GRC Academy und Awareness
import * as academySchema from "./schema/academy";
// Sprint 85: Simulation und Scenario Engine
import * as simulationSchema from "./schema/simulation";
// Sprint 86: Community Edition und Open-Source Packaging
import * as communitySchema from "./schema/community";

const client = postgres(process.env.DATABASE_URL!);
export const db = drizzle(client, {
  schema: { ...platform, ...risk, ...processSchema, ...taskSchema, ...moduleSchema, ...assetSchema, ...workItemSchema, ...controlSchema, ...documentSchema, ...catalogSchema, ...ismsSchema, ...bcmsSchema, ...dpmsSchema, ...auditMgmtSchema, ...tprmSchema, ...supplierPortalSchema, ...esgSchema, ...intelligenceSchema, ...whistleblowingSchema, ...budgetSchema, ...brandingSchema, ...rcsaSchema, ...policyAcknowledgmentSchema, ...playbookSchema, ...calendarSchema, ...dashboardSchema, ...importExportSchema, ...identitySchema, ...translationSchema, ...eventBusSchema, ...boardKpiSchema, ...nis2CertificationSchema, ...fairSchema, ...ismsIntelligenceSchema, ...complianceCultureSchema, ...automationSchema, ...reportingSchema, ...regulatorySimulatorSchema, ...riskPropagationSchema, ...auditAnalyticsSchema, ...abacSchema, ...agentsSchema, ...eamSchema, ...eamAdvancedSchema, ...platformAdvancedSchema, ...ermAdvancedSchema, ...icsAdvancedSchema, ...bcmsAdvancedSchema, ...dpmsAdvancedSchema, ...auditAdvancedSchema, ...tprmAdvancedSchema, ...esgAdvancedSchema, ...whistleblowingAdvancedSchema, ...bpmAdvancedSchema, ...eamDashboardsSchema, ...eamDataArchitectureSchema, ...eamAiSchema, ...eamCatalogSchema, ...eamGovernanceSchema, ...riskEvaluationSchema, ...incidentTimelineSchema, ...processRaciSchema, ...apiPlatformSchema, ...extensionSchema, ...onboardingSchema, ...mobileSchema, ...saasMeteringSchema, ...evidenceConnectorSchema, ...cloudConnectorSchema, ...identitySaasConnectorSchema, ...devopsConnectorSchema, ...frameworkMappingSchema, ...copilotChatSchema, ...evidenceReviewSchema, ...regulatoryChangeSchema, ...controlTestingAgentSchema, ...predictiveRiskSchema, ...doraSchema, ...aiActSchema, ...taxCmsSchema, ...horizonScannerSchema, ...certWizardSchema, ...biReportingSchema, ...benchmarkingSchema, ...riskQuantificationSchema, ...dataSovereigntySchema, ...roleDashboardsSchema, ...marketplaceSchema, ...stakeholderPortalSchema, ...academySchema, ...simulationSchema, ...communitySchema },
});

export type Database = typeof db;
export * from "./schema/platform";
export * from "./schema/risk";
export * from "./schema/process";
export * from "./schema/task";
export * from "./schema/module";
export * from "./schema/asset";
export * from "./schema/work-item";
export * from "./schema/control";
export * from "./schema/document";
export * from "./schema/catalog";
export * from "./schema/isms";
export * from "./schema/bcms";
export * from "./schema/dpms";
export * from "./schema/audit-mgmt";
export * from "./schema/tprm";
export * from "./schema/supplier-portal";
export * from "./schema/esg";
export * from "./schema/intelligence";
export * from "./schema/whistleblowing";
export * from "./schema/budget";
export * from "./schema/branding";
export * from "./schema/rcsa";
export * from "./schema/policy-acknowledgment";
export * from "./schema/playbook";
export * from "./schema/calendar";
export * from "./schema/dashboard";
export * from "./schema/import-export";
export * from "./schema/identity";
export * from "./schema/translation";
export * from "./schema/event-bus";
export * from "./schema/board-kpi";
export * from "./schema/nis2-certification";
export * from "./schema/fair";
export * from "./schema/isms-intelligence";
export * from "./schema/compliance-culture";
export * from "./schema/automation";
export * from "./schema/reporting";
export * from "./schema/regulatory-simulator";
export * from "./schema/risk-propagation";
export * from "./schema/audit-analytics";
export * from "./schema/abac";
export * from "./schema/agents";
export * from "./schema/eam";
export * from "./schema/eam-advanced";
export * from "./schema/platform-advanced";
export * from "./schema/erm-advanced";
export * from "./schema/ics-advanced";
export * from "./schema/bcms-advanced";
export * from "./schema/dpms-advanced";
export * from "./schema/audit-advanced";
export * from "./schema/tprm-advanced";
export * from "./schema/esg-advanced";
export * from "./schema/whistleblowing-advanced";
export * from "./schema/bpm-advanced";
export * from "./schema/eam-dashboards";
export * from "./schema/eam-data-architecture";
export * from "./schema/eam-ai";
export * from "./schema/eam-catalog";
export * from "./schema/eam-governance";
export * from "./schema/risk-evaluation";
export * from "./schema/incident-timeline";
export * from "./schema/process-raci";
export * from "./schema/api-platform";
export * from "./schema/extension";
export * from "./schema/onboarding";
export * from "./schema/mobile";
export * from "./schema/saas-metering";
export * from "./schema/evidence-connector";
export * from "./schema/cloud-connector";
export * from "./schema/identity-saas-connector";
export * from "./schema/devops-connector";
export * from "./schema/framework-mapping";
export * from "./schema/copilot-chat";
export * from "./schema/evidence-review";
export * from "./schema/regulatory-change";
export * from "./schema/control-testing-agent";
export * from "./schema/predictive-risk";
export * from "./schema/dora";
export * from "./schema/ai-act";
export * from "./schema/tax-cms";
export * from "./schema/horizon-scanner";
export * from "./schema/cert-wizard";
// Sprint 77: Embedded BI und Report Builder
export * from "./schema/bi-reporting";
// Sprint 78: GRC Benchmarking und Maturity Model
export * from "./schema/benchmarking";
// Sprint 79: Unified Risk Quantification Dashboard
export * from "./schema/risk-quantification";
// Sprint 80: Multi-Region Deployment und Data Sovereignty
export * from "./schema/data-sovereignty";
// Sprint 81: Role-Based Experience Redesign
export * from "./schema/role-dashboards";
// Sprint 82: Integration Marketplace
export * from "./schema/marketplace";
// Sprint 83: External Stakeholder Portals
export * from "./schema/stakeholder-portal";
// Sprint 84: GRC Academy und Awareness
export * from "./schema/academy";
// Sprint 85: Simulation und Scenario Engine
export * from "./schema/simulation";
// Sprint 86: Community Edition und Open-Source Packaging
export * from "./schema/community";
