import { ModuleGate } from "@/components/module/module-gate";
import { Construction } from "lucide-react";

// #NIGHT-052: /financial-reporting/sox 404'd — Sidebar suggested
// SOX Compliance is part of Financial Reporting but no page existed.
// Coming-soon stub avoids the 404 and signals roadmap intent until
// the SOX-specific UI lands.

export default function SoxStubPage() {
  return (
    <ModuleGate moduleKey="reporting">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SOX Compliance</h1>
          <p className="text-sm text-gray-500 mt-1">
            Sarbanes-Oxley §404 ICFR Documentation &amp; Testing
          </p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-16 text-center">
          <Construction size={36} className="text-gray-400 mb-3" />
          <h2 className="text-lg font-semibold text-gray-700">Coming Soon</h2>
          <p className="text-sm text-gray-500 mt-2 max-w-md">
            SOX-spezifische ICFR-Walkthroughs, Management-Assertion-Letters und
            quarterly reporting workflows. Bis dahin nutzen Sie die generischen
            Audit- und Control-Module über die Sidebar.
          </p>
        </div>
      </div>
    </ModuleGate>
  );
}
