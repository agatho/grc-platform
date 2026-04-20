"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { TaxGobdArchive } from "@grc/shared";

export default function TaxGobdArchivesPage() {
  const t = useTranslations("taxCms");
  const [rows, setRows] = useState<TaxGobdArchive[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/tax-cms/gobd-archives?limit=50");
      if (res.ok) setRows((await res.json()).data);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void fetchData();
  }, [fetchData]);
  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("nav.gobdArchives")}</h1>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Document
        </Button>
      </div>
      <div className="space-y-2">
        {rows.map((doc) => (
          <Card key={doc.id}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {doc.archiveCode} - {doc.documentTitle}
                </p>
                <p className="text-sm text-muted-foreground">
                  {doc.documentType} | {doc.taxYear} | Retention:{" "}
                  {doc.retentionYears}y
                </p>
              </div>
              <div className="flex gap-2">
                <Badge variant={doc.gobdCompliant ? "default" : "destructive"}>
                  {doc.gobdCompliant ? "GoBD OK" : "Non-compliant"}
                </Badge>
                <Badge variant="outline">{doc.status}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
        {rows.length === 0 && (
          <p className="text-muted-foreground text-center py-8">
            No GoBD archive documents yet
          </p>
        )}
      </div>
    </div>
  );
}
