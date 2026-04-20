"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  GripVertical,
  Plus,
  Trash2,
  Eye,
  Save,
  Loader2,
  Type,
  AlignLeft,
  Table,
  BarChart3,
  Activity,
  Minus,
  Palette,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type {
  ReportSectionConfig,
  ReportSectionType,
  ReportModuleScope,
} from "@grc/shared";

const SECTION_TYPES: Array<{
  type: ReportSectionType;
  icon: typeof Type;
  label: string;
}> = [
  { type: "title", icon: Type, label: "Title" },
  { type: "text", icon: AlignLeft, label: "Text" },
  { type: "table", icon: Table, label: "Table" },
  { type: "chart", icon: BarChart3, label: "Chart" },
  { type: "kpi", icon: Activity, label: "KPI Card" },
  { type: "page_break", icon: Minus, label: "Page Break" },
];

interface DataSources {
  tables: string[];
  charts: string[];
  kpis: string[];
}

export default function TemplateBuilderPage() {
  const t = useTranslations("reporting");
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [moduleScope, setModuleScope] = useState<ReportModuleScope>("all");
  const [sections, setSections] = useState<ReportSectionConfig[]>([]);
  const [dataSources, setDataSources] = useState<DataSources>({
    tables: [],
    charts: [],
    kpis: [],
  });
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [primaryColor, setPrimaryColor] = useState("#1e3a5f");
  const [footerText, setFooterText] = useState("");
  const [confidentiality, setConfidentiality] = useState("");

  useEffect(() => {
    fetch("/api/v1/reports/data-sources")
      .then((res) => res.json())
      .then((data) =>
        setDataSources(data.data || { tables: [], charts: [], kpis: [] }),
      )
      .catch(() => {});
  }, []);

  const addSection = (type: ReportSectionType) => {
    const newSection: ReportSectionConfig = {
      type,
      config: {
        text: type === "title" || type === "text" ? "" : undefined,
        dataSource: undefined,
        chartType: type === "chart" ? "bar" : undefined,
        label: "",
      },
    };
    setSections((prev) => [...prev, newSection]);
  };

  const updateSection = (
    index: number,
    updates: Partial<ReportSectionConfig["config"]>,
  ) => {
    setSections((prev) =>
      prev.map((s, i) =>
        i === index ? { ...s, config: { ...s.config, ...updates } } : s,
      ),
    );
  };

  const removeSection = (index: number) => {
    setSections((prev) => prev.filter((_, i) => i !== index));
  };

  const moveSection = (from: number, to: number) => {
    setSections((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/v1/reports/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          moduleScope,
          sectionsJson: sections,
          parametersJson: [],
          brandingJson: {
            primaryColor,
            footerText: footerText || undefined,
            confidentiality: confidentiality || undefined,
          },
        }),
      });
      if (res.ok) {
        router.push("/reports");
      }
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    setPreviewing(true);
    // Save first, then preview would need a template ID
    // For now, just indicate preview would work
    setPreviewing(false);
  };

  const getDataSourceOptions = (type: ReportSectionType) => {
    switch (type) {
      case "table":
        return dataSources.tables;
      case "chart":
        return dataSources.charts;
      case "kpi":
        return dataSources.kpis;
      default:
        return [];
    }
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
                {t("builderTitle")}
              </h1>
              <p className="text-muted-foreground">{t("builderSubtitle")}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handlePreview}
              disabled={previewing}
            >
              <Eye className="mr-2 h-4 w-4" />
              {t("preview")}
            </Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {t("saveTemplate")}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Section Palette (left) */}
          <div className="col-span-3 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">{t("sectionPalette")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {SECTION_TYPES.map(({ type, icon: Icon, label }) => (
                  <Button
                    key={type}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => addSection(type)}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {label}
                  </Button>
                ))}
              </CardContent>
            </Card>

            {/* Branding */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  {t("branding")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-xs font-medium">
                    {t("primaryColor")}
                  </label>
                  <div className="flex gap-2 mt-1">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="h-8 w-8 rounded border cursor-pointer"
                    />
                    <Input
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium">
                    {t("footerText")}
                  </label>
                  <Input
                    value={footerText}
                    onChange={(e) => setFooterText(e.target.value)}
                    placeholder={t("footerTextPlaceholder")}
                    className="mt-1 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">
                    {t("confidentiality")}
                  </label>
                  <Select
                    value={confidentiality}
                    onValueChange={setConfidentiality}
                  >
                    <SelectTrigger className="mt-1 text-xs">
                      <SelectValue placeholder={t("selectConfidentiality")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">{t("none")}</SelectItem>
                      <SelectItem value="CONFIDENTIAL">CONFIDENTIAL</SelectItem>
                      <SelectItem value="INTERNAL">INTERNAL</SelectItem>
                      <SelectItem value="PUBLIC">PUBLIC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Canvas (center) */}
          <div className="col-span-6 space-y-4">
            {/* Template Meta */}
            <Card>
              <CardContent className="pt-4 space-y-3">
                <div>
                  <label className="text-sm font-medium">
                    {t("templateName")}
                  </label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("templateNamePlaceholder")}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">
                    {t("templateDescription")}
                  </label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t("templateDescriptionPlaceholder")}
                    className="mt-1"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">
                    {t("moduleScope")}
                  </label>
                  <Select
                    value={moduleScope}
                    onValueChange={(v) =>
                      setModuleScope(v as ReportModuleScope)
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("allModules")}</SelectItem>
                      <SelectItem value="erm">ERM</SelectItem>
                      <SelectItem value="ics">ICS</SelectItem>
                      <SelectItem value="isms">ISMS</SelectItem>
                      <SelectItem value="audit">Audit</SelectItem>
                      <SelectItem value="dpms">DPMS</SelectItem>
                      <SelectItem value="esg">ESG</SelectItem>
                      <SelectItem value="bcms">BCMS</SelectItem>
                      <SelectItem value="tprm">TPRM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Sections */}
            {sections.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Plus className="h-8 w-8 mb-2" />
                  <p className="text-sm">{t("addSectionHint")}</p>
                </CardContent>
              </Card>
            ) : (
              sections.map((section, index) => (
                <Card key={index} className="relative group">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col gap-1 pt-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          disabled={index === 0}
                          onClick={() => moveSection(index, index - 1)}
                        >
                          <GripVertical className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-xs">
                            {section.type}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => removeSection(index)}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>

                        {/* Section-specific config */}
                        {(section.type === "title" ||
                          section.type === "text") && (
                          <Textarea
                            value={section.config.text || ""}
                            onChange={(e) =>
                              updateSection(index, { text: e.target.value })
                            }
                            placeholder={
                              section.type === "title"
                                ? t("titlePlaceholder")
                                : t("textPlaceholder")
                            }
                            rows={section.type === "title" ? 1 : 3}
                            className="text-sm"
                          />
                        )}

                        {(section.type === "table" ||
                          section.type === "chart" ||
                          section.type === "kpi") && (
                          <div className="space-y-2">
                            <div>
                              <label className="text-xs font-medium">
                                {t("dataSource")}
                              </label>
                              <Select
                                value={section.config.dataSource || ""}
                                onValueChange={(v) =>
                                  updateSection(index, { dataSource: v })
                                }
                              >
                                <SelectTrigger className="mt-1 text-xs">
                                  <SelectValue
                                    placeholder={t("selectDataSource")}
                                  />
                                </SelectTrigger>
                                <SelectContent>
                                  {getDataSourceOptions(section.type).map(
                                    (ds) => (
                                      <SelectItem key={ds} value={ds}>
                                        {ds}
                                      </SelectItem>
                                    ),
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <label className="text-xs font-medium">
                                {t("sectionLabel")}
                              </label>
                              <Input
                                value={section.config.label || ""}
                                onChange={(e) =>
                                  updateSection(index, {
                                    label: e.target.value,
                                  })
                                }
                                className="mt-1 text-xs"
                                placeholder={t("sectionLabelPlaceholder")}
                              />
                            </div>
                            {section.type === "chart" && (
                              <div>
                                <label className="text-xs font-medium">
                                  {t("chartType")}
                                </label>
                                <Select
                                  value={section.config.chartType || "bar"}
                                  onValueChange={(v) =>
                                    updateSection(index, {
                                      chartType: v as "bar" | "line" | "donut",
                                    })
                                  }
                                >
                                  <SelectTrigger className="mt-1 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="bar">Bar</SelectItem>
                                    <SelectItem value="line">Line</SelectItem>
                                    <SelectItem value="donut">Donut</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>
                        )}

                        {section.type === "page_break" && (
                          <div className="border-t border-dashed my-2" />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Variables Reference (right) */}
          <div className="col-span-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">{t("variables")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-xs">
                  <p className="text-muted-foreground">{t("variablesHint")}</p>
                  {[
                    "{{org.name}}",
                    "{{report.date}}",
                    "{{report.title}}",
                    "{{period.start}}",
                    "{{period.end}}",
                    "{{period.label}}",
                    "{{author.name}}",
                  ].map((v) => (
                    <code
                      key={v}
                      className="block bg-muted px-2 py-1 rounded text-xs font-mono cursor-pointer hover:bg-muted/80"
                      onClick={() => navigator.clipboard.writeText(v)}
                    >
                      {v}
                    </code>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ModuleGate>
  );
}
