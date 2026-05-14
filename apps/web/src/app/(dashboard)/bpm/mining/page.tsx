// #WAVE14-NIGHT-047: see /bpm/kpis/page.tsx — same expansion rationale.

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
          <h1 className="text-2xl font-bold">Process Mining</h1>
          <p className="text-sm text-gray-500 mt-1">
            Event-Log-Analyse, Conformance Checking, Bottleneck Detection
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-2">
            Geplante Funktionen
          </h2>
          <ul className="text-sm text-gray-600 list-disc pl-5 space-y-1">
            <li>
              XES-Import (IEEE 1849) für Event-Logs aus SAP, Salesforce, JIRA
              und beliebigen REST-Quellen via Konnektoren
            </li>
            <li>
              Conformance Checking gegen das modellierte BPMN — Soll-Ist-
              Abweichungen pro Aktivität und Variant
            </li>
            <li>
              Bottleneck Detection auf Basis der mittleren Wartezeit pro
              Prozess-Schritt
            </li>
            <li>
              Disco-/Celonis-kompatibler Export (PNML, XES) für die Übergabe an
              existierende Mining-Tools
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
                Prozess-Modellierung
              </Link>{" "}
              — BPMN-Editor mit RACI, Step-Approvals und Versioning
            </li>
            <li>
              <Link
                href="/audit-log"
                className="font-medium underline underline-offset-2"
              >
                Audit-Log
              </Link>{" "}
              — die hash-chain-gesicherte Event-History, die das Mining später
              konsumieren wird
            </li>
            <li>
              REST-API:{" "}
              <span className="font-mono text-xs">
                GET /api/v1/processes/[id]/instances
              </span>{" "}
              liefert die laufenden Instanzen einer Prozess-Definition
            </li>
          </ul>
        </div>

        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-12 text-center">
          <Construction size={32} className="text-gray-400 mb-3" />
          <h2 className="text-lg font-semibold text-gray-700">
            Mining-Pipeline: Coming Soon
          </h2>
          <p className="text-sm text-gray-500 mt-2 max-w-md">
            Die Mining-Pipeline ist derzeit beta. Kontakt für Pilot-Zugang:{" "}
            <span className="font-mono text-xs">support@arctos.dev</span>.
          </p>
        </div>
      </div>
    </ModuleGate>
  );
}
