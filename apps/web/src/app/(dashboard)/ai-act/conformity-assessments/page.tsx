"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { AiConformityAssessment } from "@grc/shared";

const RESULT_COLORS: Record<string, string> = {
  pass: "bg-green-100 text-green-900",
  fail: "bg-red-100 text-red-900",
  conditional: "bg-yellow-100 text-yellow-900",
  pending: "bg-gray-100 text-gray-700",
};

export default function AiConformityAssessmentsPage() {
  const t = useTranslations("aiAct");
  const [rows, setRows] = useState<AiConformityAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/ai-act/conformity-assessments?limit=50");
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
        <h1 className="text-2xl font-bold">{t("nav.conformityAssessments")}</h1>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Assessment
        </Button>
      </div>
      <div className="space-y-2">
        {rows.map((a) => (
          <Card key={a.id}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {a.assessmentCode} - {a.assessmentType}
                </p>
                <p className="text-sm text-muted-foreground">
                  {a.assessorName ?? "Self"} |{" "}
                  {a.validUntil ? `Valid until ${a.validUntil}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                {a.overallResult && (
                  <Badge className={RESULT_COLORS[a.overallResult] ?? ""}>
                    {a.overallResult}
                  </Badge>
                )}
                <Badge variant="outline">{a.status}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
        {rows.length === 0 && (
          <p className="text-muted-foreground text-center py-8">
            No conformity assessments yet
          </p>
        )}
      </div>
    </div>
  );
}
