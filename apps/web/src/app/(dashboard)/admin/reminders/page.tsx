"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Plus,
  RefreshCcw,
  Bell,
  Mail,
  MessageSquare,
  BellOff,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ── Types ─────────────────────────────────────────────────────

interface ReminderRule {
  id: string;
  name: string;
  entityType: string;
  condition: string;
  channel: "in_app" | "email" | "slack";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Helpers ───────────────────────────────────────────────────

const CHANNEL_CONFIG: Record<
  string,
  { label: string; icon: typeof Bell; className: string }
> = {
  in_app: {
    label: "In-App",
    icon: Bell,
    className: "bg-blue-100 text-blue-800 border-blue-200",
  },
  email: {
    label: "E-Mail",
    icon: Mail,
    className: "bg-purple-100 text-purple-800 border-purple-200",
  },
  slack: {
    label: "Slack",
    icon: MessageSquare,
    className: "bg-green-100 text-green-800 border-green-200",
  },
};

// ── Component ─────────────────────────────────────────────────

export default function RemindersPage() {
  const [rules, setRules] = useState<ReminderRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/v1/reminders/rules");
      if (!res.ok) throw new Error("Failed to load");
      const json = await res.json();
      setRules(json.data ?? []);
    } catch {
      setError(true);
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Erinnerungsregeln
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Automatische Benachrichtigungen vor Fristablauf oder bei
            Statusänderungen
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCcw
              size={14}
              className={loading ? "animate-spin" : ""}
            />
          </Button>
          <Button size="sm">
            <Plus size={16} className="mr-1" />
            Regel erstellen
          </Button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          Fehler beim Laden der Erinnerungsregeln. Bitte erneut versuchen.
        </div>
      )}

      {/* Table */}
      {rules.length === 0 && !error ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BellOff size={48} className="text-gray-300 mb-4" />
            <p className="text-sm font-medium text-gray-500">
              Keine Erinnerungsregeln vorhanden
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Erstellen Sie eine Regel, um automatische Benachrichtigungen
              einzurichten.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Alle Regeln</CardTitle>
            <CardDescription>
              {rules.length} Regel{rules.length !== 1 ? "n" : ""} konfiguriert
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 font-medium text-gray-600">
                      Name
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">
                      Entitätstyp
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">
                      Bedingung
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">
                      Kanal
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule) => {
                    const channelCfg =
                      CHANNEL_CONFIG[rule.channel] ?? CHANNEL_CONFIG.in_app;
                    const ChannelIcon = channelCfg.icon;

                    return (
                      <tr
                        key={rule.id}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="py-3 px-3 font-medium text-gray-900">
                          {rule.name}
                        </td>
                        <td className="py-3 px-3 text-gray-600">
                          {rule.entityType}
                        </td>
                        <td className="py-3 px-3 text-gray-600">
                          {rule.condition}
                        </td>
                        <td className="py-3 px-3">
                          <Badge
                            variant="outline"
                            className={channelCfg.className}
                          >
                            <ChannelIcon size={12} className="mr-1" />
                            {channelCfg.label}
                          </Badge>
                        </td>
                        <td className="py-3 px-3">
                          {rule.isActive ? (
                            <Badge
                              variant="outline"
                              className="bg-green-100 text-green-800 border-green-200"
                            >
                              Aktiv
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="bg-gray-100 text-gray-500 border-gray-200"
                            >
                              Inaktiv
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
