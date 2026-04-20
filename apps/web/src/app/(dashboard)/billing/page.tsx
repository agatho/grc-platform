"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  CreditCard,
  Receipt,
  BarChart3,
  Loader2,
  ArrowUpRight,
  Check,
  Gauge,
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

interface PlanInfo {
  subscription: {
    id: string;
    status: string;
    billingCycle: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    trialEndsAt: string | null;
  };
  plan: {
    id: string;
    key: string;
    name: string;
    tier: string;
    priceMonthly: number | null;
    priceYearly: number | null;
    maxUsers: number | null;
    maxApiCallsPerMonth: number | null;
    maxStorageGb: number | null;
  };
}

interface UsageSummary {
  period: { start: string; end: string };
  meters: Array<{
    meterKey: string;
    meterName: string;
    unit: string;
    totalQuantity: number;
  }>;
}

interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  status: string;
  total: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
}

export default function BillingPage() {
  const t = useTranslations("billing");
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [subRes, usageRes, invRes] = await Promise.all([
        fetch("/api/v1/subscriptions/current"),
        fetch("/api/v1/usage/summary"),
        fetch("/api/v1/billing/invoices?limit=5"),
      ]);
      if (subRes.ok) {
        const data = await subRes.json();
        setPlanInfo(data.data);
      }
      if (usageRes.ok) {
        const data = await usageRes.json();
        setUsage(data.data);
      }
      if (invRes.ok) {
        const data = await invRes.json();
        setInvoices(data.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency,
    }).format(amount / 100);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Link href="/billing/plans">
          <Button variant="outline">
            <ArrowUpRight className="mr-2 h-4 w-4" />
            {t("changePlan")}
          </Button>
        </Link>
      </div>

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {t("currentPlan")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {planInfo ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{planInfo.plan.name}</p>
                <p className="text-muted-foreground">
                  {planInfo.plan.priceMonthly
                    ? formatCurrency(
                        planInfo.subscription.billingCycle === "yearly"
                          ? (planInfo.plan.priceYearly ?? 0)
                          : planInfo.plan.priceMonthly,
                        "EUR",
                      )
                    : t("contactSales")}
                  {planInfo.plan.priceMonthly &&
                    `/${planInfo.subscription.billingCycle === "yearly" ? t("year") : t("month")}`}
                </p>
              </div>
              <div className="text-right">
                <Badge
                  variant={
                    planInfo.subscription.status === "active"
                      ? "default"
                      : "secondary"
                  }
                >
                  {planInfo.subscription.status}
                </Badge>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("periodEnds")}:{" "}
                  {new Date(
                    planInfo.subscription.currentPeriodEnd,
                  ).toLocaleDateString()}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted-foreground">{t("noPlan")}</p>
              <Link href="/billing/plans">
                <Button className="mt-2">{t("choosePlan")}</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage Summary */}
      {usage && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="h-5 w-5" />
              {t("usage.title")}
            </CardTitle>
            <CardDescription>
              {t("usage.period")}:{" "}
              {new Date(usage.period.start).toLocaleDateString()} -{" "}
              {new Date(usage.period.end).toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {usage.meters.map((meter) => (
                <div key={meter.meterKey} className="rounded-lg border p-3">
                  <p className="text-sm text-muted-foreground">
                    {meter.meterName}
                  </p>
                  <p className="text-xl font-bold">
                    {Number(meter.totalQuantity).toLocaleString()} {meter.unit}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Invoices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            {t("invoices.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {t("invoices.empty")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium">
                      {t("invoices.number")}
                    </th>
                    <th className="text-left py-2 px-3 font-medium">
                      {t("invoices.status")}
                    </th>
                    <th className="text-left py-2 px-3 font-medium">
                      {t("invoices.period")}
                    </th>
                    <th className="text-right py-2 px-3 font-medium">
                      {t("invoices.total")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b">
                      <td className="py-2 px-3 font-mono text-xs">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-2 px-3">
                        <Badge
                          variant={
                            inv.status === "paid"
                              ? "default"
                              : inv.status === "overdue"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {inv.status}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-xs">
                        {new Date(inv.periodStart).toLocaleDateString()} -{" "}
                        {new Date(inv.periodEnd).toLocaleDateString()}
                      </td>
                      <td className="py-2 px-3 text-right font-medium">
                        {formatCurrency(inv.total, inv.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
