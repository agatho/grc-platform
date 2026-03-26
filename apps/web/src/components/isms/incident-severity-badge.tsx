import { Badge } from "@/components/ui/badge";
import type { IncidentSeverity } from "@grc/shared";

const severityStyles: Record<IncidentSeverity, string> = {
  low: "bg-gray-100 text-gray-700 border-gray-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  critical: "bg-red-100 text-red-800 border-red-200",
};

const severityLabels: Record<IncidentSeverity, { en: string; de: string }> = {
  low: { en: "Low", de: "Niedrig" },
  medium: { en: "Medium", de: "Mittel" },
  high: { en: "High", de: "Hoch" },
  critical: { en: "Critical", de: "Kritisch" },
};

interface IncidentSeverityBadgeProps {
  severity: IncidentSeverity;
  locale?: "en" | "de";
  className?: string;
}

export function IncidentSeverityBadge({
  severity,
  locale = "en",
  className = "",
}: IncidentSeverityBadgeProps) {
  return (
    <Badge variant="outline" className={`${severityStyles[severity]} ${className}`}>
      {severityLabels[severity][locale]}
    </Badge>
  );
}
