"use client";

import { useTranslations } from "next-intl";
import {
  ShieldAlert,
  ShieldCheck,
  ClipboardCheck,
  TrendingUp,
  Calendar,
  History,
  ListTodo,
  Bell,
} from "lucide-react";

const statCards = [
  { key: "openRisks", icon: ShieldAlert, value: "—", color: "text-orange-600 bg-orange-50" },
  { key: "activeControls", icon: ShieldCheck, value: "—", color: "text-green-600 bg-green-50" },
  { key: "pendingFindings", icon: ClipboardCheck, value: "—", color: "text-red-600 bg-red-50" },
  { key: "complianceScore", icon: TrendingUp, value: "—", color: "text-blue-600 bg-blue-50" },
] as const;

const widgetCards = [
  { key: "upcomingAudits", icon: Calendar, color: "text-purple-600" },
  { key: "recentChanges", icon: History, color: "text-gray-600" },
  { key: "myTasks", icon: ListTodo, color: "text-indigo-600" },
  { key: "notifications", icon: Bell, color: "text-amber-600" },
] as const;

export default function DashboardPage() {
  const t = useTranslations("dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
        <p className="text-sm text-gray-500 mt-1">{t("welcome")}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ key, icon: Icon, value, color }) => (
          <div
            key={key}
            className="bg-white rounded-lg border border-gray-200 p-5 flex items-start gap-4"
          >
            <div className={`p-2.5 rounded-lg ${color}`}>
              <Icon size={20} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">
                {t(`widgets.${key}`)}
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Widget placeholders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {widgetCards.map(({ key, icon: Icon, color }) => (
          <div
            key={key}
            className="bg-white rounded-lg border border-gray-200 p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <Icon size={18} className={color} />
              <h2 className="text-sm font-semibold text-gray-900">
                {t(`widgets.${key}`)}
              </h2>
            </div>
            <div className="flex items-center justify-center h-32 rounded-md bg-gray-50 border border-dashed border-gray-200">
              <p className="text-sm text-gray-400">{t("placeholder")}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
