"use client";

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { useTranslations } from "next-intl";

/**
 * [ARCTOS-FULL-2026-08-31 · OP-070] Welle 6b. Fest verdrahtetes Deutsch.
 *
 * Ein Nebenbefund, der beim Umstellen sichtbar wurde: die Mehrzahl wurde von
 * Hand gebaut — `Regel{rules.length !== 1 ? "n" : ""}`. Das ist genau die
 * Regel, die ICU kennt und die in anderen Sprachen anders lautet; sie steht
 * jetzt als `plural`-Ausdruck im Katalog.
 */

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
  { key: string; icon: typeof Bell; className: string }
> = {
  in_app: {
    key: "in_app",
    icon: Bell,
    className: "bg-blue-100 text-blue-800 border-blue-200",
  },
  email: {
    key: "email",
    icon: Mail,
    className: "bg-purple-100 text-purple-800 border-purple-200",
  },
  slack: {
    key: "slack",
    icon: MessageSquare,
    className: "bg-green-100 text-green-800 border-green-200",
  },
};

// ── Component ─────────────────────────────────────────────────

export default function RemindersPage() {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  // [OP-245 · Gestalt A] Abruf beim Einhängen über `@tanstack/react-query`
  // statt Effekt plus gespiegeltem Lade-, Daten- und Fehlerzustand (Muster
  // aus Welle 7b, `catalogs/objects/page.tsx`). Eine nicht-ok-Antwort wirft
  // wie vorher und landet im Fehlerzustand der Abfrage.
  const {
    data: rules = [],
    isPending: loading,
    isError: error,
    isFetching,
    refetch,
  } = useQuery<ReminderRule[]>({
    queryKey: ["reminders", "rules"],
    queryFn: async () => {
      const res = await fetch("/api/v1/reminders/rules");
      if (!res.ok) throw new Error("Failed to load");
      const json = await res.json();
      return (json.data ?? []) as ReminderRule[];
    },
  });

  const fetchData = useCallback(async () => {
    await refetch();
  }, [refetch]);

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
            {t("reminders.title")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t("reminders.description")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={isFetching}
          >
            <RefreshCcw
              size={14}
              className={isFetching ? "animate-spin" : ""}
            />
            <span className="sr-only">{tCommon("actions.refresh")}</span>
          </Button>
          <Button size="sm">
            <Plus size={16} className="mr-1" />
            {t("reminders.create")}
          </Button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {t("reminders.loadError")}
        </div>
      )}

      {/* Table */}
      {rules.length === 0 && !error ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BellOff size={48} className="text-gray-500 mb-4" />
            <p className="text-sm font-medium text-gray-500">
              {t("reminders.empty")}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {t("reminders.emptyHint")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t("reminders.allRules")}</CardTitle>
            <CardDescription>
              {t("reminders.ruleCount", { count: rules.length })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 font-medium text-gray-600">
                      {t("reminders.column.name")}
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">
                      {t("reminders.column.entityType")}
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">
                      {t("reminders.column.condition")}
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">
                      {t("reminders.column.channel")}
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">
                      {t("reminders.column.status")}
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
                            {t(`reminders.channel.${channelCfg.key}`)}
                          </Badge>
                        </td>
                        <td className="py-3 px-3">
                          {rule.isActive ? (
                            <Badge
                              variant="outline"
                              className="bg-green-100 text-green-800 border-green-200"
                            >
                              {tCommon("status.active")}
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="bg-gray-100 text-gray-500 border-gray-200"
                            >
                              {tCommon("status.inactive")}
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
