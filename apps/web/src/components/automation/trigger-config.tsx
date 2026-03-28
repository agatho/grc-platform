"use client";

import { useTranslations } from "next-intl";
import {
  RefreshCcw,
  Clock,
  BarChart3,
  CalendarClock,
} from "lucide-react";

interface TriggerConfigData {
  entityType: string;
  events?: string[];
  field?: string;
  schedule?: string;
}

interface TriggerConfigProps {
  triggerType: string;
  onTriggerTypeChange: (type: string) => void;
  triggerConfig: TriggerConfigData;
  onTriggerConfigChange: (config: TriggerConfigData) => void;
  entityTypes: string[];
}

const TRIGGER_TYPES = [
  { value: "entity_change", icon: RefreshCcw, color: "border-blue-300 bg-blue-50" },
  { value: "deadline_expired", icon: Clock, color: "border-orange-300 bg-orange-50" },
  { value: "score_threshold", icon: BarChart3, color: "border-red-300 bg-red-50" },
  { value: "periodic", icon: CalendarClock, color: "border-purple-300 bg-purple-50" },
];

const EVENT_OPTIONS = [
  { value: "created", label: "Created" },
  { value: "updated", label: "Updated" },
  { value: "deleted", label: "Deleted" },
  { value: "status_changed", label: "Status Changed" },
];

export function TriggerConfig({
  triggerType,
  onTriggerTypeChange,
  triggerConfig,
  onTriggerConfigChange,
  entityTypes,
}: TriggerConfigProps) {
  const t = useTranslations("automation");

  const toggleEvent = (event: string) => {
    const current = triggerConfig.events ?? [];
    const updated = current.includes(event)
      ? current.filter((e) => e !== event)
      : [...current, event];
    onTriggerConfigChange({ ...triggerConfig, events: updated });
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        {t("triggerConfig.title")}
      </h3>

      {/* Trigger Type Cards */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {TRIGGER_TYPES.map((tt) => {
          const Icon = tt.icon;
          const isSelected = triggerType === tt.value;
          return (
            <button
              key={tt.value}
              type="button"
              onClick={() => onTriggerTypeChange(tt.value)}
              className={`rounded-lg border-2 p-3 text-left transition-all ${
                isSelected
                  ? tt.color + " shadow-sm"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <Icon size={16} className="mb-1 text-gray-600" />
              <p className="text-xs font-medium text-gray-800">
                {t(`triggerTypes.${tt.value}`)}
              </p>
            </button>
          );
        })}
      </div>

      {/* Entity Type Selection */}
      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">
            {t("triggerConfig.entityType")}
          </label>
          <select
            value={triggerConfig.entityType}
            onChange={(e) =>
              onTriggerConfigChange({
                ...triggerConfig,
                entityType: e.target.value,
              })
            }
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm bg-white"
          >
            <option value="">{t("triggerConfig.selectEntity")}</option>
            {entityTypes.map((et) => (
              <option key={et} value={et}>
                {et.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>

        {/* Event Checkboxes (for entity_change) */}
        {triggerType === "entity_change" && (
          <div>
            <label className="text-xs font-medium text-gray-600 mb-2 block">
              {t("triggerConfig.events")}
            </label>
            <div className="flex flex-wrap gap-2">
              {EVENT_OPTIONS.map((ev) => (
                <label
                  key={ev.value}
                  className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs cursor-pointer transition-colors ${
                    (triggerConfig.events ?? []).includes(ev.value)
                      ? "border-blue-300 bg-blue-50 text-blue-700"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={(triggerConfig.events ?? []).includes(ev.value)}
                    onChange={() => toggleEvent(ev.value)}
                    className="sr-only"
                  />
                  {ev.label}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Field for score_threshold */}
        {(triggerType === "score_threshold" ||
          triggerType === "entity_change") && (
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">
              {t("triggerConfig.field")}
            </label>
            <input
              type="text"
              value={triggerConfig.field ?? ""}
              onChange={(e) =>
                onTriggerConfigChange({
                  ...triggerConfig,
                  field: e.target.value || undefined,
                })
              }
              placeholder={t("triggerConfig.fieldPlaceholder")}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            />
          </div>
        )}

        {/* Schedule for periodic */}
        {triggerType === "periodic" && (
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">
              {t("triggerConfig.schedule")}
            </label>
            <select
              value={triggerConfig.schedule ?? ""}
              onChange={(e) =>
                onTriggerConfigChange({
                  ...triggerConfig,
                  schedule: e.target.value,
                })
              }
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm bg-white"
            >
              <option value="">{t("triggerConfig.selectSchedule")}</option>
              <option value="daily">{t("triggerConfig.daily")}</option>
              <option value="weekly">{t("triggerConfig.weekly")}</option>
              <option value="monthly">{t("triggerConfig.monthly")}</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
