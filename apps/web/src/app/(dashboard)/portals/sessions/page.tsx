"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, RefreshCcw, XCircle } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface SessionItem {
  id: string;
  externalEmail: string;
  externalName: string | null;
  externalOrg: string | null;
  status: string;
  mfaVerified: boolean;
  language: string;
  expiresAt: string;
  createdAt: string;
}

export default function SessionsPage() {
  return (
    <ModuleGate moduleKey="portals">
      <SessionsList />
    </ModuleGate>
  );
}

function SessionsList() {
  const t = useTranslations("portals");
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/portals/sessions?limit=50");
      if (res.ok) setSessions((await res.json()).data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleRevoke = async (id: string) => {
    await fetch(`/api/v1/portals/sessions/${id}`, { method: "DELETE" });
    void fetchData();
  };

  const statusColors: Record<string, string> = {
    active: "bg-green-50 text-green-700",
    expired: "bg-gray-50 text-gray-600",
    revoked: "bg-red-50 text-red-700",
    completed: "bg-blue-50 text-blue-700",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("sessionsTitle")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t("sessionsDescription")}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          disabled={loading}
        >
          <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
        </Button>
      </div>

      {loading && sessions.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-12 text-gray-400">{t("noSessions")}</div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4"
            >
              <div>
                <span className="text-sm font-medium text-gray-900">
                  {s.externalEmail}
                </span>
                {s.externalName && (
                  <span className="text-xs text-gray-500 ml-2">
                    ({s.externalName})
                  </span>
                )}
                {s.externalOrg && (
                  <span className="text-xs text-gray-500 ml-1">
                    - {s.externalOrg}
                  </span>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <Badge
                    variant="outline"
                    className={statusColors[s.status] ?? ""}
                  >
                    {s.status}
                  </Badge>
                  {s.mfaVerified && (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-blue-50 text-blue-700"
                    >
                      MFA
                    </Badge>
                  )}
                  <span className="text-xs text-gray-400">
                    {t("expiresAt")}: {new Date(s.expiresAt).toLocaleString()}
                  </span>
                </div>
              </div>
              {s.status === "active" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRevoke(s.id)}
                >
                  <XCircle size={14} className="text-red-500" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
