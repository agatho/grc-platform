"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Webhook,
  Plus,
  Loader2,
  Check,
  X as XIcon,
  Copy,
  Eye,
  Trash2,
  TestTube2,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { WebhookRegistrationData, EventFilter } from "@grc/shared";

// ── Types ─────────────────────────────────────────────────────

const TEMPLATE_TYPES = [
  { value: "generic", label: "Generic JSON" },
  { value: "slack", label: "Slack" },
  { value: "teams", label: "Microsoft Teams" },
];

const ENTITY_TYPES = [
  "risk", "control", "process", "asset", "vendor", "contract",
  "document", "finding", "incident", "audit", "kri",
];

const EVENT_TYPES = [
  "entity.created", "entity.updated", "entity.deleted", "entity.status_changed",
];

// ── Component ─────────────────────────────────────────────────

export default function WebhooksAdminPage() {
  const t = useTranslations("platform");
  const router = useRouter();
  const [webhooks, setWebhooks] = useState<WebhookRegistrationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    statusCode?: number;
    error?: string;
  } | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formTemplate, setFormTemplate] = useState("generic");
  const [formEntityTypes, setFormEntityTypes] = useState<string[]>([]);
  const [formEventTypes, setFormEventTypes] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const fetchWebhooks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/webhooks");
      if (res.ok) {
        const json = await res.json();
        setWebhooks(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWebhooks();
  }, [fetchWebhooks]);

  const handleCreate = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          url: formUrl,
          templateType: formTemplate,
          eventFilter: {
            entityTypes: formEntityTypes.length ? formEntityTypes : undefined,
            events: formEventTypes.length ? formEventTypes : undefined,
          },
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setCreatedSecret(json.data?.secret ?? null);
        setFormName("");
        setFormUrl("");
        setFormTemplate("generic");
        setFormEntityTypes([]);
        setFormEventTypes([]);
        if (!json.data?.secret) {
          setCreateOpen(false);
        }
        fetchWebhooks();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    await fetch(`/api/v1/webhooks/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    fetchWebhooks();
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("webhooks.confirmDelete"))) return;
    await fetch(`/api/v1/webhooks/${id}`, { method: "DELETE" });
    fetchWebhooks();
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    setTestResult(null);
    try {
      const res = await fetch(`/api/v1/webhooks/${id}/test`, { method: "POST" });
      if (res.ok) {
        const json = await res.json();
        setTestResult(json.data);
      }
    } finally {
      setTestingId(null);
    }
  };

  const toggleEntityType = (type: string) => {
    setFormEntityTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  const toggleEventType = (type: string) => {
    setFormEventTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Webhook className="h-6 w-6" />
            {t("webhooks.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("webhooks.description")}
          </p>
        </div>
        <Dialog
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open);
            if (!open) setCreatedSecret(null);
          }}
        >
          <DialogTrigger asChild>
            <Button className="gap-1.5">
              <Plus className="h-4 w-4" />
              {t("webhooks.register")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("webhooks.registerNew")}</DialogTitle>
              <DialogDescription>
                {t("webhooks.registerDescription")}
              </DialogDescription>
            </DialogHeader>

            {createdSecret ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                  <p className="text-sm font-medium text-green-800 mb-2">
                    {t("webhooks.secretCreated")}
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded bg-white px-3 py-2 font-mono text-xs break-all border">
                      {createdSecret}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigator.clipboard.writeText(createdSecret)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-green-700">
                    {t("webhooks.secretWarning")}
                  </p>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => {
                      setCreateOpen(false);
                      setCreatedSecret(null);
                    }}
                  >
                    {t("webhooks.done")}
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label>{t("webhooks.name")}</Label>
                  <Input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder={t("webhooks.namePlaceholder")}
                  />
                </div>
                <div>
                  <Label>{t("webhooks.url")}</Label>
                  <Input
                    value={formUrl}
                    onChange={(e) => setFormUrl(e.target.value)}
                    placeholder="https://hooks.example.com/webhook"
                  />
                </div>
                <div>
                  <Label>{t("webhooks.template")}</Label>
                  <Select value={formTemplate} onValueChange={setFormTemplate}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEMPLATE_TYPES.map((tt) => (
                        <SelectItem key={tt.value} value={tt.value}>
                          {tt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-2 block">{t("webhooks.entityFilter")}</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {ENTITY_TYPES.map((et) => (
                      <Badge
                        key={et}
                        variant={formEntityTypes.includes(et) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => toggleEntityType(et)}
                      >
                        {et}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="mb-2 block">{t("webhooks.eventFilter")}</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {EVENT_TYPES.map((et) => (
                      <Badge
                        key={et}
                        variant={formEventTypes.includes(et) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => toggleEventType(et)}
                      >
                        {et.replace("entity.", "")}
                      </Badge>
                    ))}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateOpen(false)}>
                    {t("webhooks.cancel")}
                  </Button>
                  <Button
                    onClick={handleCreate}
                    disabled={!formName || !formUrl || submitting}
                  >
                    {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                    {t("webhooks.create")}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Test Result Toast */}
      {testResult && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            testResult.success
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {testResult.success
            ? `${t("webhooks.testSuccess")} (HTTP ${testResult.statusCode})`
            : `${t("webhooks.testFailed")}: ${testResult.error ?? `HTTP ${testResult.statusCode}`}`}
          <Button
            variant="ghost"
            size="sm"
            className="ml-2 h-5 px-1"
            onClick={() => setTestResult(null)}
          >
            <XIcon className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Webhook List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : webhooks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Webhook className="mx-auto h-10 w-10 mb-3 opacity-50" />
            <p>{t("webhooks.empty")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {webhooks.map((wh) => {
            const filter = wh.eventFilter as EventFilter;
            return (
              <Card key={wh.id}>
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium truncate">{wh.name}</h3>
                      <Badge
                        variant={wh.isActive ? "default" : "secondary"}
                        className={
                          wh.isActive
                            ? "bg-green-100 text-green-900"
                            : "bg-gray-100 text-gray-500"
                        }
                      >
                        {wh.isActive ? t("webhooks.active") : t("webhooks.inactive")}
                      </Badge>
                      {wh.templateType && (
                        <Badge variant="outline">{wh.templateType}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {wh.url}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {filter?.entityTypes?.map((et) => (
                        <Badge key={et} variant="outline" className="text-[10px] px-1.5">
                          {et}
                        </Badge>
                      ))}
                      {filter?.events?.map((ev) => (
                        <Badge key={ev} variant="outline" className="text-[10px] px-1.5 bg-blue-50">
                          {ev.replace("entity.", "")}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={wh.isActive}
                      onCheckedChange={() => handleToggleActive(wh.id, wh.isActive)}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTest(wh.id)}
                      disabled={testingId === wh.id}
                    >
                      {testingId === wh.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <TestTube2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/admin/webhooks/${wh.id}`)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => handleDelete(wh.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
