"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Plus,
  Star,
  StarOff,
  Pencil,
  Trash2,
  Copy,
  LayoutDashboard,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CustomDashboardRecord } from "@grc/shared";

type DashboardListItem = CustomDashboardRecord & { widgetCount: number };

export default function DashboardListPage() {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const [dashboards, setDashboards] = useState<DashboardListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createVisibility, setCreateVisibility] = useState<
    "personal" | "team" | "org"
  >("personal");
  const [isCreating, setIsCreating] = useState(false);

  const fetchDashboards = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeTab === "personal") params.set("visibility", "personal");
      if (activeTab === "team") params.set("visibility", "team");
      if (activeTab === "defaults") params.set("isDefault", "true");

      const res = await fetch(`/api/v1/dashboards?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setDashboards(json.data ?? []);
      }
    } catch {
      // Silently handle
    } finally {
      setIsLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchDashboards();
  }, [fetchDashboards]);

  async function handleCreate() {
    if (!createName.trim()) return;
    setIsCreating(true);
    try {
      const res = await fetch("/api/v1/dashboards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createName,
          description: createDescription || undefined,
          visibility: createVisibility,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setShowCreateDialog(false);
        setCreateName("");
        setCreateDescription("");
        router.push(`/dashboards/${json.data.id}?edit=true`);
      }
    } finally {
      setIsCreating(false);
    }
  }

  async function handleToggleFavorite(dashboardId: string) {
    await fetch(`/api/v1/dashboards/${dashboardId}/favorite`, {
      method: "PUT",
    });
    fetchDashboards();
  }

  async function handleDelete(dashboardId: string) {
    if (!confirm(t("confirmDelete"))) return;
    await fetch(`/api/v1/dashboards/${dashboardId}`, { method: "DELETE" });
    fetchDashboards();
  }

  async function handleDuplicate(dashboardId: string, name: string) {
    const res = await fetch(`/api/v1/dashboards/${dashboardId}/duplicate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `${name} (Kopie)` }),
    });
    if (res.ok) {
      const json = await res.json();
      router.push(`/dashboards/${json.data.id}?edit=true`);
    }
  }

  const VISIBILITY_LABELS: Record<string, string> = {
    personal: t("personal"),
    team: t("team"),
    org: t("organization"),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t("createDashboard")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("createDashboard")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>{t("dashboardName")}</Label>
                <Input
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder={t("dashboardNamePlaceholder")}
                />
              </div>
              <div>
                <Label>{t("description")}</Label>
                <Textarea
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  placeholder={t("descriptionPlaceholder")}
                  rows={3}
                />
              </div>
              <div>
                <Label>{t("visibility")}</Label>
                <Select
                  value={createVisibility}
                  onValueChange={(v) =>
                    setCreateVisibility(v as "personal" | "team" | "org")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal">{t("personal")}</SelectItem>
                    <SelectItem value="team">{t("team")}</SelectItem>
                    <SelectItem value="org">{t("organization")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
              >
                {t("cancel")}
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!createName.trim() || isCreating}
              >
                {isCreating && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t("create")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">{t("all")}</TabsTrigger>
          <TabsTrigger value="personal">{t("personal")}</TabsTrigger>
          <TabsTrigger value="team">{t("team")}</TabsTrigger>
          <TabsTrigger value="defaults">{t("orgDefaults")}</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : dashboards.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <LayoutDashboard className="mb-3 h-10 w-10" />
              <p className="text-sm">{t("noDashboards")}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setShowCreateDialog(true)}
              >
                <Plus className="mr-1 h-3 w-3" />
                {t("createFirst")}
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {dashboards.map((dash) => (
                <Card
                  key={dash.id}
                  className="cursor-pointer transition-shadow hover:shadow-md"
                  onClick={() => router.push(`/dashboards/${dash.id}`)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-base">{dash.name}</CardTitle>
                        {dash.description && (
                          <CardDescription className="mt-1 line-clamp-2 text-xs">
                            {dash.description}
                          </CardDescription>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleFavorite(dash.id);
                        }}
                      >
                        {dash.isFavorite ? (
                          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                        ) : (
                          <StarOff className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {VISIBILITY_LABELS[dash.visibility] ??
                            dash.visibility}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {dash.widgetCount} {t("widgets")}
                        </span>
                      </div>
                      <div
                        className="flex items-center gap-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() =>
                            router.push(`/dashboards/${dash.id}?edit=true`)
                          }
                          title={t("edit")}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleDuplicate(dash.id, dash.name)}
                          title={t("duplicate")}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(dash.id)}
                          title={t("delete")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    {dash.isDefault && (
                      <Badge variant="outline" className="mt-2 text-[10px]">
                        {t("orgDefault")}
                      </Badge>
                    )}
                    <div className="mt-2 text-[10px] text-muted-foreground">
                      {t("lastUpdated")}:{" "}
                      {new Date(dash.updatedAt).toLocaleDateString("de-DE")}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
