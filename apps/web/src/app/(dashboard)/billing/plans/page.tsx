"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Check,
  Loader2,
  Zap,
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

interface Plan {
  id: string;
  key: string;
  name: string;
  description: string | null;
  tier: string;
  priceMonthly: number | null;
  priceYearly: number | null;
  maxUsers: number | null;
  maxOrganizations: number | null;
  maxStorageGb: number | null;
  maxApiCallsPerMonth: number | null;
  features: Record<string, unknown>;
  trialDays: number;
}

export default function PlansPage() {
  const t = useTranslations("billing");
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/subscriptions/plans");
      if (res.ok) {
        const data = await res.json();
        setPlans(data.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const subscribe = async (planId: string) => {
    setSubscribing(planId);
    try {
      const res = await fetch("/api/v1/subscriptions/current", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, billingCycle }),
      });
      if (res.ok) {
        router.push("/billing");
      }
    } finally {
      setSubscribing(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
    }).format(amount / 100);
  };

  const formatLimit = (val: number | null) => {
    if (val === null || val === -1) return t("plans.unlimited");
    return val.toLocaleString();
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
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">{t("plans.title")}</h1>
        <p className="text-muted-foreground mt-2">{t("plans.subtitle")}</p>
      </div>

      <div className="flex justify-center gap-2">
        <Button
          variant={billingCycle === "monthly" ? "default" : "outline"}
          size="sm"
          onClick={() => setBillingCycle("monthly")}
        >
          {t("plans.monthly")}
        </Button>
        <Button
          variant={billingCycle === "yearly" ? "default" : "outline"}
          size="sm"
          onClick={() => setBillingCycle("yearly")}
        >
          {t("plans.yearly")}
          <Badge variant="secondary" className="ml-2">{t("plans.save20")}</Badge>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        {plans.map((plan) => {
          const price = billingCycle === "yearly" ? plan.priceYearly : plan.priceMonthly;
          const isPopular = plan.tier === "professional";
          return (
            <Card
              key={plan.id}
              className={isPopular ? "border-primary shadow-lg relative" : ""}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    {t("plans.popular")}
                  </Badge>
                </div>
              )}
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="pt-2">
                  {price !== null ? (
                    <div>
                      <span className="text-3xl font-bold">{formatCurrency(price)}</span>
                      <span className="text-muted-foreground">
                        /{billingCycle === "yearly" ? t("year") : t("month")}
                      </span>
                    </div>
                  ) : (
                    <span className="text-2xl font-bold">{t("plans.custom")}</span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    {formatLimit(plan.maxUsers)} {t("plans.users")}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    {formatLimit(plan.maxOrganizations)} {t("plans.organizations")}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    {formatLimit(plan.maxStorageGb)} GB {t("plans.storage")}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    {formatLimit(plan.maxApiCallsPerMonth)} {t("plans.apiCalls")}
                  </li>
                </ul>
                {plan.trialDays > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {plan.trialDays} {t("plans.trialDays")}
                  </p>
                )}
                <Button
                  className="w-full"
                  variant={isPopular ? "default" : "outline"}
                  onClick={() => subscribe(plan.id)}
                  disabled={subscribing === plan.id}
                >
                  {subscribing === plan.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {price !== null ? t("plans.subscribe") : t("plans.contactSales")}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
