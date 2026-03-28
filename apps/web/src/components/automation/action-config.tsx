"use client";

import { useTranslations } from "next-intl";
import {
  Plus,
  Trash2,
  GripVertical,
  ListTodo,
  Bell,
  Mail,
  ArrowUpCircle,
  RefreshCcw,
  Webhook,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AutomationAction {
  type: string;
  config: Record<string, unknown>;
}

interface ActionConfigProps {
  actions: AutomationAction[];
  onChange: (actions: AutomationAction[]) => void;
}

const ACTION_TYPES = [
  { value: "create_task", icon: ListTodo, color: "text-blue-600" },
  { value: "send_notification", icon: Bell, color: "text-yellow-600" },
  { value: "send_email", icon: Mail, color: "text-green-600" },
  { value: "change_status", icon: RefreshCcw, color: "text-purple-600" },
  { value: "escalate", icon: ArrowUpCircle, color: "text-red-600" },
  { value: "trigger_webhook", icon: Webhook, color: "text-gray-600" },
];

function ActionCard({
  action,
  index,
  onUpdate,
  onRemove,
  t,
}: {
  action: AutomationAction;
  index: number;
  onUpdate: (updated: AutomationAction) => void;
  onRemove: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const actionDef = ACTION_TYPES.find((a) => a.value === action.type);
  const Icon = actionDef?.icon ?? ListTodo;

  const updateConfig = (key: string, value: unknown) => {
    onUpdate({
      ...action,
      config: { ...action.config, [key]: value },
    });
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GripVertical size={14} className="text-gray-300" />
          <Icon size={16} className={actionDef?.color ?? "text-gray-600"} />
          <Badge variant="outline" className="text-[10px]">
            {t(`actionTypes.${action.type}`)}
          </Badge>
          <span className="text-xs text-gray-400">#{index + 1}</span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="p-1 text-gray-400 hover:text-red-600"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Config fields per action type */}
      {action.type === "create_task" && (
        <div className="space-y-2">
          <input
            type="text"
            value={String(action.config.title ?? "")}
            onChange={(e) => updateConfig("title", e.target.value)}
            placeholder={t("actionConfig.taskTitle")}
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          />
          <div className="flex gap-2">
            <select
              value={String(action.config.assigneeRole ?? "")}
              onChange={(e) => updateConfig("assigneeRole", e.target.value)}
              className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm bg-white"
            >
              <option value="">{t("actionConfig.selectRole")}</option>
              <option value="admin">Admin</option>
              <option value="risk_manager">Risk Manager</option>
              <option value="control_owner">Control Owner</option>
              <option value="auditor">Auditor</option>
              <option value="dpo">DPO</option>
              <option value="process_owner">Process Owner</option>
            </select>
            <input
              type="number"
              value={Number(action.config.deadlineDays ?? 14)}
              onChange={(e) =>
                updateConfig("deadlineDays", Number(e.target.value))
              }
              min={1}
              max={365}
              placeholder={t("actionConfig.deadlineDays")}
              className="w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
        </div>
      )}

      {action.type === "send_notification" && (
        <div className="space-y-2">
          <select
            value={String(action.config.role ?? "")}
            onChange={(e) => updateConfig("role", e.target.value)}
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm bg-white"
          >
            <option value="">{t("actionConfig.selectRole")}</option>
            <option value="admin">Admin</option>
            <option value="risk_manager">Risk Manager</option>
            <option value="control_owner">Control Owner</option>
            <option value="auditor">Auditor</option>
            <option value="dpo">DPO</option>
          </select>
          <textarea
            value={String(action.config.message ?? "")}
            onChange={(e) => updateConfig("message", e.target.value)}
            placeholder={t("actionConfig.message")}
            rows={2}
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          />
        </div>
      )}

      {action.type === "send_email" && (
        <div className="space-y-2">
          <input
            type="text"
            value={String(action.config.templateKey ?? "")}
            onChange={(e) => updateConfig("templateKey", e.target.value)}
            placeholder={t("actionConfig.templateKey")}
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          />
          <select
            value={String(action.config.recipientRole ?? "")}
            onChange={(e) => updateConfig("recipientRole", e.target.value)}
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm bg-white"
          >
            <option value="">{t("actionConfig.selectRole")}</option>
            <option value="admin">Admin</option>
            <option value="risk_manager">Risk Manager</option>
            <option value="control_owner">Control Owner</option>
            <option value="auditor">Auditor</option>
            <option value="dpo">DPO</option>
          </select>
        </div>
      )}

      {action.type === "change_status" && (
        <input
          type="text"
          value={String(action.config.newStatus ?? "")}
          onChange={(e) => updateConfig("newStatus", e.target.value)}
          placeholder={t("actionConfig.newStatus")}
          className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        />
      )}

      {action.type === "escalate" && (
        <div className="space-y-2">
          <select
            value={String(action.config.targetRole ?? "")}
            onChange={(e) => updateConfig("targetRole", e.target.value)}
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm bg-white"
          >
            <option value="">{t("actionConfig.selectRole")}</option>
            <option value="admin">Admin</option>
            <option value="risk_manager">Risk Manager</option>
            <option value="auditor">Auditor</option>
            <option value="dpo">DPO</option>
          </select>
          <textarea
            value={String(action.config.message ?? "")}
            onChange={(e) => updateConfig("message", e.target.value)}
            placeholder={t("actionConfig.escalationMessage")}
            rows={2}
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          />
        </div>
      )}

      {action.type === "trigger_webhook" && (
        <input
          type="text"
          value={String(action.config.webhookId ?? "")}
          onChange={(e) => updateConfig("webhookId", e.target.value)}
          placeholder={t("actionConfig.webhookId")}
          className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        />
      )}

      <p className="text-[10px] text-gray-400">
        {t("actionConfig.variableHint")}
      </p>
    </div>
  );
}

export function ActionConfig({ actions, onChange }: ActionConfigProps) {
  const t = useTranslations("automation");

  const addAction = (type: string) => {
    const defaultConfigs: Record<string, Record<string, unknown>> = {
      create_task: { title: "", assigneeRole: "", deadlineDays: 14 },
      send_notification: { role: "", message: "" },
      send_email: { templateKey: "", recipientRole: "" },
      change_status: { newStatus: "" },
      escalate: { targetRole: "", message: "" },
      trigger_webhook: { webhookId: "" },
    };

    onChange([...actions, { type, config: defaultConfigs[type] ?? {} }]);
  };

  const updateAction = (index: number, updated: AutomationAction) => {
    const newActions = [...actions];
    newActions[index] = updated;
    onChange(newActions);
  };

  const removeAction = (index: number) => {
    onChange(actions.filter((_, i) => i !== index));
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        {t("actionConfig.title")}
      </h3>

      <div className="space-y-3">
        {actions.map((action, idx) => (
          <ActionCard
            key={idx}
            action={action}
            index={idx}
            onUpdate={(updated) => updateAction(idx, updated)}
            onRemove={() => removeAction(idx)}
            t={t}
          />
        ))}
      </div>

      <div className="mt-3">
        <div className="text-xs font-medium text-gray-500 mb-2">
          {t("actionConfig.addAction")}
        </div>
        <div className="flex flex-wrap gap-2">
          {ACTION_TYPES.map((at) => {
            const Icon = at.icon;
            return (
              <Button
                key={at.value}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addAction(at.value)}
                className="text-xs"
              >
                <Icon size={12} className={`mr-1 ${at.color}`} />
                {t(`actionTypes.${at.value}`)}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
