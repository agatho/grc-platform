"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Save, Play, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { TriggerConfig } from "@/components/automation/trigger-config";
import { ConditionBuilder } from "@/components/automation/condition-builder";
import { ActionConfig } from "@/components/automation/action-config";

interface EntityFieldOption {
  field: string;
  label: string;
  type: "string" | "number" | "boolean" | "date";
}

interface ConditionGroup {
  operator: "AND" | "OR";
  rules: (ConditionRule | ConditionGroup)[];
}

interface ConditionRule {
  field: string;
  op: string;
  value: string | number | boolean;
}

interface AutomationAction {
  type: string;
  config: Record<string, unknown>;
}

export default function EditRulePage() {
  const t = useTranslations("automation");
  const router = useRouter();
  const params = useParams();
  const ruleId = params.id as string;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] = useState("entity_change");
  const [triggerConfig, setTriggerConfig] = useState<{
    entityType: string;
    events?: string[];
    field?: string;
    schedule?: string;
  }>({ entityType: "" });
  const [conditions, setConditions] = useState<ConditionGroup>({
    operator: "AND",
    rules: [],
  });
  const [actions, setActions] = useState<AutomationAction[]>([]);
  const [cooldownMinutes, setCooldownMinutes] = useState(60);
  const [maxExecutionsPerHour, setMaxExecutionsPerHour] = useState(100);
  const [isActive, setIsActive] = useState(false);

  const [entityTypes, setEntityTypes] = useState<string[]>([]);
  const [entityFields, setEntityFields] = useState<
    Record<string, EntityFieldOption[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    conditionsMatched: boolean;
    wouldExecute: AutomationAction[];
  } | null>(null);

  // Fetch entity fields + rule data
  useEffect(() => {
    void (async () => {
      const [fieldsRes, ruleRes] = await Promise.all([
        fetch("/api/v1/automation/entity-fields"),
        fetch(`/api/v1/automation/rules/${ruleId}`),
      ]);

      if (fieldsRes.ok) {
        const json = await fieldsRes.json();
        setEntityTypes(json.data.entityTypes);
        setEntityFields(json.data.fields);
      }

      if (ruleRes.ok) {
        const json = await ruleRes.json();
        const rule = json.data;
        setName(rule.name);
        setDescription(rule.description ?? "");
        setTriggerType(rule.triggerType);
        setTriggerConfig(rule.triggerConfig);
        setConditions(rule.conditions);
        setActions(rule.actions);
        setCooldownMinutes(rule.cooldownMinutes ?? 60);
        setMaxExecutionsPerHour(rule.maxExecutionsPerHour ?? 100);
        setIsActive(rule.isActive);
      }

      setLoading(false);
    })();
  }, [ruleId]);

  const currentFields = entityFields[triggerConfig.entityType] ?? [];

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/automation/rules/${ruleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || undefined,
          triggerType,
          triggerConfig,
          conditions,
          actions,
          cooldownMinutes,
          maxExecutionsPerHour,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? t("designer.saveFailed"));
        return;
      }

      router.push("/automation");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(t("designer.confirmDelete"))) return;

    const res = await fetch(`/api/v1/automation/rules/${ruleId}`, {
      method: "DELETE",
    });

    if (res.ok) {
      router.push("/automation");
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(
        `/api/v1/automation/rules/${ruleId}/test`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      if (res.ok) {
        const json = await res.json();
        setTestResult(json.data);
      }
    } finally {
      setTesting(false);
    }
  };

  const handleToggleActive = async () => {
    const res = await fetch(
      `/api/v1/automation/rules/${ruleId}/activate`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      },
    );
    if (res.ok) {
      setIsActive(!isActive);
    }
  };

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
        <div className="flex items-center gap-3">
          <Link href="/automation">
            <Button variant="ghost" size="sm">
              <ArrowLeft size={14} />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t("designer.editTitle")}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {t("designer.subtitle")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={testing}
          >
            {testing ? (
              <Loader2 size={14} className="animate-spin mr-1" />
            ) : (
              <Play size={14} className="mr-1" />
            )}
            {t("designer.dryRun")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleActive}
          >
            {isActive ? t("designer.deactivate") : t("designer.activate")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 size={14} className="mr-1" />
            {t("designer.delete")}
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
          >
            {saving && <Loader2 size={14} className="animate-spin mr-1" />}
            <Save size={14} className="mr-1" />
            {t("designer.save")}
          </Button>
        </div>
      </div>

      {/* Rule Name + Description */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("designer.ruleName")}
          className="w-full text-lg font-semibold border-none outline-none text-gray-900 placeholder-gray-300"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("designer.ruleDescription")}
          rows={2}
          className="w-full text-sm border-none outline-none text-gray-600 placeholder-gray-300 resize-none"
        />
      </div>

      {/* 3-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <TriggerConfig
            triggerType={triggerType}
            onTriggerTypeChange={setTriggerType}
            triggerConfig={triggerConfig}
            onTriggerConfigChange={setTriggerConfig}
            entityTypes={entityTypes}
          />
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <ConditionBuilder
            conditions={conditions}
            onChange={setConditions}
            entityFields={currentFields}
          />
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <ActionConfig actions={actions} onChange={setActions} />
        </div>
      </div>

      {/* Advanced Settings */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          {t("designer.advancedSettings")}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">
              {t("designer.cooldownMinutes")}
            </label>
            <input
              type="number"
              value={cooldownMinutes}
              onChange={(e) => setCooldownMinutes(Number(e.target.value))}
              min={0}
              max={1440}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">
              {t("designer.maxExecutionsPerHour")}
            </label>
            <input
              type="number"
              value={maxExecutionsPerHour}
              onChange={(e) =>
                setMaxExecutionsPerHour(Number(e.target.value))
              }
              min={1}
              max={1000}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Test Result */}
      {testResult && (
        <div
          className={`rounded-lg border-2 p-6 ${
            testResult.conditionsMatched
              ? "border-green-200 bg-green-50"
              : "border-yellow-200 bg-yellow-50"
          }`}
        >
          <h3 className="text-sm font-semibold mb-2">
            {t("designer.testResult")}
          </h3>
          <p className="text-sm">
            {testResult.conditionsMatched
              ? t("designer.conditionsMatched")
              : t("designer.conditionsNotMatched")}
          </p>
          {testResult.wouldExecute.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-medium text-gray-600">
                {t("designer.wouldExecute")}:
              </p>
              <ul className="mt-1 space-y-1">
                {testResult.wouldExecute.map((a, i) => (
                  <li key={i} className="text-xs text-gray-700">
                    {t(`actionTypes.${a.type}`)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
