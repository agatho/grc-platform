"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  Clock,
  Plus,
  Loader2,
  RefreshCcw,
  ArrowLeft,
  Trash2,
  Pause,
  Play,
  Mail,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { ReportSchedule, ReportTemplate } from "@grc/shared";

export default function ScheduledReportsPage() {
  const t = useTranslations("reporting");

  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  // Form state
  const [formTemplateId, setFormTemplateId] = useState("");
  const [formName, setFormName] = useState("");
  const [formCron, setFormCron] = useState("0 8 1 * *");
  const [formFormat, setFormFormat] = useState<"pdf" | "xlsx">("pdf");
  const [formEmails, setFormEmails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [schedulesRes, templatesRes] = await Promise.all([
        fetch("/api/v1/reports/schedules?limit=100"),
        fetch("/api/v1/reports/templates?limit=100"),
      ]);
      if (schedulesRes.ok) {
        const data = await schedulesRes.json();
        setSchedules(data.data || []);
      }
      if (templatesRes.ok) {
        const data = await templatesRes.json();
        setTemplates(data.data || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async () => {
    if (!formTemplateId || !formEmails.trim()) return;
    setSubmitting(true);
    try {
      const emails = formEmails
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);
      const res = await fetch("/api/v1/reports/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: formTemplateId,
          name: formName || undefined,
          cronExpression: formCron,
          recipientEmails: emails,
          outputFormat: formFormat,
        }),
      });
      if (res.ok) {
        setCreateOpen(false);
        setFormTemplateId("");
        setFormName("");
        setFormEmails("");
        fetchData();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (schedule: ReportSchedule) => {
    await fetch(`/api/v1/reports/schedules/${schedule.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !schedule.isActive }),
    });
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/v1/reports/schedules/${id}`, { method: "DELETE" });
    fetchData();
  };

  const cronLabel = (cron: string) => {
    if (cron.includes("* * *")) return t("cronDaily");
    if (cron.match(/\d+ \d+ \* \* \d/)) return t("cronWeekly");
    if (cron.match(/\d+ \d+ \d+ \* \*/)) return t("cronMonthly");
    return cron;
  };

  return (
    <ModuleGate moduleKey="reporting">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/reports">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {t("schedulesTitle")}
              </h1>
              <p className="text-muted-foreground">{t("schedulesSubtitle")}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t("createSchedule")}
            </Button>
            <Button onClick={fetchData} variant="ghost" size="icon">
              <RefreshCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Schedule Table */}
        <Card>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left font-medium">
                      {t("scheduleName")}
                    </th>
                    <th className="px-4 py-3 text-left font-medium">
                      {t("scheduleTemplate")}
                    </th>
                    <th className="px-4 py-3 text-left font-medium">
                      {t("scheduleFrequency")}
                    </th>
                    <th className="px-4 py-3 text-left font-medium">
                      {t("scheduleRecipients")}
                    </th>
                    <th className="px-4 py-3 text-left font-medium">
                      {t("scheduleNextRun")}
                    </th>
                    <th className="px-4 py-3 text-left font-medium">
                      {t("scheduleStatus")}
                    </th>
                    <th className="px-4 py-3 text-left font-medium">
                      {t("scheduleActions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map((schedule) => (
                    <tr key={schedule.id} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium">
                        {schedule.name || "—"}
                      </td>
                      <td className="px-4 py-3">
                        {schedule.templateName || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">
                          {cronLabel(schedule.cronExpression)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {(schedule.recipientEmails || []).length}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {schedule.nextRunAt
                          ? new Date(schedule.nextRunAt).toLocaleString("de-DE")
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={schedule.isActive ? "default" : "secondary"}
                        >
                          {schedule.isActive
                            ? t("scheduleActive")
                            : t("schedulePaused")}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleToggle(schedule)}
                          >
                            {schedule.isActive ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(schedule.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {schedules.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-center text-muted-foreground"
                      >
                        {t("noSchedules")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Create Schedule Dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("createSchedule")}</DialogTitle>
              <DialogDescription>
                {t("createScheduleDescription")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium">
                  {t("scheduleNameLabel")}
                </label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={t("scheduleNamePlaceholder")}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">
                  {t("selectTemplate")}
                </label>
                <Select
                  value={formTemplateId}
                  onValueChange={setFormTemplateId}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={t("selectTemplatePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">
                  {t("cronExpression")}
                </label>
                <Select value={formCron} onValueChange={setFormCron}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0 8 * * 1">{t("cronWeekly")}</SelectItem>
                    <SelectItem value="0 8 1 * *">
                      {t("cronMonthly")}
                    </SelectItem>
                    <SelectItem value="0 8 1 */3 *">
                      {t("cronQuarterly")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">
                  {t("outputFormat")}
                </label>
                <Select
                  value={formFormat}
                  onValueChange={(v) => setFormFormat(v as "pdf" | "xlsx")}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="xlsx">Excel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">
                  {t("recipientEmails")}
                </label>
                <Input
                  value={formEmails}
                  onChange={(e) => setFormEmails(e.target.value)}
                  placeholder={t("recipientEmailsPlaceholder")}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t("recipientEmailsHint")}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                {t("cancel")}
              </Button>
              <Button onClick={handleCreate} disabled={submitting}>
                {submitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t("create")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ModuleGate>
  );
}
