"use client";

import { useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useTranslations, useLocale } from "next-intl";
import { Blocks, Check, X as XIcon, AlertTriangle, Settings2 } from "lucide-react";
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
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAllModuleConfigs } from "@/hooks/use-module-config";
import { getLucideIcon } from "@/components/module/icon-map";
import type { ModuleConfig, ModuleKey, ModuleUiStatus } from "@grc/shared";

// ── Status badge config ──────────────────────────────────────────────

const statusBadgeStyles: Record<ModuleUiStatus, string> = {
  enabled:
    "bg-green-100 text-green-900 border-green-200",
  preview:
    "bg-amber-100 text-amber-900 border-amber-200",
  disabled:
    "bg-gray-100 text-gray-500 border-gray-200",
  maintenance:
    "bg-red-100 text-red-900 border-red-200",
};

const licenseBadgeStyles: Record<string, string> = {
  included: "bg-blue-50 text-blue-700 border-blue-200",
  addon: "bg-purple-50 text-purple-700 border-purple-200",
  enterprise: "bg-indigo-50 text-indigo-700 border-indigo-200",
};

// ── Toast (simple) ───────────────────────────────────────────────────

function Toast({
  message,
  variant,
  onClose,
}: {
  message: string;
  variant: "success" | "error";
  onClose: () => void;
}) {
  return (
    <div
      className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-md px-4 py-3 text-sm font-medium shadow-lg transition-all ${
        variant === "success"
          ? "bg-green-600 text-white"
          : "bg-red-600 text-white"
      }`}
    >
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 hover:opacity-80">
        <XIcon size={14} />
      </button>
    </div>
  );
}

// ── Module Card ──────────────────────────────────────────────────────

interface ModuleCardProps {
  mod: ModuleConfig;
  allConfigs: ModuleConfig[];
  locale: string;
  isAdmin: boolean;
  onToggle: (moduleKey: ModuleKey, newStatus: ModuleUiStatus) => void;
  toggling: ModuleKey | null;
}

function ModuleCard({
  mod,
  allConfigs,
  locale,
  isAdmin,
  onToggle,
  toggling,
}: ModuleCardProps) {
  const t = useTranslations();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const Icon = getLucideIcon(mod.icon);
  const displayName =
    locale === "de" ? mod.displayNameDe : mod.displayNameEn;
  const description =
    locale === "de" ? mod.descriptionDe : mod.descriptionEn;

  // Check dependencies
  const deps = mod.requiresModules ?? [];
  const unmetDeps = deps.filter((dep) => {
    const depConfig = allConfigs.find((c) => c.moduleKey === dep);
    return !depConfig || depConfig.uiStatus === "disabled";
  });
  const depsAreMet = unmetDeps.length === 0;

  const isEnabled = mod.uiStatus === "enabled";
  const isToggling = toggling === mod.moduleKey;

  const handleSwitchChange = (checked: boolean) => {
    if (checked) {
      // Enable
      onToggle(mod.moduleKey, "enabled");
    } else {
      // Show confirmation dialog before disabling
      setConfirmOpen(true);
    }
  };

  const handleConfirmDisable = () => {
    setConfirmOpen(false);
    onToggle(mod.moduleKey, "disabled");
  };

  const statusKey = `modules.${mod.uiStatus}` as const;
  const licenseKey = `modules.license.${mod.licenseTier}` as const;

  return (
    <>
      <Card className="relative flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
                <Icon size={20} />
              </div>
              <div>
                <CardTitle className="text-base">{displayName}</CardTitle>
                <div className="mt-1 flex items-center gap-1.5">
                  <Badge
                    className={`text-[10px] ${statusBadgeStyles[mod.uiStatus]}`}
                    variant="outline"
                  >
                    {t(statusKey)}
                  </Badge>
                  <Badge
                    className={`text-[10px] ${licenseBadgeStyles[mod.licenseTier] ?? licenseBadgeStyles.included}`}
                    variant="outline"
                  >
                    {t(licenseKey)}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Toggle */}
            {isAdmin && mod.uiStatus !== "maintenance" && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={handleSwitchChange}
                        disabled={isToggling || (!depsAreMet && !isEnabled)}
                        aria-label={
                          isEnabled
                            ? t("modules.disable")
                            : t("modules.enable")
                        }
                      />
                    </span>
                  </TooltipTrigger>
                  {!depsAreMet && !isEnabled && (
                    <TooltipContent>
                      {t("modules.depNotMet", {
                        deps: unmetDeps.join(", "),
                      })}
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col gap-3 pt-0">
          {description && (
            <p className="text-sm text-gray-500 line-clamp-2">{description}</p>
          )}

          {/* Dependencies */}
          <div className="mt-auto">
            {deps.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {deps.map((dep) => {
                  const depMet = !unmetDeps.includes(dep);
                  return (
                    <span
                      key={dep}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
                        depMet
                          ? "bg-green-50 text-green-700"
                          : "bg-red-50 text-red-600"
                      }`}
                    >
                      {depMet ? <Check size={10} /> : <XIcon size={10} />}
                      {dep}
                    </span>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-400">
                {t("modules.depSatisfied")}
              </p>
            )}
          </div>

          {/* Config button placeholder */}
          {isAdmin && isEnabled && (
            <button
              disabled
              className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-500 opacity-50 cursor-not-allowed"
            >
              <Settings2 size={12} />
              Config
            </button>
          )}
        </CardContent>
      </Card>

      {/* Disable confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-500" />
              {t("modules.disable")} — {displayName}
            </DialogTitle>
            <DialogDescription>
              {t("modules.disableConfirm", { name: displayName })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() => setConfirmOpen(false)}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {t("actions.cancel")}
            </button>
            <button
              onClick={handleConfirmDisable}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              {t("modules.disable")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────

export default function AdminModulesPage() {
  const t = useTranslations();
  const locale = useLocale();
  const { data: session } = useSession();
  const { configs, loading, error, refetch } = useAllModuleConfigs();
  const [toggling, setToggling] = useState<ModuleKey | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    variant: "success" | "error";
  } | null>(null);

  const isAdmin =
    session?.user?.roles?.some((r) => r.role === "admin") ?? false;

  const showToast = useCallback(
    (message: string, variant: "success" | "error") => {
      setToast({ message, variant });
      setTimeout(() => setToast(null), 4000);
    },
    [],
  );

  const currentOrgId = session?.user?.roles?.[0]?.orgId;

  const handleToggle = async (
    moduleKey: ModuleKey,
    newStatus: ModuleUiStatus,
  ) => {
    if (!currentOrgId) return;
    setToggling(moduleKey);
    try {
      const res = await fetch(
        `/api/v1/organizations/${currentOrgId}/modules/${moduleKey}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uiStatus: newStatus }),
        },
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const mod = configs.find((c) => c.moduleKey === moduleKey);
      const name =
        locale === "de"
          ? (mod?.displayNameDe ?? moduleKey)
          : (mod?.displayNameEn ?? moduleKey);

      if (newStatus === "enabled") {
        showToast(t("modules.activated", { name }), "success");
      } else {
        showToast(t("modules.deactivated", { name }), "success");
      }

      refetch();
    } catch {
      showToast(t("common.error"), "error");
    } finally {
      setToggling(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-red-600 mb-3">{error}</p>
        <button
          onClick={refetch}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {t("actions.refresh")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-900">
          <Blocks size={20} />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {t("modules.title")}
          </h1>
          <p className="text-sm text-gray-500">
            {configs.filter((c) => c.uiStatus === "enabled").length} /{" "}
            {configs.length} {t("modules.enabled")}
          </p>
        </div>
      </div>

      {/* Module grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {configs.map((mod) => (
          <ModuleCard
            key={mod.moduleKey}
            mod={mod}
            allConfigs={configs}
            locale={locale}
            isAdmin={isAdmin}
            onToggle={handleToggle}
            toggling={toggling}
          />
        ))}
      </div>

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          variant={toast.variant}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
