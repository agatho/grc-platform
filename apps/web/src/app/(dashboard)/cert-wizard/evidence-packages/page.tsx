"use client";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { CertEvidencePackage } from "@grc/shared";

export default function CertEvidencePackagesPage() {
  const t = useTranslations("certWizard");
  // [OP-245 · Gestalt A] Fetch on mount via `@tanstack/react-query` instead
  // of an effect plus mirrored loading/data state (pattern from wave 7b,
  // `catalogs/objects/page.tsx`). A non-ok response yields an empty list, as
  // before.
  const { data: rows = [], isPending: loading } = useQuery<
    CertEvidencePackage[]
  >({
    queryKey: ["cert-wizard", "evidence-packages"],
    queryFn: async () => {
      const res = await fetch("/api/v1/cert-wizard/evidence-packages?limit=50");
      if (!res.ok) return [];
      return (await res.json()).data as CertEvidencePackage[];
    },
  });
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
