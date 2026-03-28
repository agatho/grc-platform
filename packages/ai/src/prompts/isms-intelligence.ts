/**
 * Sprint 26: ISMS Intelligence AI Prompts
 * - SoA Gap Analysis
 * - Maturity Roadmap Generation
 */

import { sanitizeForPrompt } from "@grc/shared";

// ─── SoA Gap Analysis Prompt ─────────────────────────────────

interface SoaGapPromptInput {
  soaData: Array<{
    controlRef: string;
    controlTitle: string;
    applicability: string;
    implementation: string;
    linkedControlTitle?: string;
  }>;
  assetSummary: string;
  processSummary: string;
  riskSummary: string;
  framework: string;
}

export function buildSoaGapPrompt(input: SoaGapPromptInput): string {
  const safeAssets = sanitizeForPrompt(input.assetSummary);
  const safeProcesses = sanitizeForPrompt(input.processSummary);
  const safeRisks = sanitizeForPrompt(input.riskSummary);

  const soaLines = input.soaData
    .map(
      (s) =>
        `- ${sanitizeForPrompt(s.controlRef)}: ${sanitizeForPrompt(s.controlTitle)} | Applicability: ${s.applicability} | Implementation: ${s.implementation}${s.linkedControlTitle ? ` | Linked: ${sanitizeForPrompt(s.linkedControlTitle)}` : ""}`,
    )
    .join("\n");

  return `You are an ISO 27001 auditor performing a Statement of Applicability gap analysis.

## Framework: ${sanitizeForPrompt(input.framework)}

## Current SoA:
${soaLines}

## Organization Assets:
${safeAssets}

## Organization Processes:
${safeProcesses}

## Active Risks:
${safeRisks}

## Task
Identify gaps in the SoA:
1. Controls marked "not_applicable" that SHOULD be applicable given the assets/processes/risks
2. Controls marked "implemented" but without a linked organizational control
3. Controls that appear to have only partial coverage

For each gap found, provide:
- controlRef: the framework control reference (e.g., "A.5.1")
- controlTitle: the framework control title
- gapType: "not_covered" | "partial" | "full"
- confidence: 0-100 (how confident you are about this gap)
- reasoning: brief explanation (max 200 chars)
- priority: "critical" | "high" | "medium" | "low"

Respond ONLY with a JSON array of gap objects. No markdown, no explanation outside the JSON.
Example: [{"controlRef":"A.5.1","controlTitle":"Policies for information security","gapType":"not_covered","confidence":85,"reasoning":"Organization has IT assets but no security policy control linked","priority":"high"}]`;
}

// ─── Maturity Roadmap Prompt ─────────────────────────────────

interface MaturityRoadmapPromptInput {
  maturityData: Array<{
    domain: string;
    currentLevel: number;
    targetLevel: number;
    controlCount: number;
  }>;
  targetMaturity: number;
}

export function buildMaturityRoadmapPrompt(input: MaturityRoadmapPromptInput): string {
  const maturityLines = input.maturityData
    .map(
      (m) =>
        `- ${sanitizeForPrompt(m.domain)}: Current=${m.currentLevel}, Target=${m.targetLevel}, Controls=${m.controlCount}`,
    )
    .join("\n");

  return `You are an ISMS maturity consultant. Analyze the current maturity levels and generate an improvement roadmap.

## Current Maturity by Domain:
${maturityLines}

## Target Maturity: Level ${input.targetMaturity}

## Task
Generate a prioritized roadmap with improvement actions. For each action:
- domain: which Annex A domain/group
- currentLevel: current maturity (1-5)
- targetLevel: target maturity (1-5)
- title: action title (max 100 chars)
- description: specific steps to take (max 300 chars)
- effort: "S" (< 1 FTE-month), "M" (1-3 FTE-months), "L" (> 3 FTE-months)
- effortFteMonths: estimated FTE-months (number)
- priority: 1-100 (1 = highest priority)
- quarter: "Q1" | "Q2" | "Q3" | "Q4" (recommended implementation quarter)
- isQuickWin: true if high impact with low effort

Sort by: quick wins first, then by impact/effort ratio (highest first).

Respond ONLY with a JSON array of action objects. No markdown, no explanation outside the JSON.
Example: [{"domain":"A.5 Organizational Controls","currentLevel":2,"targetLevel":4,"title":"Establish information security policy framework","description":"Define and publish a comprehensive ISMS policy with sub-policies for key domains","effort":"M","effortFteMonths":2.0,"priority":5,"quarter":"Q1","isQuickWin":false}]`;
}

// ─── Response Parsers ────────────────────────────────────────

export interface ParsedSoaGap {
  controlRef: string;
  controlTitle: string;
  gapType: "not_covered" | "partial" | "full";
  confidence: number;
  reasoning: string;
  priority: "critical" | "high" | "medium" | "low";
}

export interface ParsedRoadmapAction {
  domain: string;
  currentLevel: number;
  targetLevel: number;
  title: string;
  description: string;
  effort: "S" | "M" | "L";
  effortFteMonths: number;
  priority: number;
  quarter: string;
  isQuickWin: boolean;
}

/**
 * Parse AI response for SoA gap analysis. Extracts JSON array from text.
 */
export function parseSoaGapResponse(text: string): ParsedSoaGap[] {
  try {
    // Try to extract JSON array from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    const validGapTypes = ["not_covered", "partial", "full"];
    const validPriorities = ["critical", "high", "medium", "low"];

    return parsed
      .filter(
        (item: Record<string, unknown>) =>
          typeof item.controlRef === "string" &&
          typeof item.gapType === "string" &&
          validGapTypes.includes(item.gapType as string),
      )
      .map((item: Record<string, unknown>) => ({
        controlRef: String(item.controlRef).slice(0, 100),
        controlTitle: String(item.controlTitle ?? "").slice(0, 500),
        gapType: item.gapType as ParsedSoaGap["gapType"],
        confidence: Math.max(0, Math.min(100, Number(item.confidence) || 50)),
        reasoning: String(item.reasoning ?? "").slice(0, 2000),
        priority: validPriorities.includes(item.priority as string)
          ? (item.priority as ParsedSoaGap["priority"])
          : "medium",
      }));
  } catch {
    return [];
  }
}

/**
 * Parse AI response for maturity roadmap. Extracts JSON array from text.
 */
export function parseMaturityRoadmapResponse(text: string): ParsedRoadmapAction[] {
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    const validEfforts = ["S", "M", "L"];
    const validQuarters = ["Q1", "Q2", "Q3", "Q4"];

    return parsed
      .filter(
        (item: Record<string, unknown>) =>
          typeof item.domain === "string" &&
          typeof item.title === "string",
      )
      .map((item: Record<string, unknown>) => ({
        domain: String(item.domain).slice(0, 200),
        currentLevel: Math.max(1, Math.min(5, Number(item.currentLevel) || 1)),
        targetLevel: Math.max(1, Math.min(5, Number(item.targetLevel) || 3)),
        title: String(item.title).slice(0, 500),
        description: String(item.description ?? "").slice(0, 2000),
        effort: validEfforts.includes(item.effort as string)
          ? (item.effort as ParsedRoadmapAction["effort"])
          : "M",
        effortFteMonths: Math.max(0, Number(item.effortFteMonths) || 1),
        priority: Math.max(1, Math.min(100, Number(item.priority) || 50)),
        quarter: validQuarters.includes(item.quarter as string)
          ? (item.quarter as string)
          : "Q1",
        isQuickWin: Boolean(item.isQuickWin),
      }));
  } catch {
    return [];
  }
}
