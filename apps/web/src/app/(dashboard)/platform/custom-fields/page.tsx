"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Settings2, Loader2, GripVertical } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CustomFieldDefinition } from "@grc/shared";

export default function CustomFieldsPage() {
  return (
    <ModuleGate moduleKey="erm">
      <CustomFieldsInner />
    </ModuleGate>
  );
}

function CustomFieldsInner() {
  const t = useTranslations("platformAdvanced");
  const [fields, setFields] = useState<CustomFieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntity, setSelectedEntity] = useState("risk");

  const entityTypes = ["risk", "control", "process", "asset", "vendor", "incident", "document", "finding"];

  const fetchFields = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/custom-fields/${selectedEntity}`);
      if (res.ok) {
        const json = await res.json();
        setFields(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedEntity]);

  useEffect(() => {
    fetchFields();
  }, [fetchFields]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("customFields")}</h1>
          <p className="text-muted-foreground">{t("customFieldsDescription")}</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          {t("addField")}
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {entityTypes.map((et) => (
          <Button
            key={et}
            variant={selectedEntity === et ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedEntity(et)}
          >
            {t(`entity.${et}`)}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : fields.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Settings2 className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>{t("noCustomFields")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {fields.map((field) => (
            <Card key={field.id}>
              <CardContent className="flex items-center gap-4 py-3">
                <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                <div className="flex-1">
                  <span className="font-medium">{field.label.en ?? field.label.de ?? field.fieldKey}</span>
                  <span className="ml-2 text-sm text-muted-foreground">{field.fieldKey}</span>
                </div>
                <Badge variant="outline">{field.fieldType}</Badge>
                {field.validation?.required && <Badge variant="destructive">{t("required")}</Badge>}
                {field.showInList && <Badge>{t("showInList")}</Badge>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
