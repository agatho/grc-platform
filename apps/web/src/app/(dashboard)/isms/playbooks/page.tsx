"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  Search,
  Plus,
  RefreshCcw,
  BookOpen,
  Shield,
  CheckCircle2,
  XCircle,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PlaybookTemplate {
  id: string;
  name: string;
  description: string | null;
  triggerCategory: string;
  triggerMinSeverity: string;
  isActive: boolean;
  estimatedDurationHours: number | null;
  phaseCount: number;
  taskCount: number;
  createdAt: string;
}

const CATEGORIES = [
  "ransomware",
  "data_breach",
  "ddos",
  "insider",
  "supply_chain",
  "phishing",
  "other",
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  ransomware: "bg-red-100 text-red-800 border-red-300",
  data_breach: "bg-orange-100 text-orange-800 border-orange-300",
  ddos: "bg-yellow-100 text-yellow-800 border-yellow-300",
  insider: "bg-purple-100 text-purple-800 border-purple-300",
  supply_chain: "bg-blue-100 text-blue-800 border-blue-300",
  phishing: "bg-cyan-100 text-cyan-800 border-cyan-300",
  other: "bg-gray-100 text-gray-800 border-gray-300",
};

export default function PlaybooksPage() {
  return (
    <ModuleGate moduleKey="isms">
      <PlaybooksInner />
    </ModuleGate>
  );
}

function PlaybooksInner() {
  const t = useTranslations("isms.playbook");
  const router = useRouter();
  const [playbooks, setPlaybooks] = useState<PlaybookTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("__all__");

  const fetchPlaybooks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/playbooks?limit=100");
      if (res.ok) {
        const json = await res.json();
        setPlaybooks(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPlaybooks();
  }, [fetchPlaybooks]);

  const filtered = useMemo(() => {
    let result = playbooks;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description ?? "").toLowerCase().includes(q),
      );
    }
    if (categoryFilter !== "__all__") {
      result = result.filter((p) => p.triggerCategory === categoryFilter);
    }
    return result;
  }, [playbooks, search, categoryFilter]);

  if (loading && playbooks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("library")}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {playbooks.length} {t("title").toLowerCase()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchPlaybooks} disabled={loading}>
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
          <Button size="sm" onClick={() => router.push("/isms/playbooks/new")}>
            <Plus size={16} /> {t("create")}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`${t("title")} suchen...`}
            className="h-8 w-48 rounded-md border border-gray-300 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px] h-8 text-xs">
            <SelectValue placeholder={t("triggerCategory")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Alle Kategorien</SelectItem>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {t(`categories.${cat}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Card Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-12">
          <BookOpen size={28} className="text-gray-400 mb-3" />
          <p className="text-sm text-gray-500">{t("noPlaybooks")}</p>
          <p className="text-xs text-gray-400 mt-1">{t("createFirst")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((pb) => (
            <Link key={pb.id} href={`/isms/playbooks/${pb.id}/edit`}>
              <Card className="hover:border-blue-300 hover:bg-blue-50/50 transition-colors cursor-pointer h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm font-semibold leading-tight">
                      {pb.name}
                    </CardTitle>
                    <div className="flex items-center gap-1 shrink-0">
                      {pb.isActive ? (
                        <CheckCircle2 size={14} className="text-green-500" />
                      ) : (
                        <XCircle size={14} className="text-gray-400" />
                      )}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] w-fit mt-1 ${CATEGORY_COLORS[pb.triggerCategory] ?? CATEGORY_COLORS.other}`}
                  >
                    {t(`categories.${pb.triggerCategory as "ransomware"}`)}
                  </Badge>
                </CardHeader>
                <CardContent className="pt-0">
                  {pb.description && (
                    <p className="text-xs text-gray-500 line-clamp-2 mb-3">
                      {pb.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span>
                      <Shield size={12} className="inline mr-1" />
                      {t(`severities.${pb.triggerMinSeverity as "significant"}`)}
                    </span>
                    <span>{pb.phaseCount} {t("phases")}</span>
                    <span>{pb.taskCount} {t("tasks")}</span>
                    {pb.estimatedDurationHours && (
                      <span>{pb.estimatedDurationHours}h</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
