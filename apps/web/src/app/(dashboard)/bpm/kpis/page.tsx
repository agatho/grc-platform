// #NIGHT-047: page rendered as a near-empty stub with "--" KPIs.
// Replaced with an explicit Coming-Soon placeholder so users know
// the feature is on the roadmap rather than broken.

import { ModuleGate } from "@/components/module/module-gate";
import { ModuleTabNav } from "@/components/layout/module-tab-nav";
import { Construction } from "lucide-react";

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
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-16 text-center">
          <Construction size={36} className="text-gray-400 mb-3" />
          <h2 className="text-lg font-semibold text-gray-700">Coming Soon</h2>
          <p className="text-sm text-gray-500 mt-2 max-w-md">
            KPI-Aggregation pro Prozess inkl. Trends &amp; Schwellen-Alarmen.
            Bis dahin nutzen Sie die Prozess-Detailseiten unter{" "}
            <span className="font-mono text-xs">/processes/[id]</span>.
          </p>
        </div>
      </div>
    </ModuleGate>
  );
}
