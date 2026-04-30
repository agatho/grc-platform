"use client";

import { Badge } from "@/components/ui/badge";
import { useTranslations } from "next-intl";
import type { ProgrammeJourneyStatus } from "@grc/shared";

const variantByStatus: Record<
  ProgrammeJourneyStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  planned: "outline",
  active: "secondary",
  on_track: "default",
  at_risk: "secondary",
  blocked: "destructive",
  completed: "default",
  archived: "outline",
};

const colorByStatus: Record<ProgrammeJourneyStatus, string> = {
  planned: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100",
  active: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  on_track:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100",
  at_risk:
    "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100",
  blocked: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
  completed:
    "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-100",
  archived:
    "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
};

export function ProgrammeStatusBadge({
  status,
}: {
  status: ProgrammeJourneyStatus;
}) {
  const t = useTranslations("programme");
  return (
    <Badge variant={variantByStatus[status]} className={colorByStatus[status]}>
      {t(`status.journey.${status}`)}
    </Badge>
  );
}

const stepColorByStatus: Record<string, string> = {
  pending: "bg-slate-100 text-slate-700",
  blocked: "bg-red-100 text-red-800",
  in_progress: "bg-blue-100 text-blue-800",
  review: "bg-amber-100 text-amber-800",
  completed: "bg-emerald-100 text-emerald-800",
  skipped: "bg-slate-200 text-slate-500",
  cancelled: "bg-slate-200 text-slate-500",
};

export function ProgrammeStepStatusBadge({ status }: { status: string }) {
  const t = useTranslations("programme");
  return (
    <Badge variant="outline" className={stepColorByStatus[status] ?? ""}>
      {t(`status.step.${status}`)}
    </Badge>
  );
}
