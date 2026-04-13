"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Plus,
  RefreshCcw,
  MessageSquare,
  Hash,
  Webhook,
  Unplug,
  AlertCircle,
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

interface MessagingIntegration {
  id: string;
  provider: "slack" | "teams" | "webhook";
  name: string;
  channel: string;
  eventTypes: string[];
  lastSentAt: string | null;
  errorCount: number;
  isActive: boolean;
  createdAt: string;
}

// ── Helpers ───────────────────────────────────────────────────

const PROVIDER_CONFIG: Record<
  string,
  { label: string; icon: typeof MessageSquare; className: string }
> = {
  slack: {
    label: "Slack",
    icon: Hash,
    className: "bg-purple-100 text-purple-800 border-purple-200",
  },
  teams: {
    label: "Microsoft Teams",
    icon: MessageSquare,
    className: "bg-blue-100 text-blue-800 border-blue-200",
  },
  webhook: {
    label: "Webhook",
    icon: Webhook,
    className: "bg-gray-100 text-gray-800 border-gray-200",
  },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleString("de-DE");
}

// ── Component ─────────────────────────────────────────────────

export default function MessagingIntegrationsPage() {
  const [integrations, setIntegrations] = useState<MessagingIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/v1/messaging/integrations");
      if (!res.ok) throw new Error("Failed to load");
      const json = await res.json();
      setIntegrations(json.data ?? []);
    } catch {
      setError(true);
      setIntegrations([]);
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
            Messaging-Integrationen
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Slack, Microsoft Teams und Webhook-Anbindungen für
            Benachrichtigungen
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
            Integration hinzufügen
          </Button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          Fehler beim Laden der Integrationen. Bitte erneut versuchen.
        </div>
      )}

      {/* Empty State */}
      {integrations.length === 0 && !error ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Unplug size={48} className="text-gray-300 mb-4" />
            <p className="text-sm font-medium text-gray-500">
              Keine Integrationen konfiguriert
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Verbinden Sie Slack, Microsoft Teams oder einen Webhook, um
              Benachrichtigungen zu versenden.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {integrations.map((integration) => {
            const providerCfg =
              PROVIDER_CONFIG[integration.provider] ??
              PROVIDER_CONFIG.webhook;
            const ProviderIcon = providerCfg.icon;

            return (
              <Card key={integration.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`rounded-md p-2 ${providerCfg.className}`}
                      >
                        <ProviderIcon size={18} />
                      </div>
                      <div>
                        <CardTitle className="text-base">
                          {integration.name}
                        </CardTitle>
                        <CardDescription>
                          {providerCfg.label}
                        </CardDescription>
                      </div>
                    </div>
                    {integration.isActive ? (
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
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Channel */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Kanal</span>
                    <span className="font-medium text-gray-900">
                      {integration.channel}
                    </span>
                  </div>

                  {/* Event Types */}
                  <div>
                    <span className="text-sm text-gray-500 block mb-1">
                      Event-Typen
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {integration.eventTypes.map((evt) => (
                        <Badge
                          key={evt}
                          variant="secondary"
                          className="text-xs"
                        >
                          {evt}
                        </Badge>
                      ))}
                      {integration.eventTypes.length === 0 && (
                        <span className="text-xs text-gray-400">
                          Keine Events konfiguriert
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Last Sent */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Letzter Versand</span>
                    <span className="text-gray-600">
                      {formatDate(integration.lastSentAt)}
                    </span>
                  </div>

                  {/* Error Count */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Fehleranzahl</span>
                    <span
                      className={`font-medium ${
                        integration.errorCount > 0
                          ? "text-red-600"
                          : "text-gray-600"
                      }`}
                    >
                      {integration.errorCount > 0 && (
                        <AlertCircle
                          size={14}
                          className="inline mr-1 text-red-500"
                        />
                      )}
                      {integration.errorCount}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
