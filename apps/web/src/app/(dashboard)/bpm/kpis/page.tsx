// #WAVE14-NIGHT-047: previous stub had only ~80 chars of content above
// the Coming-Soon box, so QA flagged it as "near-empty". Expanded with a
// roadmap section + a "what works today" workaround block listing the
// existing process endpoints — same Coming-Soon pattern as
// /financial-reporting/sox but with substantially more user guidance so
// the page is actually informative, not just non-broken.

import { ModuleGate } from "@/components/module/module-gate";
import { ModuleTabNav } from "@/components/layout/module-tab-nav";
import { Construction } from "lucide-react";
import Link from "next/link";

export default function Page() {
  return (
    <ModuleGate moduleKey="bpm">
      <ModuleTabNav />
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Prozess-KPIs</h1>
          <p className="text-sm text-gray-500 mt-1">
            Cycle Time, Throughput, First-Pass-Yield, Cost-per-Instance
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-2">
            Geplante Funktionen
          </h2>
          <ul className="text-sm text-gray-600 list-disc pl-5 space-y-1">
            <li>
              KPI-Aggregation pro Prozess: Durchlaufzeit, Throughput,
              First-Pass-Yield und Kosten pro Instanz
            </li>
            <li>
              Schwellen-Alarme an Prozess-Eigentümer bei Überschreitung
              definierter SLA-Grenzen
            </li>
            <li>
              Trend-Charts (4 / 12 / 52 Wochen) mit Vergleich gegen die Baseline
              aus dem letzten Audit
            </li>
            <li>
              Drill-down von Aggregat-KPI bis auf einzelne Prozess-Instanz und
              auslösendes Event
            </li>
          </ul>
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-5">
          <h2 className="text-base font-semibold text-blue-900 mb-2">
            Was bereits heute funktioniert
          </h2>
          <ul className="text-sm text-blue-800 space-y-2">
            <li>
              <Link
                href="/processes"
                className="font-medium underline underline-offset-2"
              >
                Prozess-Übersicht
              </Link>{" "}
              — Status, Owner und Maturity je Prozess
            </li>
            <li>
              <Link
                href="/bpm/governance"
                className="font-medium underline underline-offset-2"
              >
                BPM-Governance
              </Link>{" "}
              — Reifegrad-Bewertungen und Process-Charter pro Domain
            </li>
            <li>
              REST-API:{" "}
              <span className="font-mono text-xs">
                GET /api/v1/processes/[id]
              </span>{" "}
              liefert das vollständige Prozess-Modell inkl. RACI und
              Schritt-Metriken
            </li>
          </ul>
        </div>

        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-12 text-center">
          <Construction size={32} className="text-gray-400 mb-3" />
          <h2 className="text-lg font-semibold text-gray-700">
            Aggregierte Sicht: Coming Soon
          </h2>
          <p className="text-sm text-gray-500 mt-2 max-w-md">
            Die rollup-Sicht über alle Prozesse und Domain-Vergleiche landet in
            einer der nächsten Wellen. Bis dahin nutzen Sie die
            Prozess-Detailseiten oben.
          </p>
        </div>
      </div>
    </ModuleGate>
  );
}
