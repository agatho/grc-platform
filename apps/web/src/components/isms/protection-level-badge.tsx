import { Badge } from "@/components/ui/badge";
import type { ProtectionLevel } from "@grc/shared";

const levelStyles: Record<ProtectionLevel, string> = {
  normal: "bg-green-100 text-green-800 border-green-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  very_high: "bg-red-100 text-red-800 border-red-200",
};

const levelLabels: Record<ProtectionLevel, { en: string; de: string }> = {
  normal: { en: "Normal", de: "Normal" },
  high: { en: "High", de: "Hoch" },
  very_high: { en: "Very High", de: "Sehr Hoch" },
};

interface ProtectionLevelBadgeProps {
  level: ProtectionLevel | null | undefined;
  locale?: "en" | "de";
  className?: string;
}

export function ProtectionLevelBadge({
  level,
  locale = "en",
  className = "",
}: ProtectionLevelBadgeProps) {
  if (!level) {
    return (
      <Badge variant="outline" className={`bg-gray-50 text-gray-400 border-gray-200 ${className}`}>
        --
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className={`${levelStyles[level]} ${className}`}>
      {levelLabels[level][locale]}
    </Badge>
  );
}
