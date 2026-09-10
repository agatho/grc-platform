"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  EvidenceReviewJob,
  EvidenceReviewResult,
  EvidenceReviewGap,
} from "@grc/shared";

export default function EvidenceReviewDetailPage() {
  const t = useTranslations("evidenceReview");
  const { id } = useParams<{ id: string }>();
  // [OP-245 · Gestalt A] Abruf beim Einhängen über `@tanstack/react-query`
  // statt Effekt plus gespiegeltem Lade- und Datenzustand (Muster aus
  // Welle 7b, `catalogs/objects/page.tsx`). Die drei Abrufe wurden immer
  // zusammen ausgelöst und zusammen verwendet — eine Abfrage, ein Objekt.
  const { data: pageData, isPending: loading } = useQuery<{
    job: EvidenceReviewJob | null;
    results: EvidenceReviewResult[];
    gaps: EvidenceReviewGap[];
  }>({
    queryKey: ["evidence-review", "jobs", id],
    queryFn: async () => {
      const [jobRes, resultsRes, gapsRes] = await Promise.all([
        fetch(`/api/v1/evidence-review/jobs/${id}`),
        fetch(`/api/v1/evidence-review/jobs/${id}/results?limit=50`),
        fetch(`/api/v1/evidence-review/jobs/${id}/gaps?limit=50`),
      ]);
      let job: EvidenceReviewJob | null = null;
      let results: EvidenceReviewResult[] = [];
      let gaps: EvidenceReviewGap[] = [];
      if (jobRes.ok) job = (await jobRes.json()).data;
      if (resultsRes.ok) results = (await resultsRes.json()).data;
      if (gapsRes.ok) gaps = (await gapsRes.json()).data;
      return { job, results, gaps };
    },
  });
  const job = pageData?.job ?? null;
  const results = pageData?.results ?? [];
  const gaps = pageData?.gaps ?? [];

  if (loading || !job) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/evidence-review">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{job.name}</h1>
          <p className="text-muted-foreground">
            {job.description ?? t("jobDetail")}
          </p>
        </div>
      </div>

      {/* Results Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {t("results")} ({results.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {results.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between p-3 border rounded"
              >
                <div>
                  <p className="font-medium text-sm">{r.artifactName}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("confidence")}: {Number(r.confidenceScore).toFixed(0)}%
                  </p>
                </div>
                <Badge
                  variant={
                    r.classification === "compliant" ? "default" : "destructive"
                  }
                >
                  {t(`classification.${r.classification}`)}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Gaps */}
      {gaps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              {t("gaps")} ({gaps.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {gaps.map((g) => (
                <div key={g.id} className="p-3 border rounded">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{g.title}</p>
                    <Badge>{g.severity}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {g.description}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
