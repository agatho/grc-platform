"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  FileText,
  Download,
  Loader2,
  CheckCircle2,
  Shield,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface TemplatePack {
  id: string;
  key: string;
  name: string;
  description: string | null;
  frameworkKey: string;
  version: string;
  itemCount: number;
  isDefault: boolean;
}

export default function TemplateLibraryPage() {
  const t = useTranslations("onboarding");
  const [packs, setPacks] = useState<TemplatePack[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/template-packs");
      if (res.ok) {
        const data = await res.json();
        setPacks(data.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const applyPack = async (packId: string) => {
    setApplying(packId);
    try {
      await fetch(`/api/v1/template-packs/${packId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId, options: {} }),
      });
    } finally {
      setApplying(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {t("templates.title")}
        </h1>
        <p className="text-muted-foreground">{t("templates.subtitle")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {packs.map((pack) => (
          <Card key={pack.id}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">{pack.name}</CardTitle>
                  <CardDescription>v{pack.version}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {pack.description}
              </p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {pack.itemCount} {t("templates.items")}
                  </Badge>
                  {pack.isDefault && (
                    <Badge variant="secondary">
                      {t("templates.recommended")}
                    </Badge>
                  )}
                </div>
                <Button
                  size="sm"
                  onClick={() => applyPack(pack.id)}
                  disabled={applying === pack.id}
                >
                  {applying === pack.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  {t("templates.apply")}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
