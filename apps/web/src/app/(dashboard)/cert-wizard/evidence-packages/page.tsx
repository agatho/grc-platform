"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { CertEvidencePackage } from "@grc/shared";

export default function CertEvidencePackagesPage() {
  const t = useTranslations("certWizard");
  const [rows, setRows] = useState<CertEvidencePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/cert-wizard/evidence-packages?limit=50");
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
        <h1 className="text-2xl font-bold">{t("nav.evidencePackages")}</h1>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Package
        </Button>
      </div>
      <div className="space-y-2">
        {rows.map((pkg) => (
          <Card key={pkg.id}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {pkg.packageCode} - {pkg.title}
                </p>
                <p className="text-sm text-muted-foreground">
                  {pkg.framework} | {pkg.controlRefs?.length ?? 0} controls
                </p>
              </div>
              <div className="flex gap-2 items-center">
                {pkg.completeness != null && (
                  <p className="text-sm font-bold">
                    {Number(pkg.completeness).toFixed(0)}%
                  </p>
                )}
                <Badge variant="outline">{pkg.status}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
        {rows.length === 0 && (
          <p className="text-muted-foreground text-center py-8">
            No evidence packages yet
          </p>
        )}
      </div>
    </div>
  );
}
