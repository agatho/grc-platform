"use client";
import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Plus, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ModuleGate } from "@/components/module/module-gate";
import { ModuleTabNav } from "@/components/layout/module-tab-nav";
import { useDateFormat } from "@/lib/format-date";

/**
 * [ARCTOS-FULL-2026-08-31 · OP-070] Welle 6b. `const _t = useTranslations(…)`
 * ohne Benutzung — fuer die Ratsche uebersetzt, auf dem Bildschirm fest
 * verdrahtetes Deutsch mit abgeschnittenen Umlauten („Korrekturmasnahmen",
 * „Ruckruf", „Prioritat", „Falligkeitsdatum").
 */
interface CorrectiveAction {
  id: string;
  title: string;
  ai_system_id: string | null;
  action_type: string;
  priority: string;
  status: string;
  due_date: string | null;
  is_recall: boolean;
  is_withdrawal: boolean;
  created_at: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-900",
  high: "bg-orange-100 text-orange-900",
  medium: "bg-yellow-100 text-yellow-900",
  low: "bg-green-100 text-green-900",
};
const STATUS_COLORS: Record<string, string> = {
  open: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-900",
  completed: "bg-green-100 text-green-900",
  verified: "bg-green-200 text-green-900",
};

function CorrectiveActionsInner() {
  const t = useTranslations("aiAct");
  const tCommon = useTranslations("common");
  const { formatDate } = useDateFormat();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    ai_system_id: "",
    action_type: "corrective",
    priority: "medium",
    due_date: "",
    is_recall: false,
    is_withdrawal: false,
  });

  // [OP-245 · Gestalt A] Abruf beim Einhängen über `@tanstack/react-query`
  // statt Effekt plus gespiegeltem Lade- und Datenzustand (Muster aus
  // Welle 7b, `catalogs/objects/page.tsx`). Eine nicht-ok-Antwort liefert wie
  // vorher eine leere Liste.
  const {
    data: rows = [],
    isPending: loading,
    refetch,
  } = useQuery<CorrectiveAction[]>({
    queryKey: ["ai-act", "corrective-actions"],
    queryFn: async () => {
      const res = await fetch("/api/v1/ai-act/corrective-actions?limit=50");
      if (!res.ok) return [];
      return (await res.json()).data as CorrectiveAction[];
    },
  });
  const fetchData = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const handleSubmit = async () => {
    const payload = {
      ...form,
      ai_system_id: form.ai_system_id || null,
      due_date: form.due_date || null,
    };
    const res = await fetch("/api/v1/ai-act/corrective-actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setDialogOpen(false);
      setForm({
        title: "",
        description: "",
        ai_system_id: "",
        action_type: "corrective",
        priority: "medium",
        due_date: "",
        is_recall: false,
        is_withdrawal: false,
      });
      void fetchData();
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );

  return (
    <div className="space-y-6">
      <ModuleTabNav />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("correctiveList.title")}</h1>
          <p className="text-muted-foreground">
            {t("correctiveList.description")}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              {t("correctiveList.create")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t("correctiveList.dialogTitle")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{t("shared.title")}</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div>
                <Label>{t("shared.description")}</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>{t("incidentList.systemIdOptional")}</Label>
                <Input
                  value={form.ai_system_id}
                  onChange={(e) =>
                    setForm({ ...form, ai_system_id: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>{t("correctiveAction.actionType")}</Label>
                <Select
                  value={form.action_type}
                  onValueChange={(v) => setForm({ ...form, action_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corrective">
                      {t("correctiveAction.typeOption.corrective")}
                    </SelectItem>
                    <SelectItem value="preventive">
                      {t("correctiveAction.typeOption.preventive")}
                    </SelectItem>
                    <SelectItem value="recall">
                      {t("correctiveAction.typeOption.recall")}
                    </SelectItem>
                    <SelectItem value="withdrawal">
                      {t("correctiveAction.typeOption.withdrawal")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("correctiveAction.priority")}</Label>
                <Select
                  value={form.priority}
                  onValueChange={(v) => setForm({ ...form, priority: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">
                      {t("incidentDetail.severityOption.critical")}
                    </SelectItem>
                    <SelectItem value="high">
                      {t("incidentDetail.severityOption.high")}
                    </SelectItem>
                    <SelectItem value="medium">
                      {t("incidentDetail.severityOption.medium")}
                    </SelectItem>
                    <SelectItem value="low">
                      {t("incidentDetail.severityOption.low")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("correctiveAction.dueDate")}</Label>
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={(e) =>
                    setForm({ ...form, due_date: e.target.value })
                  }
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.is_recall}
                  onCheckedChange={(v) => setForm({ ...form, is_recall: v })}
                />
                <Label>{t("correctiveAction.recall")}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.is_withdrawal}
                  onCheckedChange={(v) =>
                    setForm({ ...form, is_withdrawal: v })
                  }
                />
                <Label>{t("correctiveAction.withdrawalFromMarket")}</Label>
              </div>
              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={!form.title || !form.action_type || !form.priority}
              >
                {tCommon("actions.save")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="space-y-2">
        {rows.map((a) => (
          <Link key={a.id} href={`/ai-act/corrective-actions/${a.id}`}>
            <Card
              className={`hover:border-primary/50 transition-colors cursor-pointer ${a.is_recall || a.is_withdrawal ? "border-red-300" : ""}`}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{a.title}</p>
                    {(a.is_recall || a.is_withdrawal) && (
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t(`correctiveAction.typeOption.${a.action_type}`)}
                    {a.due_date
                      ? t("correctiveList.dueSuffix", {
                          value: formatDate(a.due_date),
                        })
                      : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  {a.is_recall && (
                    <Badge className="bg-red-600 text-white">
                      {t("correctiveAction.recall")}
                    </Badge>
                  )}
                  {a.is_withdrawal && (
                    <Badge className="bg-red-600 text-white">
                      {t("correctiveAction.withdrawal")}
                    </Badge>
                  )}
                  <Badge className={PRIORITY_COLORS[a.priority] ?? ""}>
                    {t(`incidentDetail.severityOption.${a.priority}`)}
                  </Badge>
                  <Badge
                    className={STATUS_COLORS[a.status] ?? ""}
                    variant="outline"
                  >
                    {a.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {rows.length === 0 && (
          <p className="text-muted-foreground text-center py-8">
            {t("correctiveList.empty")}
          </p>
        )}
      </div>
    </div>
  );
}

export default function CorrectiveActionsPage() {
  return (
    <ModuleGate moduleKey="isms">
      <CorrectiveActionsInner />
    </ModuleGate>
  );
}
