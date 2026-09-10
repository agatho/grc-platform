// Edge-case tests for AutomationEngine throttling logic.
//
// The existing rule-engine.test.ts only covers the empty-cache case.
// Cooldown + rate-limiting are the user-protection mechanisms — they
// must hold under boundary conditions (just-expired window, exact limit,
// custom durations).

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AutomationEngine } from "../rule-engine";
import type { ActionServices } from "../action-executor";

// [N-2 · Welle 6a] Der db-Mock liefert jetzt STEUERBARE Regeln. Vorher gab
// er immer `[]` zurueck — `handleEvent` hatte damit nichts auszufuehren, der
// Zwischenspeicher blieb leer, und jede Cooldown-Zusicherung war
// gegenstandslos.
const { aktiveRegelnRef } = vi.hoisted(() => ({
  aktiveRegelnRef: { current: [] as unknown[] },
}));

vi.mock("@grc/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn(() => Promise.resolve(aktiveRegelnRef.current)),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue([]),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
  automationRule: {
    id: "id",
    orgId: "org_id",
    isActive: "is_active",
    executionCount: "execution_count",
  },
  automationRuleExecution: {},
}));

const benachrichtigungen: unknown[] = [];

const mockServices: ActionServices = {
  createTask: vi.fn().mockResolvedValue({ id: "task-1" }),
  sendNotification: vi.fn(async (...args: unknown[]) => {
    benachrichtigungen.push(args);
  }),
  sendEmail: vi.fn().mockResolvedValue(undefined),
  changeStatus: vi.fn().mockResolvedValue(undefined),
  escalate: vi.fn().mockResolvedValue(undefined),
  triggerWebhook: vi.fn().mockResolvedValue(undefined),
};

describe("AutomationEngine throttling — boundary cases", () => {
  let engine: AutomationEngine;

  function setAktiveRegeln(rules: unknown[]): void {
    aktiveRegelnRef.current = rules;
  }

  beforeEach(() => {
    engine = new AutomationEngine({ services: mockServices });
    engine.clearCaches();
    benachrichtigungen.length = 0;
    setAktiveRegeln([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── [N-2 · Welle 6a] Diese Suite konnte den Cooldown nie pruefen ─────
  //
  // Jede Zusicherung hier lief gegen einen LEEREN Zwischenspeicher, und bei
  // leerem Speicher gibt `isInCooldown` immer `false` zurueck — unabhaengig
  // davon, was die Methode rechnet. Die Kommentare sagten das sogar selbst
  // („if cache is empty, both return false"). Eine Suite mit dem Titel
  // „boundary cases", die die Grenze nie erreicht.
  //
  // Der Speicher wird deshalb jetzt ueber den OEFFENTLICHEN Weg gefuellt:
  // `handleEvent` fuehrt eine Regel aus und schreibt dabei den Zeitpunkt.
  // Erst danach hat der Cooldown ueberhaupt etwas zu entscheiden.

  function regel(overrides: Record<string, unknown> = {}) {
    return {
      id: "r1",
      orgId: "org-1",
      name: "Testregel",
      isActive: true,
      triggerType: "entity_change",
      triggerConfig: { entityType: "risk", events: ["updated"] },
      conditions: { operator: "AND", rules: [] },
      actions: [{ type: "send_notification", config: {} }],
      cooldownMinutes: 60,
      maxExecutionsPerHour: 100,
      ...overrides,
    };
  }

  function ereignis() {
    return {
      orgId: "org-1",
      eventType: "entity.updated",
      entityType: "risk",
      entityId: "e1",
      payload: { after: { title: "x" } },
      emittedAt: new Date(),
    };
  }

  async function ausfuehren(rule: Record<string, unknown>) {
    setAktiveRegeln([rule]);
    await engine.handleEvent(ereignis() as never);
  }

  describe("isInCooldown liest die konfigurierte Dauer", () => {
    it("haelt einen Treffer unmittelbar nach der Ausfuehrung zurueck", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-05-10T10:00:00Z"));

      await ausfuehren(regel({ cooldownMinutes: 60 }));

      expect(engine.isInCooldown("r1", "e1", 60)).toBe(true);
    });

    it("laesst nach Ablauf der Dauer wieder durch", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-05-10T10:00:00Z"));
      await ausfuehren(regel({ cooldownMinutes: 60 }));
      expect(engine.isInCooldown("r1", "e1", 60)).toBe(true);

      vi.setSystemTime(new Date("2026-05-10T11:00:01Z"));
      expect(engine.isInCooldown("r1", "e1", 60)).toBe(false);
    });

    it("nimmt eine KURZE konfigurierte Dauer ernst (5 statt 60 Minuten)", async () => {
      // Der Defekt: der Produktionspfad rechnete fest mit einer Stunde. Eine
      // Regel mit `cooldown_minutes = 5` feuerte deshalb hoechstens
      // stuendlich — zwoelfmal seltener als konfiguriert.
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-05-10T10:00:00Z"));
      await ausfuehren(regel({ cooldownMinutes: 5 }));

      vi.setSystemTime(new Date("2026-05-10T10:06:00Z"));
      expect(engine.isInCooldown("r1", "e1", 5)).toBe(false);

      // Und der Produktionspfad muss dieselbe Antwort geben: das zweite
      // Ereignis wird ausgefuehrt, nicht als `skipped_cooldown` verworfen.
      benachrichtigungen.length = 0;
      await ausfuehren(regel({ cooldownMinutes: 5 }));
      expect(benachrichtigungen.length).toBe(1);
    });

    it("nimmt eine LANGE konfigurierte Dauer ernst (1440 statt 60 Minuten)", async () => {
      // Die Gegenrichtung: eine Regel mit `cooldown_minutes = 1440` feuerte
      // stuendlich statt einmal am Tag.
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-05-10T10:00:00Z"));
      await ausfuehren(regel({ cooldownMinutes: 1440 }));

      vi.setSystemTime(new Date("2026-05-10T13:00:00Z"));
      expect(engine.isInCooldown("r1", "e1", 1440)).toBe(true);

      benachrichtigungen.length = 0;
      await ausfuehren(regel({ cooldownMinutes: 1440 }));
      expect(benachrichtigungen.length).toBe(0);
    });

    it("faellt ohne gesetzten Wert auf die 60 Minuten der Spalte zurueck", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-05-10T10:00:00Z"));
      await ausfuehren(regel({ cooldownMinutes: null }));

      vi.setSystemTime(new Date("2026-05-10T10:30:00Z"));
      benachrichtigungen.length = 0;
      await ausfuehren(regel({ cooldownMinutes: null }));
      expect(benachrichtigungen.length).toBe(0);

      vi.setSystemTime(new Date("2026-05-10T11:00:01Z"));
      benachrichtigungen.length = 0;
      await ausfuehren(regel({ cooldownMinutes: null }));
      expect(benachrichtigungen.length).toBe(1);
    });

    it("haelt (Regel, Entitaet) auseinander", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-05-10T10:00:00Z"));
      await ausfuehren(regel({ cooldownMinutes: 60 }));

      expect(engine.isInCooldown("r1", "e1", 60)).toBe(true);
      expect(engine.isInCooldown("r1", "e2", 60)).toBe(false);
      expect(engine.isInCooldown("r2", "e1", 60)).toBe(false);
    });
  });

  describe("isRateLimited (1h sliding window)", () => {
    it("returns false when no executions are tracked", () => {
      expect(engine.isRateLimited("r1", 100)).toBe(false);
    });

    it("returns false when maxPerHour is set high (no DOS via 0 limit?)", () => {
      // Edge: maxPerHour=0 — current contract returns false because
      // count starts at 0 and 0 < 0 is false. Documenting this.
      expect(engine.isRateLimited("r1", 0)).toBe(false);
    });

    it("treats different ruleIds as independent rate buckets", () => {
      expect(engine.isRateLimited("rule-A", 1)).toBe(false);
      expect(engine.isRateLimited("rule-B", 1)).toBe(false);
    });
  });

  describe("clearCaches contract", () => {
    it("returns engine to fresh state — cooldown false, rate-limit false", () => {
      engine.clearCaches();
      expect(engine.isInCooldown("any", "any")).toBe(false);
      expect(engine.isInCooldown("any", "any", 5)).toBe(false);
      expect(engine.isRateLimited("any", 100)).toBe(false);
    });

    it("is idempotent — multiple calls do not throw or change state", () => {
      engine.clearCaches();
      engine.clearCaches();
      engine.clearCaches();
      expect(engine.isInCooldown("any", "any")).toBe(false);
    });
  });
});
