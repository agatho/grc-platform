// Sprint 37: Interface Health Check Worker
// Runs every 15 minutes — checks health_check_url for all interfaces

import { db, applicationInterface } from "@grc/db";
import { isNotNull, eq } from "drizzle-orm";
import {
  checkResolvedHostIsPublic,
  fetchResolvedHost,
  type ResolvedAddress,
} from "@grc/shared/lib/url-safety-server";
import { withCronInstrumentation } from "../lib/cron-instrument";

export const processInterfaceHealthCheck = withCronInstrumentation(
  "interface-health-check",
  async (): Promise<{
    checked: number;
    active: number;
    degraded: number;
    down: number;
  }> => {
    const interfaces = await db
      .select()
      .from(applicationInterface)
      .where(isNotNull(applicationInterface.healthCheckUrl));

    let active = 0;
    let degraded = 0;
    let down = 0;

    // Execute checks in parallel with 5-second timeout
    const results = await Promise.allSettled(
      interfaces.map(async (iface) => {
        const url = iface.healthCheckUrl!;

        // Validate URL (reject private IPs)
        // [OP-112] Das Ergebnis der Pruefung wird gebraucht, nicht nur
        // ihr Ja/Nein: die geprueften Adressen gehen als Pin in den
        // `fetch`. Deshalb steht es ausserhalb des try-Blocks.
        let checked: readonly ResolvedAddress[];
        try {
          const parsed = new URL(url);
          if (parsed.protocol !== "https:") {
            return {
              id: iface.id,
              status: "down" as const,
              previousStatus: iface.healthStatus,
            };
          }
          // #SEC-HIGH-SSRF: previously a hand-rolled regex on the literal
          // hostname. Missed IPv6 entirely, CGNAT (100.64.0.0/10), the
          // link-local space (169.254/16 — incl. AWS/GCP metadata
          // endpoint), and any DNS-name that resolves to a private IP.
          // Now using checkResolvedHostIsPublic from @grc/shared which
          // does an actual DNS lookup + checks every resolved address.
          const hostname = parsed.hostname;
          const safetyCheck = await checkResolvedHostIsPublic(hostname);
          if (!safetyCheck.ok) {
            return {
              id: iface.id,
              status: "down" as const,
              previousStatus: iface.healthStatus,
            };
          }
          checked = safetyCheck.addresses;
        } catch {
          return {
            id: iface.id,
            status: "down" as const,
            previousStatus: iface.healthStatus,
          };
        }

        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);

          // [OP-112] Auf die geprueften Adressen festgenagelt. Ohne Pin
          // loest `fetch` erneut auf; ein Resolver, der danach umschwenkt,
          // haette die Pruefung darueber vollstaendig umgangen.
          const response = await fetchResolvedHost(
            url,
            { addresses: checked },
            { method: "HEAD", signal: controller.signal },
          );
          clearTimeout(timeout);

          const status = response.status;
          if (status >= 200 && status < 300) {
            return {
              id: iface.id,
              status: "active" as const,
              previousStatus: iface.healthStatus,
            };
          } else if (status >= 500) {
            return {
              id: iface.id,
              status: "degraded" as const,
              previousStatus: iface.healthStatus,
            };
          }
          return {
            id: iface.id,
            status: "active" as const,
            previousStatus: iface.healthStatus,
          };
        } catch {
          return {
            id: iface.id,
            status: "down" as const,
            previousStatus: iface.healthStatus,
          };
        }
      }),
    );

    // Update statuses
    for (const result of results) {
      if (result.status === "fulfilled") {
        const { id, status } = result.value;
        await db
          .update(applicationInterface)
          .set({ healthStatus: status, lastHealthCheck: new Date() })
          .where(eq(applicationInterface.id, id));

        if (status === "active") active++;
        else if (status === "degraded") degraded++;
        else down++;

        // ── [N-2 · Welle 6a] Der Satz, der hier stand, war falsch ──────
        //
        // „real notification dispatch happens in the interface-notification
        // cron downstream". Gemessen am 2026-09-07:
        //
        //   $ grep -rn "interface-notification" --include=*.ts apps packages
        //   apps/worker/src/crons/interface-health-check.ts:129  (dieser Satz)
        //   $ ls apps/worker/src/crons/ | grep -i interface
        //   interface-health-check.ts
        //
        // Es gibt keinen solchen Cron und keinen Eintrag dafuer in
        // `JOB_REGISTRY`. `previousStatus` wurde von den drei Rueckgabewegen
        // oben mitgefuehrt, hier entnommen — und fallen gelassen. Faellt eine
        // Anwendungsschnittstelle aus, erfaehrt es niemand; die Zahl steht nur
        // im Sammelergebnis des Laufs.
        //
        // Die Entnahme ist entfernt (sie tat nichts). Die Felder auf dem
        // Rueckgabewert bleiben — sie sind genau das, was ein Versand
        // braeuchte. Der Befund steht in `docs/UMSETZUNG-WELLE-6A.md` §5:
        // wer benachrichtigt werden soll, ist eine fachliche Festlegung.
      }
    }

    return { checked: interfaces.length, active, degraded, down };
  },
);
