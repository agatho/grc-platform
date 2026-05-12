// #NIGHT-047: page rendered as a near-empty stub. Coming-Soon
// placeholder so users know process mining is on the roadmap.

import { ModuleGate } from "@/components/module/module-gate";
import { ModuleTabNav } from "@/components/layout/module-tab-nav";
import { Construction } from "lucide-react";

export default function Page() {
  return (
    <ModuleGate moduleKey="bpm">
      <ModuleTabNav />
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Process Mining</h1>
          <p className="text-sm text-gray-500 mt-1">
            Event-Log-Analyse, Conformance Checking, Bottleneck Detection
          </p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-16 text-center">
          <Construction size={36} className="text-gray-400 mb-3" />
          <h2 className="text-lg font-semibold text-gray-700">Coming Soon</h2>
          <p className="text-sm text-gray-500 mt-2 max-w-md">
            XES-Import, Disco-/Celonis-kompatible Process-Mining-Pipeline.
            Aktuell beta — Kontakt:{" "}
            <span className="font-mono text-xs">support@arctos.dev</span>.
          </p>
        </div>
      </div>
    </ModuleGate>
  );
}
