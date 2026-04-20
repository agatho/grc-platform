"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import {
  Loader2,
  RefreshCcw,
  Play,
  Heart,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Shield,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
  const params = useParams();
  const router = useRouter();
  const [connector, setConnector] = useState<Connector | null>(null);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [checking, setChecking] = useState(false);

  const id = params.id as string;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [connRes, resultsRes] = await Promise.all([
        fetch(`/api/v1/connectors/${id}`),
        fetch(`/api/v1/connectors/${id}/test-results?limit=20`),
      ]);
      if (connRes.ok) {
        const json = await connRes.json();
        setConnector(json.data);
      }
      if (resultsRes.ok) {
        const json = await resultsRes.json();
        setTestResults(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

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
    if (!confirm("Delete this connector?")) return;
    const res = await fetch(`/api/v1/connectors/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/connectors");
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
      <p className="text-gray-400 text-center py-12">Connector not found</p>
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
            Run Tests
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-red-600"
            onClick={deleteConnector}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      {connector.description && (
        <p className="text-sm text-gray-600">{connector.description}</p>
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
            Test Results
          </h2>
        </div>
        {testResults.length === 0 ? (
          <p className="text-sm text-gray-400 py-12 text-center">
            No test results yet. Click "Run Tests" to execute.
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
                    {r.category} - {r.resourcesScanned} scanned
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
                    {r.durationMs}ms
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(r.executedAt).toLocaleString()}
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
