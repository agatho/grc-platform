"use client";

import { useTranslations } from "next-intl";
import {
  Download,
  Shield,
  FileSpreadsheet,
  Database,
  Building,
  FileText,
  AlertTriangle,
  GitBranch,
  Lock,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ---------------------------------------------------------------------------
// Entity type metadata
// ---------------------------------------------------------------------------

const ENTITY_TYPES = [
  {
    key: "risk",
    icon: AlertTriangle,
    requiredFields: ["title", "risk_category", "risk_source"],
  },
  {
    key: "control",
    icon: Shield,
    requiredFields: ["title", "control_type"],
  },
  {
    key: "asset",
    icon: Database,
    requiredFields: ["name"],
  },
  {
    key: "vendor",
    icon: Building,
    requiredFields: ["name"],
  },
  {
    key: "contract",
    icon: FileText,
    requiredFields: ["title", "contract_type"],
  },
  {
    key: "incident",
    icon: AlertTriangle,
    requiredFields: ["title", "severity"],
  },
  {
    key: "process",
    icon: GitBranch,
    requiredFields: ["name"],
  },
  {
    key: "ropa_entry",
    icon: Lock,
    requiredFields: ["title", "purpose", "legal_basis"],
  },
] as const;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ImportTemplatesPage() {
  const t = useTranslations("import");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("templates.title")}</h1>
        <p className="text-muted-foreground">{t("templates.subtitle")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {ENTITY_TYPES.map((entity) => {
          const Icon = entity.icon;
          return (
            <Card key={entity.key} className="flex flex-col justify-between">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">
                    {t(`entityTypes.${entity.key}`)}
                  </CardTitle>
                </div>
                <CardDescription>
                  {t("templates.info")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium">
                        {t("templates.requiredFields")}:
                      </span>{" "}
                      {entity.requiredFields.join(", ")}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      These fields must be present in your CSV file
                    </p>
                  </TooltipContent>
                </Tooltip>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() =>
                    window.open(
                      `/api/v1/import/templates/${entity.key}`,
                      "_blank",
                    )
                  }
                >
                  <Download className="mr-2 h-4 w-4" />
                  {t("templates.download")}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
