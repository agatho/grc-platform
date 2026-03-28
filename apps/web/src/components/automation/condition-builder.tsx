"use client";

import { useTranslations } from "next-intl";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ConditionRule {
  field: string;
  op: string;
  value: string | number | boolean;
}

interface ConditionGroup {
  operator: "AND" | "OR";
  rules: (ConditionRule | ConditionGroup)[];
}

interface EntityFieldOption {
  field: string;
  label: string;
  type: "string" | "number" | "boolean" | "date";
}

interface ConditionBuilderProps {
  conditions: ConditionGroup;
  onChange: (conditions: ConditionGroup) => void;
  entityFields: EntityFieldOption[];
}

const OPERATORS = [
  { value: ">", label: ">" },
  { value: "<", label: "<" },
  { value: ">=", label: ">=" },
  { value: "<=", label: "<=" },
  { value: "=", label: "=" },
  { value: "!=", label: "!=" },
  { value: "contains", label: "contains" },
  { value: "not_contains", label: "not contains" },
  { value: "days_since", label: "days since >" },
];

function isConditionGroup(
  rule: ConditionRule | ConditionGroup,
): rule is ConditionGroup {
  return "operator" in rule && "rules" in rule;
}

function ConditionRuleRow({
  rule,
  entityFields,
  onUpdate,
  onRemove,
  t,
}: {
  rule: ConditionRule;
  entityFields: EntityFieldOption[];
  onUpdate: (updated: ConditionRule) => void;
  onRemove: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-3">
      <GripVertical size={14} className="text-gray-300 shrink-0" />
      <select
        value={rule.field}
        onChange={(e) => onUpdate({ ...rule, field: e.target.value })}
        className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm bg-white"
      >
        <option value="">{t("conditionBuilder.selectField")}</option>
        {entityFields.map((f) => (
          <option key={f.field} value={f.field}>
            {f.label}
          </option>
        ))}
      </select>
      <select
        value={rule.op}
        onChange={(e) => onUpdate({ ...rule, op: e.target.value })}
        className="w-32 rounded-md border border-gray-300 px-2 py-1.5 text-sm bg-white"
      >
        {OPERATORS.map((op) => (
          <option key={op.value} value={op.value}>
            {op.label}
          </option>
        ))}
      </select>
      <input
        type="text"
        value={String(rule.value)}
        onChange={(e) => {
          const numVal = Number(e.target.value);
          onUpdate({
            ...rule,
            value: isNaN(numVal) ? e.target.value : numVal,
          });
        }}
        placeholder={t("conditionBuilder.value")}
        className="w-36 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
      />
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 p-1 text-gray-400 hover:text-red-600"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function ConditionGroupBlock({
  group,
  entityFields,
  onChange,
  onRemove,
  depth,
  t,
}: {
  group: ConditionGroup;
  entityFields: EntityFieldOption[];
  onChange: (updated: ConditionGroup) => void;
  onRemove?: () => void;
  depth: number;
  t: ReturnType<typeof useTranslations>;
}) {
  const updateRule = (index: number, updated: ConditionRule | ConditionGroup) => {
    const newRules = [...group.rules];
    newRules[index] = updated;
    onChange({ ...group, rules: newRules });
  };

  const removeRule = (index: number) => {
    const newRules = group.rules.filter((_, i) => i !== index);
    onChange({ ...group, rules: newRules });
  };

  const addCondition = () => {
    onChange({
      ...group,
      rules: [...group.rules, { field: "", op: "=", value: "" }],
    });
  };

  const addGroup = () => {
    if (depth >= 3) return; // Max nesting depth
    onChange({
      ...group,
      rules: [
        ...group.rules,
        { operator: "AND" as const, rules: [{ field: "", op: "=", value: "" }] },
      ],
    });
  };

  const toggleOperator = () => {
    onChange({
      ...group,
      operator: group.operator === "AND" ? "OR" : "AND",
    });
  };

  const borderColor = depth === 0 ? "border-blue-200" : depth === 1 ? "border-orange-200" : "border-purple-200";
  const bgColor = depth === 0 ? "bg-blue-50/50" : depth === 1 ? "bg-orange-50/50" : "bg-purple-50/50";

  return (
    <div className={`rounded-lg border-2 ${borderColor} ${bgColor} p-4 space-y-3`}>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={toggleOperator}
          className="flex items-center gap-1"
        >
          <Badge
            variant="outline"
            className={`cursor-pointer text-xs ${
              group.operator === "AND"
                ? "bg-blue-100 text-blue-700 border-blue-300"
                : "bg-orange-100 text-orange-700 border-orange-300"
            }`}
          >
            {group.operator}
          </Badge>
          <span className="text-[10px] text-gray-400 ml-1">
            {t("conditionBuilder.clickToToggle")}
          </span>
        </button>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1 text-gray-400 hover:text-red-600"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      <div className="space-y-2">
        {group.rules.map((rule, idx) =>
          isConditionGroup(rule) ? (
            <ConditionGroupBlock
              key={idx}
              group={rule}
              entityFields={entityFields}
              onChange={(updated) => updateRule(idx, updated)}
              onRemove={() => removeRule(idx)}
              depth={depth + 1}
              t={t}
            />
          ) : (
            <ConditionRuleRow
              key={idx}
              rule={rule}
              entityFields={entityFields}
              onUpdate={(updated) => updateRule(idx, updated)}
              onRemove={() => removeRule(idx)}
              t={t}
            />
          ),
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addCondition}
        >
          <Plus size={12} className="mr-1" />
          {t("conditionBuilder.addCondition")}
        </Button>
        {depth < 3 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addGroup}
          >
            <Plus size={12} className="mr-1" />
            {t("conditionBuilder.addGroup")}
          </Button>
        )}
      </div>
    </div>
  );
}

export function ConditionBuilder({
  conditions,
  onChange,
  entityFields,
}: ConditionBuilderProps) {
  const t = useTranslations("automation");

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        {t("conditionBuilder.title")}
      </h3>
      <ConditionGroupBlock
        group={conditions}
        entityFields={entityFields}
        onChange={onChange}
        depth={0}
        t={t}
      />
    </div>
  );
}
