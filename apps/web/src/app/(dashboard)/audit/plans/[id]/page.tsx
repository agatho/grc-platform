"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  Plus,
  ArrowLeft,
  Check,
  X,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { AuditPlan, AuditPlanItem } from "@grc/shared";

export default function PlanDetailPage() {
  return (
    <ModuleGate moduleKey="audit">
      <PlanDetailInner />
    </ModuleGate>
  );
}

function PlanDetailInner() {
  const t = useTranslations("auditMgmt");
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [plan, setPlan] = useState<AuditPlan | null>(null);
  const [items, setItems] = useState<AuditPlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchPlan = useCallback(async () => {
    setLoading(true);
    try {
      const [planRes, itemsRes] = await Promise.all([
        fetch(`/api/v1/audit-mgmt/plans/${params.id}`),
        fetch(`/api/v1/audit-mgmt/plans/${params.id}/items?limit=100`),
      ]);

      if (planRes.ok) {
        const json = await planRes.json();
        setPlan(json.data);
      }
      if (itemsRes.ok) {
        const json = await itemsRes.json();
        setItems(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void fetchPlan();
  }, [fetchPlan]);

  const handleStatusChange = async (newStatus: string) => {
    const res = await fetch(`/api/v1/audit-mgmt/plans/${params.id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      void fetchPlan();
    }
  };

  const handleCreateItem = async (formData: FormData) => {
    const body = {
      auditPlanId: params.id,
      title: formData.get("title") as string,
      scopeDescription: formData.get("scopeDescription") as string || undefined,
      plannedStart: formData.get("plannedStart") as string || undefined,
      plannedEnd: formData.get("plannedEnd") as string || undefined,
      estimatedDays: formData.get("estimatedDays") ? Number(formData.get("estimatedDays")) : undefined,
    };

    const res = await fetch(`/api/v1/audit-mgmt/plans/${params.id}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setDialogOpen(false);
      void fetchPlan();
    }
  };

  if (loading && !plan) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">{t("planNotFound")}</p>
        <Link href="/audit/plans" className="text-blue-600 text-sm mt-2 inline-block">
          {t("backToPlans")}
        </Link>
      </div>
    );
  }

  const statusBadge = (status: string) => {
    const map: Record<string, { className: string; label: string }> = {
      draft: { className: "bg-gray-100 text-gray-700 border-gray-300", label: t("planStatus.draft") },
      approved: { className: "bg-green-100 text-green-700 border-green-300", label: t("planStatus.approved") },
      active: { className: "bg-blue-100 text-blue-700 border-blue-300", label: t("planStatus.active") },
      completed: { className: "bg-purple-100 text-purple-700 border-purple-300", label: t("planStatus.completed") },
    };
    const config = map[status] ?? map.draft;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/audit/plans" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{plan.name}</h1>
            {statusBadge(plan.status)}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {plan.year} {plan.description ? `- ${plan.description}` : ""}
          </p>
        </div>
      </div>

      {/* Approval Actions */}
      <div className="flex gap-2">
        {plan.status === "draft" && (
          <Button size="sm" onClick={() => handleStatusChange("approved")}>
            <Check size={14} className="mr-1" />
            {t("approve")}
          </Button>
        )}
        {plan.status === "approved" && (
          <>
            <Button size="sm" onClick={() => handleStatusChange("active")}>
              {t("activate")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleStatusChange("draft")}>
              {t("revertToDraft")}
            </Button>
          </>
        )}
        {plan.status === "active" && (
          <Button size="sm" onClick={() => handleStatusChange("completed")}>
            <Check size={14} className="mr-1" />
            {t("markCompleted")}
          </Button>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">{t("totalItems")}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{items.length}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">{t("totalPlannedDays")}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{plan.totalPlannedDays ?? "-"}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">{t("estimatedDaysTotal")}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {items.reduce((sum, item) => sum + (item.estimatedDays ?? 0), 0)}
          </p>
        </div>
      </div>

      {/* Items Table */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">{t("planItems")}</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus size={14} className="mr-1" />
              {t("addItem")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("addItem")}</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleCreateItem(new FormData(e.currentTarget));
              }}
              className="space-y-4"
            >
              <div>
                <label className="text-sm font-medium">{t("itemTitle")}</label>
                <Input name="title" required />
              </div>
              <div>
                <label className="text-sm font-medium">{t("scope")}</label>
                <Input name="scopeDescription" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">{t("plannedStart")}</label>
                  <Input name="plannedStart" type="date" />
                </div>
                <div>
                  <label className="text-sm font-medium">{t("plannedEnd")}</label>
                  <Input name="plannedEnd" type="date" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">{t("estimatedDays")}</label>
                <Input name="estimatedDays" type="number" min="1" />
              </div>
              <Button type="submit" className="w-full">{t("save")}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-8 text-gray-400">{t("emptyItems")}</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t("itemTitle")}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t("scope")}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t("plannedStart")}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t("plannedEnd")}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t("estimatedDays")}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t("status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{item.title}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{item.scopeDescription ?? "-"}</td>
                  <td className="px-4 py-3 text-gray-600">{item.plannedStart ?? "-"}</td>
                  <td className="px-4 py-3 text-gray-600">{item.plannedEnd ?? "-"}</td>
                  <td className="px-4 py-3 text-gray-600">{item.estimatedDays ?? "-"}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{item.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
