"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  Loader2,
  RefreshCcw,
} from "lucide-react";
import Link from "next/link";

import { ModuleGate } from "@/components/module/module-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { MyPendingPolicy } from "@grc/shared";

export default function MyPoliciesPage() {
  const t = useTranslations("policies");
  const router = useRouter();
  const [policies, setPolicies] = useState<MyPendingPolicy[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/policies/my-pending");
      if (res.ok) {
        const json = await res.json();
        setPolicies(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const overdue = policies.filter((p) => p.status === "overdue");
  const pending = policies.filter((p) => p.status === "pending" || p.status === "failed_quiz");
  const acknowledged = policies.filter((p) => p.status === "acknowledged");

  const [showAcknowledged, setShowAcknowledged] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <ModuleGate moduleKey="dms">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {t("myPolicies.title")}
            </h1>
            <p className="text-muted-foreground">
              {t("myPolicies.description")}
            </p>
          </div>
          <Button variant="outline" size="icon" onClick={fetchData}>
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div>

        {/* Overdue Section */}
        {overdue.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <h2 className="text-lg font-semibold text-red-600">
                {t("myPolicies.overdue")}
              </h2>
              <Badge variant="destructive">{overdue.length}</Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {overdue.map((policy) => (
                <PolicyCard key={policy.distributionId} policy={policy} t={t} />
              ))}
            </div>
          </div>
        )}

        {/* Pending Section */}
        {pending.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <h2 className="text-lg font-semibold text-yellow-600">
                {t("myPolicies.open")}
              </h2>
              <Badge className="bg-yellow-100 text-yellow-800">{pending.length}</Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {pending.map((policy) => (
                <PolicyCard key={policy.distributionId} policy={policy} t={t} />
              ))}
            </div>
          </div>
        )}

        {/* Acknowledged Section */}
        {acknowledged.length > 0 && (
          <div className="space-y-3">
            <button
              className="flex items-center gap-2 text-left"
              onClick={() => setShowAcknowledged(!showAcknowledged)}
            >
              <CheckCircle className="h-5 w-5 text-green-600" />
              <h2 className="text-lg font-semibold text-green-600">
                {t("myPolicies.acknowledged")}
              </h2>
              <Badge className="bg-green-100 text-green-800">{acknowledged.length}</Badge>
              <span className="text-xs text-muted-foreground">
                {showAcknowledged ? t("myPolicies.collapse") : t("myPolicies.expand")}
              </span>
            </button>
            {showAcknowledged && (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {acknowledged.map((policy) => (
                  <PolicyCard key={policy.distributionId} policy={policy} t={t} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {policies.length === 0 && (
          <Card className="py-12">
            <CardContent className="text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">{t("myPolicies.empty")}</p>
              <p className="text-sm text-muted-foreground">
                {t("myPolicies.emptyDesc")}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </ModuleGate>
  );
}

function PolicyCard({
  policy,
  t,
}: {
  policy: MyPendingPolicy;
  t: ReturnType<typeof useTranslations>;
}) {
  const deadlineDate = new Date(policy.deadline);
  const now = new Date();
  const daysRemaining = Math.ceil(
    (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  return (
    <Link href={`/my-policies/${policy.distributionId}`}>
      <Card className="hover:border-primary transition-colors cursor-pointer h-full">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <CardTitle className="text-base">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                {policy.distributionTitle}
              </div>
            </CardTitle>
          </div>
          <CardDescription>
            {policy.documentTitle} v{policy.documentVersion}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant={policy.isMandatory ? "destructive" : "secondary"}>
              {policy.isMandatory ? t("mandatory") : t("optional")}
            </Badge>
            {policy.requiresQuiz && (
              <Badge variant="outline">
                {t("myPolicies.quiz")} ({policy.quizPassThreshold}%)
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {policy.status === "acknowledged" ? (
              <>
                {t("myPolicies.acknowledgedOn")}{" "}
                {policy.acknowledgedAt
                  ? new Date(policy.acknowledgedAt).toLocaleDateString("de-DE")
                  : "-"}
              </>
            ) : (
              <>
                {t("distribution.deadline")}:{" "}
                {deadlineDate.toLocaleDateString("de-DE")}
                {daysRemaining > 0 && (
                  <span className="ml-1">
                    ({daysRemaining} {t("myPolicies.daysRemaining")})
                  </span>
                )}
                {daysRemaining <= 0 && (
                  <span className="ml-1 text-red-600 font-medium">
                    ({t("myPolicies.overdue")})
                  </span>
                )}
              </>
            )}
          </p>
          {policy.status !== "acknowledged" && (
            <Button size="sm" className="w-full mt-2">
              {t("myPolicies.readAndAcknowledge")}
            </Button>
          )}
          {policy.status === "failed_quiz" && (
            <p className="text-xs text-orange-600">
              {t("myPolicies.failedQuiz")} ({policy.quizScore}%)
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
