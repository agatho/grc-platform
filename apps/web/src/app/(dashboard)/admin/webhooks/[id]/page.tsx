"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  ArrowLeft,
  Webhook,
  Loader2,
  Check,
  X as XIcon,
  RefreshCw,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type {
  WebhookRegistrationData,
  WebhookDeliveryLogEntry,
  EventFilter,
} from "@grc/shared";

// ── Status badge config ───────────────────────────────────────

const STATUS_STYLES: Record<string, { color: string; icon: typeof Check }> = {
  delivered: { color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  failed: { color: "bg-red-100 text-red-700", icon: XCircle },
  retrying: { color: "bg-amber-100 text-amber-700", icon: RefreshCw },
  pending: { color: "bg-gray-100 text-gray-500", icon: Clock },
};

export default function WebhookDetailPage() {
  const t = useTranslations("platform");
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [webhook, setWebhook] = useState<WebhookRegistrationData | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDeliveryLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [deliveryPage, setDeliveryPage] = useState(1);
  const [deliveryTotal, setDeliveryTotal] = useState(0);

  const fetchWebhook = useCallback(async () => {
    setLoading(true);
    try {
      const [whRes, dlRes] = await Promise.all([
        fetch(`/api/v1/webhooks/${id}`),
        fetch(`/api/v1/webhooks/${id}/deliveries?page=${deliveryPage}&limit=20`),
      ]);
      if (whRes.ok) {
        const whJson = await whRes.json();
        setWebhook(whJson.data);
      }
      if (dlRes.ok) {
        const dlJson = await dlRes.json();
        setDeliveries(dlJson.data ?? []);
        setDeliveryTotal(dlJson.pagination?.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [id, deliveryPage]);

  useEffect(() => {
    fetchWebhook();
  }, [fetchWebhook]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!webhook) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        {t("webhooks.notFound")}
      </div>
    );
  }

  const filter = webhook.eventFilter as EventFilter;
  const successCount = deliveries.filter((d) => d.status === "delivered").length;
  const failedCount = deliveries.filter((d) => d.status === "failed").length;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/admin/webhooks")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Webhook className="h-6 w-6" />
            {webhook.name}
          </h1>
          <p className="text-sm text-muted-foreground">{webhook.url}</p>
        </div>
        <div className="ml-auto">
          <Badge
            variant={webhook.isActive ? "default" : "secondary"}
            className={
              webhook.isActive
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-500"
            }
          >
            {webhook.isActive ? t("webhooks.active") : t("webhooks.inactive")}
          </Badge>
        </div>
      </div>

      {/* Config Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              {t("webhooks.template")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="font-medium capitalize">
              {webhook.templateType ?? "generic"}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              {t("webhooks.secretHint")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <code className="font-mono">****{webhook.secretLast4}</code>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              {t("webhooks.filters")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {filter?.entityTypes?.map((et) => (
                <Badge key={et} variant="outline" className="text-[10px]">
                  {et}
                </Badge>
              ))}
              {filter?.events?.map((ev) => (
                <Badge key={ev} variant="outline" className="text-[10px] bg-blue-50">
                  {ev.replace("entity.", "")}
                </Badge>
              ))}
              {!filter?.entityTypes?.length && !filter?.events?.length && (
                <span className="text-xs text-muted-foreground">{t("webhooks.allEvents")}</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-4 text-center">
            <div className="text-2xl font-bold">{deliveryTotal}</div>
            <div className="text-xs text-muted-foreground">{t("webhooks.totalDeliveries")}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <div className="text-2xl font-bold text-green-600">{successCount}</div>
            <div className="text-xs text-muted-foreground">{t("webhooks.successful")}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <div className="text-2xl font-bold text-red-600">{failedCount}</div>
            <div className="text-xs text-muted-foreground">{t("webhooks.failed")}</div>
          </CardContent>
        </Card>
      </div>

      {/* Delivery Log */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("webhooks.deliveryLog")}</CardTitle>
          <Button variant="outline" size="sm" onClick={fetchWebhook}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            {t("webhooks.refresh")}
          </Button>
        </CardHeader>
        <CardContent>
          {deliveries.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              {t("webhooks.noDeliveries")}
            </div>
          ) : (
            <div className="space-y-2">
              {deliveries.map((d) => {
                const statusMeta = STATUS_STYLES[d.status] ?? STATUS_STYLES.pending;
                const Icon = statusMeta.icon;
                return (
                  <div
                    key={d.id}
                    className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm"
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <Badge className={statusMeta.color}>{d.status}</Badge>
                    <span className="text-muted-foreground">
                      {d.eventType.replace("entity.", "")}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {d.entityType}
                    </Badge>
                    <span className="font-mono text-xs text-muted-foreground truncate">
                      {d.entityId.slice(0, 8)}...
                    </span>
                    {d.responseStatus && (
                      <Badge
                        variant="outline"
                        className={
                          d.responseStatus < 300
                            ? "bg-green-50 text-green-700"
                            : "bg-red-50 text-red-700"
                        }
                      >
                        HTTP {d.responseStatus}
                      </Badge>
                    )}
                    {d.errorMessage && (
                      <span className="text-xs text-red-600 truncate max-w-[200px]">
                        {d.errorMessage}
                      </span>
                    )}
                    <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(d.createdAt).toLocaleString("de-DE")}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {deliveryTotal > 20 && (
            <div className="flex justify-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={deliveryPage <= 1}
                onClick={() => setDeliveryPage((p) => p - 1)}
              >
                {t("webhooks.prev")}
              </Button>
              <span className="text-sm text-muted-foreground flex items-center px-2">
                {deliveryPage} / {Math.ceil(deliveryTotal / 20)}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={deliveryPage >= Math.ceil(deliveryTotal / 20)}
                onClick={() => setDeliveryPage((p) => p + 1)}
              >
                {t("webhooks.next")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
