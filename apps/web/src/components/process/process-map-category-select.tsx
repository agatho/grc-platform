"use client";

// Prozesslandkarte: "Landkarten-Kategorie" select on the process detail
// page (Stammdaten). Persists via PUT /api/v1/processes/:id. Null means
// the process inherits its parent's band on the process map.

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProcessMapCategory } from "@grc/shared";

const NONE_VALUE = "none";
const CATEGORIES: ProcessMapCategory[] = ["management", "core", "support"];

export function ProcessMapCategorySelect({
  processId,
  value,
  disabled,
  onChanged,
}: {
  processId: string;
  value: ProcessMapCategory | null;
  disabled?: boolean;
  onChanged?: (newValue: ProcessMapCategory | null) => void;
}) {
  const t = useTranslations("processMap");
  const [current, setCurrent] = useState<string>(value ?? NONE_VALUE);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setCurrent(value ?? NONE_VALUE);
  }, [value]);

  const change = async (v: string) => {
    const prev = current;
    setCurrent(v);
    setPending(true);
    try {
      const mapCategory =
        v === NONE_VALUE ? null : (v as ProcessMapCategory);
      const res = await fetch(`/api/v1/processes/${processId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mapCategory }),
      });
      if (!res.ok) throw new Error(t("category.saveError"));
      toast.success(t("category.saved"));
      onChanged?.(mapCategory);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("category.saveError"),
      );
      setCurrent(prev);
    } finally {
      setPending(false);
    }
  };

  return (
    <Select
      value={current}
      onValueChange={(v) => void change(v)}
      disabled={disabled || pending}
    >
      <SelectTrigger className="h-8 w-56">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE_VALUE}>{t("category.none")}</SelectItem>
        {CATEGORIES.map((c) => (
          <SelectItem key={c} value={c}>
            {t(`category.${c}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
