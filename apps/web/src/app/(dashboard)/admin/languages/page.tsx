"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  Globe,
  Check,
  Plus,
  Star,
  ArrowRight,
  Settings2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ── Types ────────────────────────────────────────────────────────

interface LanguageConfig {
  code: string;
  label: string;
  isPrimary: boolean;
  isActive: boolean;
}

interface HeatmapCell {
  entityType: string;
  language: string;
  total: number;
  translated: number;
  percentage: number;
}

// ── Helpers ──────────────────────────────────────────────────────

const ENTITY_TYPE_LABELS: Record<string, string> = {
  risk: "Risks",
  control: "Controls",
  process: "Processes",
  document: "Documents",
  finding: "Findings",
  incident: "Incidents",
};

function getHeatmapColor(pct: number): string {
  if (pct >= 90) return "bg-green-100 text-green-800";
  if (pct >= 50) return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
}

// ── Component ────────────────────────────────────────────────────

export default function LanguageConfigPage() {
  const t = useTranslations("translations");

  const [languages, setLanguages] = useState<LanguageConfig[]>([]);
  const [activeLanguages, setActiveLanguages] = useState<string[]>([]);
  const [defaultLanguage, setDefaultLanguage] = useState("de");
  const [heatmap, setHeatmap] = useState<HeatmapCell[]>([]);
  const [loading, setLoading] = useState(true);
  const [primaryDialog, setPrimaryDialog] = useState<string | null>(null);
  const [addLangDialog, setAddLangDialog] = useState(false);
  const [newLangCode, setNewLangCode] = useState("");

  const fetchConfig = useCallback(async () => {
    try {
      const [langRes, heatmapRes] = await Promise.all([
        fetch("/api/v1/admin/languages"),
        fetch("/api/v1/translations/heatmap"),
      ]);

      if (langRes.ok) {
        const langData = await langRes.json();
        setLanguages(langData.data.languages);
        setActiveLanguages(langData.data.activeLanguages);
        setDefaultLanguage(langData.data.defaultLanguage);
      }

      if (heatmapRes.ok) {
        const heatmapData = await heatmapRes.json();
        setHeatmap(heatmapData.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleToggleLanguage = async (code: string, activate: boolean) => {
    const newActive = activate
      ? [...activeLanguages, code]
      : activeLanguages.filter((l) => l !== code);

    if (newActive.length === 0) return;

    const res = await fetch("/api/v1/admin/languages", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activeLanguages: newActive }),
    });

    if (res.ok) {
      setActiveLanguages(newActive);
      setLanguages((prev) =>
        prev.map((l) => ({
          ...l,
          isActive: newActive.includes(l.code),
        })),
      );
    }
  };

  const handleSetPrimary = async (code: string) => {
    const res = await fetch("/api/v1/admin/languages", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defaultLanguage: code }),
    });

    if (res.ok) {
      setDefaultLanguage(code);
      setLanguages((prev) =>
        prev.map((l) => ({
          ...l,
          isPrimary: l.code === code,
        })),
      );
      setPrimaryDialog(null);
    }
  };

  const handleAddLanguage = async () => {
    if (!newLangCode || activeLanguages.includes(newLangCode)) return;

    const newActive = [...activeLanguages, newLangCode];
    const res = await fetch("/api/v1/admin/languages", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activeLanguages: newActive }),
    });

    if (res.ok) {
      setActiveLanguages(newActive);
      setLanguages((prev) =>
        prev.map((l) => ({
          ...l,
          isActive: newActive.includes(l.code),
        })),
      );
      setAddLangDialog(false);
      setNewLangCode("");
    }
  };

  // Build heatmap grid
  const entityTypes = [...new Set(heatmap.map((h) => h.entityType))];

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-sm text-muted-foreground">{t("loading")}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("languageConfig")}
          </h1>
          <p className="text-muted-foreground">{t("languageConfigDesc")}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => (window.location.href = "/admin/languages/queue")}
          >
            {t("translationQueue")}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button onClick={() => setAddLangDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t("addLanguage")}
          </Button>
        </div>
      </div>

      {/* Active Languages Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {t("activeLanguages")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("language")}</TableHead>
                <TableHead>{t("code")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("active")}</TableHead>
                <TableHead>{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {languages
                .filter((l) => l.isActive)
                .map((lang) => (
                  <TableRow key={lang.code}>
                    <TableCell className="font-medium">
                      {lang.label}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{lang.code}</Badge>
                    </TableCell>
                    <TableCell>
                      {lang.isPrimary ? (
                        <Badge className="bg-amber-100 text-amber-900 border-amber-200">
                          <Star className="mr-1 h-3 w-3" />
                          {t("primary")}
                        </Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-900 border-green-200">
                          <Check className="mr-1 h-3 w-3" />
                          {t("active")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={lang.isActive}
                        disabled={lang.isPrimary}
                        onCheckedChange={(checked) =>
                          handleToggleLanguage(lang.code, checked)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      {!lang.isPrimary && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPrimaryDialog(lang.code)}
                        >
                          <Settings2 className="mr-1 h-3 w-3" />
                          {t("setAsPrimary")}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Translation Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle>{t("translationOverview")}</CardTitle>
        </CardHeader>
        <CardContent>
          {entityTypes.length > 0 && activeLanguages.length > 1 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("entityType")}</TableHead>
                    {activeLanguages
                      .filter((l) => l !== defaultLanguage)
                      .map((lang) => (
                        <TableHead key={lang} className="text-center">
                          {lang.toUpperCase()}
                        </TableHead>
                      ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entityTypes.map((et) => (
                    <TableRow key={et}>
                      <TableCell className="font-medium">
                        {ENTITY_TYPE_LABELS[et] ?? et}
                      </TableCell>
                      {activeLanguages
                        .filter((l) => l !== defaultLanguage)
                        .map((lang) => {
                          const cell = heatmap.find(
                            (h) =>
                              h.entityType === et && h.language === lang,
                          );
                          const pct = cell?.percentage ?? 0;
                          return (
                            <TableCell key={lang} className="text-center">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Badge
                                      className={`cursor-pointer ${getHeatmapColor(pct)}`}
                                      onClick={() =>
                                        (window.location.href = `/admin/languages/queue?entityType=${et}&targetLocale=${lang}`)
                                      }
                                    >
                                      {pct}%
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {cell?.translated ?? 0} / {cell?.total ?? 0}{" "}
                                    {t("fieldsTranslated")}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </TableCell>
                          );
                        })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("activateMoreLanguages")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Set Primary Dialog */}
      <Dialog
        open={primaryDialog !== null}
        onOpenChange={() => setPrimaryDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("changePrimaryLanguage")}</DialogTitle>
            <DialogDescription>
              {t("changePrimaryLanguageDesc")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrimaryDialog(null)}>
              {t("cancel")}
            </Button>
            <Button
              onClick={() => primaryDialog && handleSetPrimary(primaryDialog)}
            >
              {t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Language Dialog */}
      <Dialog open={addLangDialog} onOpenChange={setAddLangDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("addLanguage")}</DialogTitle>
            <DialogDescription>{t("addLanguageDesc")}</DialogDescription>
          </DialogHeader>
          <Select value={newLangCode} onValueChange={setNewLangCode}>
            <SelectTrigger>
              <SelectValue placeholder={t("selectLanguage")} />
            </SelectTrigger>
            <SelectContent>
              {languages
                .filter((l) => !l.isActive)
                .map((l) => (
                  <SelectItem key={l.code} value={l.code}>
                    {l.label} ({l.code})
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddLangDialog(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={handleAddLanguage} disabled={!newLangCode}>
              {t("activate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
