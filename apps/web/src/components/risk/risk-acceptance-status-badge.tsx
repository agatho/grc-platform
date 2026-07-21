"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { isRiskAcceptanceStatus, type RiskAcceptanceStatus } from "@grc/shared";

// Status badge for risk-acceptance records (active / expired / revoked).
// Colors mirror the governance semantics: green = decision in force,
// orange = lapsed by time, red = actively withdrawn.

const STATUS_CLASSES: Record<RiskAcceptanceStatus, string> = {
  active: "bg-green-100 text-green-900 border-green-200",
  expired: "bg-orange-100 text-orange-900 border-orange-200",
  revoked: "bg-red-100 text-red-900 border-red-200",
};

export function RiskAcceptanceStatusBadge({ status }: { status: string }) {
  const t = useTranslations("risk.acceptance");

  if (!isRiskAcceptanceStatus(status)) {
    return (
      <Badge
        variant="outline"
        className="bg-gray-100 text-gray-600 border-gray-200"
      >
        {status}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className={STATUS_CLASSES[status]}>
      {t(`status.${status}`)}
    </Badge>
  );
}
