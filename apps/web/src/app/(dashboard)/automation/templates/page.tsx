"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  LayoutTemplate,
  Shield,
  ClipboardCheck,
  Users,
  FileSearch,
  Lock,
  Scale,
  AlertTriangle,
  Leaf,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Template {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  triggerType: string;
  isBuiltIn: boolean;
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  risk_management: Shield,
  control_testing: ClipboardCheck,
  vendor_management: Users,
  audit: FileSearch,
  data_protection: Lock,
  compliance: Scale,
  isms: AlertTriangle,
  esg: Leaf,
};

const CATEGORY_COLORS: Record<string, string> = {
  risk_management: "bg-red-50 border-red-200 text-red-700",
  control_testing: "bg-blue-50 border-blue-200 text-blue-700",
  vendor_management: "bg-purple-50 border-purple-200 text-purple-700",
  audit: "bg-orange-50 border-orange-200 text-orange-700",
  data_protection: "bg-green-50 border-green-200 text-green-700",
  compliance: "bg-teal-50 border-teal-200 text-teal-700",
  isms: "bg-yellow-50 border-yellow-200 text-yellow-700",
  esg: "bg-emerald-50 border-emerald-200 text-emerald-700",
};

export default function TemplateGalleryPage() {
  const t = useTranslations("automation");
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("");

  useEffect(() => {
    void (async () => {
      const params = new URLSearchParams({ limit: "50" });
      if (categoryFilter) params.set("category", categoryFilter);

      const res = await fetch(
        `/api/v1/automation/templates?${params.toString()}`,
      );
      if (res.ok) {
        const json = await res.json();
        setTemplates(json.data ?? []);
      }
      setLoading(false);
    })();
  }, [categoryFilter]);

  const categories = [
    "risk_management",
    "control_testing",
    "vendor_management",
    "audit",
    "data_protection",
    "compliance",
    "isms",
    "esg",
  ];

  const useTemplate = (templateId: string) => {
    router.push(`/automation/rules/new?templateId=${templateId}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/automation">
            <Button variant="ghost" size="sm">
              <ArrowLeft size={14} />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t("templates.title")}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {t("templates.subtitle")}
            </p>
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCategoryFilter("")}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            !categoryFilter
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          {t("templates.allCategories")}
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoryFilter(cat)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              categoryFilter === cat
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {t(`categories.${cat}`)}
          </button>
        ))}
      </div>

      {/* Template Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <LayoutTemplate size={32} className="mx-auto text-gray-400 mb-3" />
          <p className="text-sm text-gray-400">{t("templates.empty")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((tpl) => {
            const Icon = CATEGORY_ICONS[tpl.category] ?? LayoutTemplate;
            const colorClass =
              CATEGORY_COLORS[tpl.category] ??
              "bg-gray-50 border-gray-200 text-gray-700";

            return (
              <div
                key={tpl.id}
                className="rounded-lg border border-gray-200 bg-white p-5 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`rounded-lg p-2 border ${colorClass}`}>
                    <Icon size={18} />
                  </div>
                  {tpl.isBuiltIn && (
                    <Badge variant="outline" className="text-[10px] bg-gray-50">
                      {t("templates.builtIn")}
                    </Badge>
                  )}
                </div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1">
                  {tpl.name}
                </h3>
                <p className="text-xs text-gray-500 mb-3 line-clamp-2">
                  {tpl.description}
                </p>
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px]">
                    {t(`triggerTypes.${tpl.triggerType}`)}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => useTemplate(tpl.id)}
                  >
                    {t("templates.useTemplate")}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
