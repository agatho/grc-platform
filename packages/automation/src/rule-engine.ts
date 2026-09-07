// Sprint 28: Automation Rule Engine
// Subscribes to Event Bus (Sprint 22), evaluates all active rules per event.
// No polling, no cron — purely event-driven.

import type { GrcEvent } from "@grc/events";
import { db, automationRule, automationRuleExecution } from "@grc/db";
import { eq, and, sql } from "drizzle-orm";
import type {
  AutomationTriggerConfig,
  ConditionGroup,
  AutomationAction,
  AutomationExecutionStatus,
  ActionExecutionResult,
} from "@grc/shared";
import {
  evaluateConditions,
  evaluateConditionsWithTrace,
} from "./condition-evaluator";
import {
  executeActions,
  determineExecutionStatus,
  type ActionServices,
} from "./action-executor";

export interface AutomationEngineOptions {
  services: ActionServices;
}

/**
 * Core automation engine. Evaluates rules against incoming GRC events.
 */
export class AutomationEngine {
  private services: ActionServices;
  private cooldownCache: Map<string, Date> = new Map(); // ruleId:entityId → lastExecution
  private rateCountCache: Map<string, { count: number; windowStart: Date }> =
    new Map(); // ruleId → { count, windowStart }

  constructor(options: AutomationEngineOptions) {
    this.services = options.services;
  }

  /**
   * Handle an incoming GRC event — evaluate all matching active rules.
   * Called by Event Bus subscription.
   */
  async handleEvent(event: GrcEvent): Promise<void> {
    try {
      const rules = await this.getActiveRulesForOrg(event.orgId);

      for (const rule of rules) {
        try {
          await this.evaluateAndExecuteRule(rule, event);
        } catch (err) {
          console.error(`[AutomationEngine] Rule ${rule.id} failed:`, err);
        }
      }
    } catch (err) {
      console.error("[AutomationEngine] Failed to process event:", err);
    }
  }

  /**
   * Evaluate a single rule against an event.
   */
  private async evaluateAndExecuteRule(
    rule: RuleRow,
    event: GrcEvent,
  ): Promise<void> {
    const startTime = Date.now();

    // 1. Check trigger match
    if (!this.matchesTrigger(rule, event)) return;

    // 2. Check cooldown
    // [N-2 · Welle 6a] `rule.cooldownMinutes` wird jetzt tatsaechlich
    // gelesen. Bis hierher rief diese Stelle die Zwei-Argument-Form, die
    // eine Stunde fest verdrahtet hatte — `automation_rule.cooldown_minutes`
    // war damit eine Einstellung ohne Wirkung. Der Fallback 60 ist der
    // DEFAULT der Spalte (`packages/db/src/schema/automation.ts:36`), die
    // NULL zulaesst; die Zeile aendert also fuer eine Regel ohne gesetzten
    // Wert nichts. Die Ratenschranke eine Zeile tiefer hat ihren
    // Konfigurationswert immer schon durchgereicht — genau daran war der
    // Unterschied zu sehen.
    if (
      this.isInCooldown(rule.id, event.entityId, rule.cooldownMinutes ?? 60)
    ) {
      await this.logExecution({
        ruleId: rule.id,
        orgId: event.orgId,
        triggeredByEventId: undefined,
        entityType: event.entityType,
        entityId: event.entityId,
        conditionsMatched: false,
        actionsExecuted: [],
        status: "skipped_cooldown",
        durationMs: Date.now() - startTime,
      });
      return;
    }

    // 3. Check rate limit
    if (this.isRateLimited(rule.id, rule.maxExecutionsPerHour ?? 100)) {
      await this.logExecution({
        ruleId: rule.id,
        orgId: event.orgId,
        triggeredByEventId: undefined,
        entityType: event.entityType,
        entityId: event.entityId,
        conditionsMatched: false,
        actionsExecuted: [],
        status: "skipped_ratelimit",
        durationMs: Date.now() - startTime,
      });
      return;
    }

    // 4. Load entity data (use event payload)
    const entity = (event.payload.after ??
      event.payload.before ??
      {}) as Record<string, unknown>;

    // 5. Evaluate conditions (PURE — no side effects)
    const conditions = rule.conditions as ConditionGroup;
    const conditionsMatched = evaluateConditions(conditions, entity);

    if (!conditionsMatched) {
      // Log non-match only if we want verbose logging (skip for performance)
      return;
    }

    // 6. Execute actions
    const actions = rule.actions as AutomationAction[];
    const results = await executeActions(
      actions,
      {
        orgId: event.orgId,
        entityType: event.entityType,
        entityId: event.entityId,
        entity,
        userId: event.userId,
      },
      this.services,
    );

    const status = determineExecutionStatus(results);

    // 7. Log execution
    await this.logExecution({
      ruleId: rule.id,
      orgId: event.orgId,
      triggeredByEventId: undefined,
      entityType: event.entityType,
      entityId: event.entityId,
      conditionsMatched: true,
      actionsExecuted: results,
      status,
      durationMs: Date.now() - startTime,
    });

    // 8. Update cooldown cache
    this.cooldownCache.set(`${rule.id}:${event.entityId}`, new Date());

    // 9. Update rate limit counter
    this.incrementRateCount(rule.id);

    // 10. Update rule execution stats
    await this.updateRuleStats(rule.id);
  }

  /**
   * Dry-run: evaluate a rule against an entity without executing actions.
   */
  async dryRun(
    ruleId: string,
    orgId: string,
    entityOverride?: {
      entityType: string;
      entityId: string;
      entity: Record<string, unknown>;
    },
  ): Promise<{
    conditionsMatched: boolean;
    trace: unknown;
    wouldExecute: AutomationAction[];
  }> {
    const startTime = Date.now();

    const [rule] = await db
      .select()
      .from(automationRule)
      .where(
        and(eq(automationRule.id, ruleId), eq(automationRule.orgId, orgId)),
      );

    if (!rule) {
      throw new Error("Rule not found");
    }

    const conditions = rule.conditions as ConditionGroup;
    const actions = rule.actions as AutomationAction[];

    // Use provided entity or empty object
    const entity = entityOverride?.entity ?? {};
    const trace = evaluateConditionsWithTrace(conditions, entity);
    const conditionsMatched = trace.matched;

    // Log as dry_run
    await this.logExecution({
      ruleId: rule.id,
      orgId,
      triggeredByEventId: undefined,
      entityType: entityOverride?.entityType ?? null,
      entityId: entityOverride?.entityId ?? null,
      conditionsMatched,
      actionsExecuted: [],
      status: "dry_run",
      durationMs: Date.now() - startTime,
    });

    return {
      conditionsMatched,
      trace,
      wouldExecute: conditionsMatched ? actions : [],
    };
  }

  /**
   * Check if a rule's trigger matches the incoming event.
   */
  private matchesTrigger(rule: RuleRow, event: GrcEvent): boolean {
    if (rule.triggerType !== "entity_change") return false;

    const config = rule.triggerConfig as AutomationTriggerConfig;

    // Check entity type match
    if (config.entityType && config.entityType !== event.entityType) {
      return false;
    }

    // Check event type match
    if (config.events && config.events.length > 0) {
      const eventAction = event.eventType.replace("entity.", "");
      if (!config.events.includes(eventAction as never)) {
        return false;
      }
    }

    // Check field change (if specified)
    if (config.field && event.payload.changedFields) {
      if (!event.payload.changedFields.includes(config.field)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if a rule is in cooldown for a given entity.
   *
   * [N-2 · Welle 6a] Vorher standen hier ZWEI Methoden: `isInCooldown`
   * (eine Stunde fest verdrahtet, mit dem Kommentar „Default cooldown:
   * check against rule (retrieved from DB inline) / For now use the cache
   * timestamp approach") und `isInCooldownWithMinutes`, die den
   * konfigurierten Wert nahm. Der Produktionspfad rief die erste, und die
   * zweite hatte ausserhalb der Tests keinen Aufrufer —
   * `automation_rule.cooldown_minutes` war eine Einstellung ohne Wirkung.
   * Zwei Methoden fuer dieselbe Frage sind die Ursache; deshalb steht hier
   * nur noch eine.
   *
   * Bewusst NICHT geaendert: der Zwischenspeicher ist prozesslokal. Bei
   * mehreren Worker-Containern gilt die Sperre je Prozess, nicht je Regel.
   * Eine belastbare Sperre laege in `automation_rule_execution`
   * (`gte(executedAt, jetzt - cooldown)`) und ist ein eigener Umbau.
   */
  isInCooldown(
    ruleId: string,
    entityId: string,
    cooldownMinutes = 60,
  ): boolean {
    const key = `${ruleId}:${entityId}`;
    const lastExec = this.cooldownCache.get(key);
    if (!lastExec) return false;

    const cooldownMs = cooldownMinutes * 60 * 1000;
    return Date.now() - lastExec.getTime() < cooldownMs;
  }

  /**
   * Check if a rule has exceeded its rate limit.
   */
  isRateLimited(ruleId: string, maxPerHour: number): boolean {
    const entry = this.rateCountCache.get(ruleId);
    if (!entry) return false;

    // Check if the window has expired (1 hour)
    const windowMs = 60 * 60 * 1000;
    if (Date.now() - entry.windowStart.getTime() > windowMs) {
      this.rateCountCache.delete(ruleId);
      return false;
    }

    return entry.count >= maxPerHour;
  }

  /**
   * Increment rate limit counter for a rule.
   */
  private incrementRateCount(ruleId: string): void {
    const entry = this.rateCountCache.get(ruleId);
    const windowMs = 60 * 60 * 1000;

    if (!entry || Date.now() - entry.windowStart.getTime() > windowMs) {
      this.rateCountCache.set(ruleId, {
        count: 1,
        windowStart: new Date(),
      });
    } else {
      entry.count++;
    }
  }

  /**
   * Fetch all active rules for a given org.
   */
  private async getActiveRulesForOrg(orgId: string): Promise<RuleRow[]> {
    return db
      .select()
      .from(automationRule)
      .where(
        and(eq(automationRule.orgId, orgId), eq(automationRule.isActive, true)),
      );
  }

  /**
   * Log an execution to the automation_rule_execution table.
   */
  private async logExecution(params: {
    ruleId: string;
    orgId: string;
    triggeredByEventId?: string | undefined;
    entityType?: string | null;
    entityId?: string | null;
    conditionsMatched: boolean;
    actionsExecuted: ActionExecutionResult[];
    status: AutomationExecutionStatus;
    durationMs: number;
    errorMessage?: string;
  }): Promise<void> {
    try {
      await db.insert(automationRuleExecution).values({
        ruleId: params.ruleId,
        orgId: params.orgId,
        triggeredByEventId: params.triggeredByEventId ?? null,
        entityType: params.entityType ?? null,
        entityId: params.entityId ?? null,
        conditionsMatched: params.conditionsMatched,
        actionsExecuted: params.actionsExecuted,
        status: params.status,
        durationMs: params.durationMs,
        errorMessage: params.errorMessage,
      });
    } catch (err) {
      console.error("[AutomationEngine] Failed to log execution:", err);
    }
  }

  /**
   * Update the rule's execution count and last_executed_at.
   */
  private async updateRuleStats(ruleId: string): Promise<void> {
    try {
      await db
        .update(automationRule)
        .set({
          executionCount: sql`${automationRule.executionCount} + 1`,
          lastExecutedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(automationRule.id, ruleId));
    } catch (err) {
      console.error("[AutomationEngine] Failed to update rule stats:", err);
    }
  }

  /**
   * Clear internal caches (for testing).
   */
  clearCaches(): void {
    this.cooldownCache.clear();
    this.rateCountCache.clear();
  }
}

// Internal type for rule rows from DB
type RuleRow = typeof automationRule.$inferSelect;
