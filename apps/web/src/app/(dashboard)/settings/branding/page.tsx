"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import {
  Palette,
  Upload,
  RotateCcw,
  Save,
  Trash2,
  Sun,
  Moon,
  FileText,
  Mail,
  AlertTriangle,
  Image,
  Globe,
  X,
} from "lucide-react";
import type { BrandingResponse, BrandingReportTemplate } from "@grc/shared";
import {
  computeContrastForeground,
  computeDarkModeColor,
  passesWcagAA,
} from "@grc/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ColorField {
  key: keyof Pick<
    BrandingResponse,
    | "primaryColor"
    | "secondaryColor"
    | "accentColor"
    | "textColor"
    | "backgroundColor"
    | "darkModePrimaryColor"
  >;
  labelKey: string;
  defaultValue: string;
  descriptionKey: string;
}

const COLOR_FIELDS: ColorField[] = [
  {
    key: "primaryColor",
    labelKey: "primaryColor",
    defaultValue: "#2563eb",
    descriptionKey: "primaryColorDesc",
  },
  {
    key: "secondaryColor",
    labelKey: "secondaryColor",
    defaultValue: "#1e40af",
    descriptionKey: "secondaryColorDesc",
  },
  {
    key: "accentColor",
    labelKey: "accentColor",
    defaultValue: "#f59e0b",
    descriptionKey: "accentColorDesc",
  },
  {
    key: "textColor",
    labelKey: "textColor",
    defaultValue: "#0f172a",
    descriptionKey: "textColorDesc",
  },
  {
    key: "backgroundColor",
    labelKey: "backgroundColor",
    defaultValue: "#ffffff",
    descriptionKey: "backgroundColorDesc",
  },
  {
    key: "darkModePrimaryColor",
    labelKey: "darkModePrimaryColor",
    defaultValue: "",
    descriptionKey: "darkModePrimaryColorDesc",
  },
];

const REPORT_TEMPLATES: {
  value: BrandingReportTemplate;
  labelKey: string;
  descKey: string;
}[] = [
  {
    value: "standard",
    labelKey: "templateStandard",
    descKey: "templateStandardDesc",
  },
  {
    value: "formal",
    labelKey: "templateFormal",
    descKey: "templateFormalDesc",
  },
  {
    value: "minimal",
    labelKey: "templateMinimal",
    descKey: "templateMinimalDesc",
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BrandingSettingsPage() {
  const { data: session } = useSession();
  const t = useTranslations("branding");

  const [activeTab, setActiveTab] = useState<
    "colors" | "reports" | "email"
  >("colors");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [darkPreview, setDarkPreview] = useState(false);

  // Branding state
  const [branding, setBranding] = useState<BrandingResponse | null>(null);
  const [formValues, setFormValues] = useState({
    primaryColor: "#2563eb",
    secondaryColor: "#1e40af",
    accentColor: "#f59e0b",
    textColor: "#0f172a",
    backgroundColor: "#ffffff",
    darkModePrimaryColor: "" as string | null,
    darkModeAccentColor: "" as string | null,
    reportTemplate: "standard" as BrandingReportTemplate,
    confidentialityNotice: "CONFIDENTIAL -- For internal use only",
    inheritFromParent: true,
    customCss: "" as string | null,
  });

  const orgId = session?.user?.currentOrgId ?? session?.user?.roles?.[0]?.orgId ?? null;

  // Fetch branding on mount
  useEffect(() => {
    if (!orgId) return;

    async function fetchBranding() {
      try {
        const res = await fetch(`/api/v1/organizations/${orgId}/branding`);
        if (res.ok) {
          const { data } = await res.json();
          setBranding(data);
          setFormValues({
            primaryColor: data.primaryColor,
            secondaryColor: data.secondaryColor,
            accentColor: data.accentColor,
            textColor: data.textColor,
            backgroundColor: data.backgroundColor,
            darkModePrimaryColor: data.darkModePrimaryColor ?? "",
            darkModeAccentColor: data.darkModeAccentColor ?? "",
            reportTemplate: data.reportTemplate,
            confidentialityNotice: data.confidentialityNotice ?? "",
            inheritFromParent: data.inheritFromParent,
            customCss: data.customCss ?? "",
          });
        }
      } catch {
        // Failed to load branding, defaults will be used
      } finally {
        setIsLoading(false);
      }
    }

    fetchBranding();
  }, [orgId]);

  const updateField = useCallback(
    (key: string, value: string | boolean | null) => {
      setFormValues((prev) => ({ ...prev, [key]: value }));
      setHasChanges(true);
    },
    [],
  );

  const handleSave = useCallback(async () => {
    if (!orgId) return;
    setIsSaving(true);
    try {
      const body: Record<string, unknown> = { ...formValues };
      // Clean empty dark mode colors to null
      if (!body.darkModePrimaryColor) body.darkModePrimaryColor = null;
      if (!body.darkModeAccentColor) body.darkModeAccentColor = null;
      if (!body.customCss) body.customCss = null;

      const res = await fetch(`/api/v1/organizations/${orgId}/branding`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const { data } = await res.json();
        setBranding((prev) =>
          prev ? { ...prev, ...data } : prev,
        );
        setHasChanges(false);
      }
    } catch {
      // Save failed
    } finally {
      setIsSaving(false);
    }
  }, [orgId, formValues]);

  const handleResetDefaults = useCallback(() => {
    setFormValues({
      primaryColor: "#2563eb",
      secondaryColor: "#1e40af",
      accentColor: "#f59e0b",
      textColor: "#0f172a",
      backgroundColor: "#ffffff",
      darkModePrimaryColor: "",
      darkModeAccentColor: "",
      reportTemplate: "standard",
      confidentialityNotice: "CONFIDENTIAL -- For internal use only",
      inheritFromParent: formValues.inheritFromParent,
      customCss: "",
    });
    setHasChanges(true);
  }, [formValues.inheritFromParent]);

  const handleLogoUpload = useCallback(
    async (file: File) => {
      if (!orgId) return;
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(
        `/api/v1/organizations/${orgId}/branding/logo`,
        { method: "POST", body: formData },
      );

      if (res.ok) {
        const { data } = await res.json();
        setBranding((prev) =>
          prev ? { ...prev, logoUrl: data.logoUrl } : prev,
        );
      }
    },
    [orgId],
  );

  const handleLogoDelete = useCallback(async () => {
    if (!orgId) return;
    const res = await fetch(
      `/api/v1/organizations/${orgId}/branding/logo`,
      { method: "DELETE" },
    );
    if (res.ok) {
      setBranding((prev) =>
        prev ? { ...prev, logoUrl: null } : prev,
      );
    }
  }, [orgId]);

  const handleFaviconUpload = useCallback(
    async (file: File) => {
      if (!orgId) return;
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(
        `/api/v1/organizations/${orgId}/branding/favicon`,
        { method: "POST", body: formData },
      );

      if (res.ok) {
        const { data } = await res.json();
        setBranding((prev) =>
          prev ? { ...prev, faviconUrl: data.faviconUrl } : prev,
        );
      }
    },
    [orgId],
  );

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
      </div>
    );
  }

  const isDisabled = formValues.inheritFromParent && branding?.isInherited;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {t("description")}
        </p>
      </div>

      {/* Inheritance Banner */}
      {branding?.isInherited && formValues.inheritFromParent && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <Globe className="h-5 w-5 text-blue-600" />
          <span className="text-sm text-blue-800">
            {t("inheritedBanner", { orgName: branding.orgName })}
          </span>
          <button
            onClick={() => updateField("inheritFromParent", false)}
            className="ml-auto text-sm font-medium text-blue-700 hover:text-blue-900"
          >
            {t("customize")}
          </button>
        </div>
      )}

      {/* Tab Bar */}
      <div className="border-b">
        <nav className="-mb-px flex space-x-8">
          {(
            [
              { key: "colors", icon: Palette, labelKey: "tabColors" },
              { key: "reports", icon: FileText, labelKey: "tabReports" },
              { key: "email", icon: Mail, labelKey: "tabEmail" },
            ] as const
          ).map(({ key, icon: Icon, labelKey }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium ${
                activeTab === key
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t(labelKey)}
              {hasChanges && key === activeTab && (
                <span className="ml-1 h-2 w-2 rounded-full bg-orange-400" />
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab 1: Colors & Logo */}
      {activeTab === "colors" && (
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-5">
          {/* Left Column - Controls */}
          <div className="space-y-6 xl:col-span-3">
            {/* Color Pickers */}
            <div className="rounded-lg border bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                {t("brandColors")}
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {COLOR_FIELDS.map((field) => {
                  const value =
                    (formValues[field.key] as string) || field.defaultValue;
                  const showWarning =
                    field.key === "textColor" &&
                    !passesWcagAA(
                      formValues.textColor,
                      formValues.backgroundColor,
                    );

                  return (
                    <div key={field.key} className="space-y-1">
                      <label className="block text-sm font-medium text-gray-700">
                        {t(field.labelKey)}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={value || "#000000"}
                          onChange={(e) =>
                            updateField(field.key, e.target.value)
                          }
                          disabled={!!isDisabled}
                          className="h-8 w-8 cursor-pointer rounded border"
                          aria-label={t(field.labelKey)}
                        />
                        <input
                          type="text"
                          value={value}
                          onChange={(e) =>
                            updateField(field.key, e.target.value)
                          }
                          disabled={!!isDisabled}
                          placeholder="#000000"
                          className="w-24 rounded-md border px-2 py-1.5 font-mono text-sm disabled:opacity-50"
                          maxLength={7}
                        />
                        <button
                          onClick={() =>
                            updateField(field.key, field.defaultValue)
                          }
                          disabled={!!isDisabled}
                          className="rounded p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                          title={t("resetColor")}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="text-xs text-gray-500">
                        {t(field.descriptionKey)}
                      </p>
                      {showWarning && (
                        <div className="flex items-center gap-1 text-xs text-amber-600">
                          <AlertTriangle className="h-3 w-3" />
                          {t("lowContrast")}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Logo Upload */}
            <div className="rounded-lg border bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                {t("organizationLogo")}
              </h2>
              <div className="mb-4 flex h-20 w-48 items-center justify-center rounded border bg-gray-50">
                {branding?.logoUrl ? (
                  <img
                    src={branding.logoUrl}
                    alt={t("logoAlt")}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Image className="h-5 w-5" />
                    {t("noLogo")}
                  </div>
                )}
              </div>
              <label
                className={`flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed p-6 transition hover:bg-gray-50 ${isDisabled ? "pointer-events-none opacity-50" : ""}`}
              >
                <div className="text-center">
                  <Upload className="mx-auto h-6 w-6 text-gray-400" />
                  <p className="mt-2 text-sm text-gray-600">
                    {t("logoUploadText")}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    {t("logoUploadHint")}
                  </p>
                </div>
                <input
                  type="file"
                  accept="image/svg+xml,image/png"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleLogoUpload(file);
                  }}
                  disabled={!!isDisabled}
                />
              </label>
              {branding?.logoUrl && (
                <button
                  onClick={handleLogoDelete}
                  className="mt-3 flex items-center gap-1 rounded border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3 w-3" />
                  {t("removeLogo")}
                </button>
              )}
            </div>

            {/* Favicon Upload */}
            <div className="rounded-lg border bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                {t("browserFavicon")}
              </h2>
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded border bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2216%22%20height%3D%2216%22%3E%3Crect%20width%3D%228%22%20height%3D%228%22%20fill%3D%22%23ccc%22/%3E%3Crect%20x%3D%228%22%20y%3D%228%22%20width%3D%228%22%20height%3D%228%22%20fill%3D%22%23ccc%22/%3E%3C/svg%3E')]">
                {branding?.faviconUrl ? (
                  <img
                    src={branding.faviconUrl}
                    alt={t("faviconAlt")}
                    className="h-8 w-8 object-contain"
                  />
                ) : (
                  <Globe className="h-6 w-6 text-gray-400" />
                )}
              </div>
              <label
                className={`flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed p-4 transition hover:bg-gray-50 ${isDisabled ? "pointer-events-none opacity-50" : ""}`}
              >
                <div className="text-center">
                  <Upload className="mx-auto h-5 w-5 text-gray-400" />
                  <p className="mt-1 text-sm text-gray-600">
                    {t("faviconUploadText")}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    {t("faviconUploadHint")}
                  </p>
                </div>
                <input
                  type="file"
                  accept="image/x-icon,image/png,image/vnd.microsoft.icon"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFaviconUpload(file);
                  }}
                  disabled={!!isDisabled}
                />
              </label>
            </div>

            {/* Inheritance Toggle */}
            <div className="rounded-lg border bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                {t("brandingInheritance")}
              </h2>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={formValues.inheritFromParent}
                  onChange={(e) =>
                    updateField("inheritFromParent", e.target.checked)
                  }
                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                />
                <span className="text-sm text-gray-700">
                  {t("inheritFromParent")}
                </span>
              </label>
              <p className="mt-2 text-xs text-gray-500">
                {formValues.inheritFromParent
                  ? t("inheritActive")
                  : t("customActive")}
              </p>
            </div>
          </div>

          {/* Right Column - Live Preview */}
          <div className="xl:col-span-2">
            <div className="sticky top-20 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">
                  {t("livePreview")}
                </h3>
                <button
                  onClick={() => setDarkPreview(!darkPreview)}
                  className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs"
                >
                  {darkPreview ? (
                    <Sun className="h-3 w-3" />
                  ) : (
                    <Moon className="h-3 w-3" />
                  )}
                  {darkPreview ? t("lightMode") : t("darkMode")}
                </button>
              </div>

              {/* Mini App Preview */}
              <div
                className="overflow-hidden rounded-lg border shadow-sm"
                aria-live="polite"
              >
                <div className="flex" style={{ height: 280 }}>
                  {/* Mini Sidebar */}
                  <div
                    className="flex w-10 flex-col items-center gap-3 py-3"
                    style={{
                      backgroundColor: darkPreview
                        ? (formValues.darkModePrimaryColor ||
                          computeDarkModeColor(formValues.primaryColor, 15))
                        : formValues.primaryColor,
                    }}
                  >
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-4 w-4 rounded"
                        style={{
                          backgroundColor:
                            computeContrastForeground(formValues.primaryColor),
                          opacity: i === 0 ? 1 : 0.5,
                          borderLeft:
                            i === 0
                              ? `2px solid ${formValues.accentColor}`
                              : "none",
                        }}
                      />
                    ))}
                  </div>

                  {/* Content Area */}
                  <div
                    className="flex-1 p-3"
                    style={{
                      backgroundColor: darkPreview
                        ? "#0f172a"
                        : formValues.backgroundColor,
                    }}
                  >
                    {/* Mini Header */}
                    <div className="mb-3 flex items-center justify-between">
                      <div
                        className="h-3 w-16 rounded"
                        style={{
                          backgroundColor: formValues.primaryColor,
                          opacity: 0.8,
                        }}
                      />
                      <div className="flex gap-1.5">
                        <div
                          className="h-4 w-4 rounded-full"
                          style={{
                            backgroundColor: darkPreview
                              ? "#f1f5f9"
                              : formValues.textColor,
                            opacity: 0.3,
                          }}
                        />
                      </div>
                    </div>

                    {/* Mini Card */}
                    <div
                      className="mb-3 rounded border p-2"
                      style={{
                        borderColor: `${formValues.secondaryColor}33`,
                      }}
                    >
                      <div
                        className="mb-1 h-2 w-20 rounded"
                        style={{
                          backgroundColor: darkPreview
                            ? "#f1f5f9"
                            : formValues.textColor,
                        }}
                      />
                      <div
                        className="mb-2 h-1.5 w-32 rounded"
                        style={{
                          backgroundColor: darkPreview
                            ? "#f1f5f9"
                            : formValues.textColor,
                          opacity: 0.5,
                        }}
                      />
                      <div
                        className="h-4 w-12 rounded text-center text-[6px] leading-4"
                        style={{
                          backgroundColor: formValues.primaryColor,
                          color: computeContrastForeground(
                            formValues.primaryColor,
                          ),
                        }}
                      >
                        Button
                      </div>
                    </div>

                    {/* Mini Table */}
                    <div className="mb-3 overflow-hidden rounded text-[6px]">
                      <div
                        className="flex gap-2 px-1.5 py-1"
                        style={{
                          backgroundColor: formValues.primaryColor,
                          color: computeContrastForeground(
                            formValues.primaryColor,
                          ),
                        }}
                      >
                        <span className="flex-1">Column A</span>
                        <span className="flex-1">Column B</span>
                      </div>
                      {[0, 1].map((i) => (
                        <div
                          key={i}
                          className="flex gap-2 px-1.5 py-0.5"
                          style={{
                            backgroundColor:
                              i % 2 === 0
                                ? "transparent"
                                : `${formValues.backgroundColor}f2`,
                            color: darkPreview
                              ? "#f1f5f9"
                              : formValues.textColor,
                          }}
                        >
                          <span className="flex-1">Data {i + 1}</span>
                          <span className="flex-1">Value {i + 1}</span>
                        </div>
                      ))}
                    </div>

                    {/* Mini Badges */}
                    <div className="flex gap-1.5">
                      {[
                        formValues.primaryColor,
                        formValues.accentColor,
                        formValues.secondaryColor,
                      ].map((color, i) => (
                        <span
                          key={i}
                          className="rounded px-1.5 py-0.5 text-[6px]"
                          style={{
                            backgroundColor: color,
                            color: computeContrastForeground(color),
                          }}
                        >
                          Badge {i + 1}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Report Templates */}
      {activeTab === "reports" && (
        <div className="space-y-6">
          <div className="rounded-lg border bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              {t("defaultReportTemplate")}
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {REPORT_TEMPLATES.map(({ value, labelKey, descKey }) => (
                <button
                  key={value}
                  onClick={() => updateField("reportTemplate", value)}
                  className={`rounded-lg border-2 p-4 text-left transition ${
                    formValues.reportTemplate === value
                      ? "border-blue-600 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {/* Template preview */}
                  <div
                    className="mb-3 flex h-40 items-start rounded border bg-gray-50 p-3"
                    style={{
                      borderColor:
                        formValues.reportTemplate === value
                          ? formValues.primaryColor
                          : undefined,
                    }}
                  >
                    <div className="w-full space-y-2">
                      <div
                        className="h-2 w-3/4 rounded"
                        style={{
                          backgroundColor: formValues.primaryColor,
                          fontFamily:
                            value === "formal" ? "serif" : "sans-serif",
                        }}
                      />
                      <div className="h-1 w-full rounded bg-gray-200" />
                      <div className="h-1 w-5/6 rounded bg-gray-200" />
                      {value === "formal" && (
                        <div className="mt-2 border border-gray-300 p-1">
                          <div className="h-1 w-full rounded bg-gray-200" />
                        </div>
                      )}
                      {value === "standard" && (
                        <div className="mt-2 border-t border-gray-200 pt-1">
                          <div className="h-1 w-full rounded bg-gray-200" />
                        </div>
                      )}
                      {value === "minimal" && (
                        <div className="mt-4">
                          <div className="h-1 w-2/3 rounded bg-gray-200" />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-4 w-4 rounded-full border-2 ${
                        formValues.reportTemplate === value
                          ? "border-blue-600 bg-blue-600"
                          : "border-gray-300"
                      }`}
                    >
                      {formValues.reportTemplate === value && (
                        <div className="flex h-full items-center justify-center">
                          <div className="h-1.5 w-1.5 rounded-full bg-white" />
                        </div>
                      )}
                    </div>
                    <span className="font-medium text-gray-900">
                      {t(labelKey)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{t(descKey)}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Confidentiality Notice */}
          <div className="rounded-lg border bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              {t("confidentialityNotice")}
            </h2>
            <textarea
              value={formValues.confidentialityNotice}
              onChange={(e) =>
                updateField("confidentialityNotice", e.target.value)
              }
              maxLength={500}
              rows={3}
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder={t("confidentialityPlaceholder")}
            />
            <div className="mt-1 text-right text-xs text-gray-400">
              {formValues.confidentialityNotice.length}/500
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Email Preview */}
      {activeTab === "email" && (
        <div className="space-y-4">
          <div className="mx-auto max-w-xl rounded-lg border bg-gray-100 p-6">
            {/* Email preview mockup */}
            <div className="rounded-lg bg-white shadow-sm">
              {/* Email header bar */}
              <div
                className="flex items-center justify-center rounded-t-lg px-4 py-3"
                style={{ backgroundColor: formValues.primaryColor }}
              >
                {branding?.logoUrl ? (
                  <img
                    src={branding.logoUrl}
                    alt="Logo"
                    className="h-8 object-contain"
                    style={{
                      filter: "brightness(0) invert(1)",
                    }}
                  />
                ) : (
                  <span
                    className="text-sm font-bold"
                    style={{
                      color: computeContrastForeground(
                        formValues.primaryColor,
                      ),
                    }}
                  >
                    ARCTOS
                  </span>
                )}
              </div>
              {/* Email body */}
              <div className="p-6 text-sm text-gray-700">
                <p className="font-medium">{t("emailPreviewGreeting")}</p>
                <p className="mt-2 text-gray-600">
                  {t("emailPreviewBody")}
                </p>
                <div className="mt-4">
                  <button
                    className="rounded px-4 py-2 text-sm font-medium"
                    style={{
                      backgroundColor: formValues.primaryColor,
                      color: computeContrastForeground(
                        formValues.primaryColor,
                      ),
                    }}
                  >
                    {t("emailPreviewCta")}
                  </button>
                </div>
              </div>
              {/* Email footer */}
              <div className="border-t px-6 py-3 text-center text-xs text-gray-400">
                {branding?.orgName ?? "ARCTOS"} &middot; Powered by ARCTOS
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Bar */}
      {hasChanges && (
        <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t bg-white py-4">
          <button
            onClick={handleResetDefaults}
            className="rounded-md border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <RotateCcw className="mr-1.5 inline h-4 w-4" />
            {t("resetDefaults")}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="mr-1.5 inline h-4 w-4" />
            {isSaving ? t("saving") : t("saveChanges")}
          </button>
        </div>
      )}
    </div>
  );
}
