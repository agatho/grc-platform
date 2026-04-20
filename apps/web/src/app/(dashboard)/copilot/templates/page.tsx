"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { FileText, Plus, Edit, Trash } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CopilotPromptTemplate } from "@grc/shared";

export default function PromptTemplatesPage() {
  const t = useTranslations("copilot");
  const [templates, setTemplates] = useState<CopilotPromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/copilot/templates");
      if (res.ok) {
        const json = await res.json();
        setTemplates(json.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("templates.title")}</h1>
          <p className="text-muted-foreground">{t("templates.description")}</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          {t("templates.create")}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => (
          <Card key={template.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  {template.name}
                </CardTitle>
                <Badge variant={template.isActive ? "default" : "secondary"}>
                  {template.category}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                {template.description ?? t("templates.noDescription")}
              </p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>v{template.version}</span>
                {template.moduleKey && (
                  <Badge variant="outline">{template.moduleKey}</Badge>
                )}
              </div>
              <div className="flex items-center gap-1 mt-2 text-xs">
                {template.variables.map((v) => (
                  <Badge key={v.name} variant="outline" className="text-xs">
                    {`{${v.name}}`}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
