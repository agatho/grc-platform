"use client";

import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import {
  Loader2,
  Play,
  Heart,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDateFormat } from "@/lib/format-date";

interface Connector {
  id: string;
  name: string;
  description?: string | null;
  connectorType: string;
  providerKey: string;
  version: string;
  status: string;
  authMethod: string;
  baseUrl?: string | null;
  healthStatus: string;
  lastHealthCheck?: string | null;
  errorMessage?: string | null;
  createdAt: string;
}

interface TestResult {
  id: string;
  testName: string;
  testKey: string;
  category: string;
  severity: string;
  status: string;
  resourcesScanned: number;
  resourcesFailed: number;
  durationMs: number;
  executedAt: string;
}

export default function ConnectorDetailPage() {
  const t = useTranslations("connectors");
  const { formatDateTime } = useDateFormat();
  const params = useParams();
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const id = params.id as string;

  // [OP-245 · Gestalt A] Abruf beim Einhängen über `@tanstack/react-query`
  // statt Effekt plus gespiegeltem Lade- und Datenzustand (Muster aus
  // Welle 7b, `catalogs/objects/page.tsx`). Beide Anfragen liefen immer
  // zusammen und werden zusammen gelesen, daher eine Abfrage mit einem
  // Ergebnisobjekt. Eine nicht-ok-Antwort liefert wie vorher den
  // Ausgangswert (null bzw. leere Liste).
  const {
    data,
    isPending: loading,
    refetch,
  } = useQuery<{ connector: Connector | null; testResults: TestResult[] }>({
    queryKey: ["connectors", "detail", id],
    queryFn: async () => {
      const [connRes, resultsRes] = await Promise.all([
        fetch(`/api/v1/connectors/${id}`),
        fetch(`/api/v1/connectors/${id}/test-results?limit=20`),
      ]);
      let connector: Connector | null = null;
      let testResults: TestResult[] = [];
      if (connRes.ok) {
        const json = await connRes.json();
        connector = json.data as Connector;
      }
      if (resultsRes.ok) {
        const json = await resultsRes.json();
        testResults = (json.data ?? []) as TestResult[];
      }
      return { connector, testResults };
    },
  });
  const connector = data?.connector ?? null;
  const testResults = data?.testResults ?? [];

  const fetchData = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const runTests = async () => {
    setRunning(true);
    try {
      await fetch(`/api/v1/connectors/${id}/test-run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      await fetchData();
    } finally {
      setRunning(false);
    }
  };

  const runHealthCheck = async () => {
    setChecking(true);
    try {
      await fetch(`/api/v1/connectors/${id}/health`, { method: "POST" });
      await fetchData();
    } finally {
      setChecking(false);
    }
  };

  const deleteConnector = async () => {
    if (!confirm(t("detail.confirmDelete"))) return;
    setDeleteError(null);
    const res = await fetch(`/api/v1/connectors/${id}`, { method: "DELETE" });
    // [ARCTOS-FULL-2026-08-31 · Welle 8b] Hier stand `if (res.ok)` ohne
    // `else` — dieselbe Signatur wie OP-216/OP-217. Eine abgelehnte Antwort
    // (403, 409, 500) wertete niemand aus: der Nutzer drueckte „Loeschen",
    // nichts geschah, und nichts sagte ihm warum.
    if (res.ok) {
      router.push("/connectors");
      return;
    }
    setDeleteError(t("detail.deleteFailed"));
  };

  const healthIcon: Record<string, React.ReactNode> = {
    healthy: <CheckCircle2 size={16} className="text-green-600" />,
    degraded: <AlertTriangle size={16} className="text-yellow-600" />,
    unhealthy: <XCircle size={16} className="text-red-600" />,
    unknown: <Heart size={16} className="text-gray-400" />,
  };

  const statusColor: Record<string, string> = {
    pass: "bg-green-100 text-green-900",
    fail: "bg-red-100 text-red-900",
    error: "bg-red-100 text-red-900",
    warning: "bg-yellow-100 text-yellow-900",
    skipped: "bg-gray-100 text-gray-600",
  };

  if (loading && !connector) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!connector) {
    return (
      <p className="text-gray-400 text-center py-12">{t("detail.notFound")}</p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {healthIcon[connector.healthStatus] ?? healthIcon.unknown}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {connector.name}
            </h1>
            <p className="text-sm text-gray-500">
              {connector.connectorType} / {connector.providerKey} v
              {connector.version}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={runHealthCheck}
            disabled={checking}
            aria-label={t("detail.runHealthCheck")}
          >
            {checking ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Heart size={14} />
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={runTests}
            disabled={running}
          >
            {running ? (
              <Loader2 size={14} className="animate-spin mr-1" />
            ) : (
              <Play size={14} className="mr-1" />
            )}
            {t("detail.runTests")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-red-600"
            onClick={deleteConnector}
            aria-label={t("detail.delete")}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      {connector.description && (
        <p className="text-sm text-gray-600">{connector.description}</p>
      )}
      {deleteError && (
        // `text-red-600` auf `bg-red-50` unterschreitet 4,5:1 — die Zeile
        // darunter (`connector.errorMessage`) steht deshalb im Sollstand von
        // `contrast-pairs.test.ts`. Eine zweite Fundstelle derselben
        // Kombination waere ein Rueckschritt gewesen; `red-800` haelt.
        <p className="text-sm text-red-800 bg-red-50 p-3 rounded" role="alert">
          {deleteError}
        </p>
      )}
      {connector.errorMessage && (
        <p className="text-sm text-red-600 bg-red-50 p-3 rounded">
          {connector.errorMessage}
        </p>
      )}

      {/* Test Results */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {t("detail.testResults")}
          </h2>
        </div>
        {testResults.length === 0 ? (
          <p className="text-sm text-gray-400 py-12 text-center">
            {t("detail.noTestResults")}
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {testResults.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between px-6 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {r.testName ?? r.testKey}
                  </p>
                  <p className="text-xs text-gray-500">
                    {t("detail.scanned", {
                      category: r.category,
                      count: r.resourcesScanned,
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${statusColor[r.status] ?? ""}`}
                  >
                    {r.status}
                  </Badge>
                  <span className="text-xs text-gray-400">
                    {t("detail.durationMs", { ms: r.durationMs })}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatDateTime(r.executedAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
