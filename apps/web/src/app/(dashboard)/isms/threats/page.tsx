"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Search, Plus, RefreshCcw, Zap, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Threat } from "@grc/shared";

const THREAT_CATEGORIES = [
  "natural_disaster",
  "malware",
  "social_engineering",
  "technical_failure",
  "human_error",
  "physical",
  "supply_chain",
  "insider_threat",
  "other",
];

export default function ThreatsPage() {
  return (
    <ModuleGate moduleKey="isms">
      <ThreatsInner />
    </ModuleGate>
  );
}

function ThreatsInner() {
  const t = useTranslations("isms");
  const [threats, setThreats] = useState<Threat[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("__all__");
  const [showCreate, setShowCreate] = useState(false);

  const fetchThreats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/isms/threats?limit=500");
      if (res.ok) {
        const json = await res.json();
        setThreats(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchThreats();
  }, [fetchThreats]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    threats.forEach((th) => {
      if (th.threatCategory) set.add(th.threatCategory);
    });
    return Array.from(set).sort();
  }, [threats]);

  const filtered = useMemo(() => {
    let result = threats;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (th) =>
          th.title.toLowerCase().includes(q) ||
          th.code?.toLowerCase().includes(q),
      );
    }
    if (categoryFilter !== "__all__") {
      result = result.filter((th) => th.threatCategory === categoryFilter);
    }
    return result;
  }, [threats, search, categoryFilter]);

  const handleDelete = useCallback(async (id: string) => {
    const res = await fetch(`/api/v1/isms/threats/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success(t("deleted"));
      setThreats((prev) => prev.filter((th) => th.id !== id));
    }
  }, [t]);

  if (loading && threats.length === 0) {
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
          <h1 className="text-2xl font-bold text-gray-900">{t("threats")}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {threats.length} {t("total")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchThreats} disabled={loading}>
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus size={16} /> {t("createThreat")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("createThreat")}</DialogTitle>
              </DialogHeader>
              <CreateThreatForm
                t={t}
                onSuccess={() => {
                  setShowCreate(false);
                  fetchThreats();
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchThreats")}
            className="h-8 w-48 rounded-md border border-gray-300 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px] h-8 text-xs">
            <SelectValue placeholder={t("filterCategory")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("allCategories")}</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-12">
            <Zap size={28} className="text-gray-400 mb-3" />
            <p className="text-sm text-gray-500">{t("noThreats")}</p>
          </div>
        ) : (
          filtered.map((th) => (
            <div
              key={th.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 hover:bg-gray-50"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Zap size={16} className="text-yellow-600 shrink-0" />
                {th.code && (
                  <span className="font-mono text-xs text-gray-400 shrink-0">{th.code}</span>
                )}
                <span className="text-sm font-medium text-gray-900 truncate">{th.title}</span>
                {th.threatCategory && (
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {th.threatCategory}
                  </Badge>
                )}
                {th.isSystem && (
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] shrink-0">
                    System
                  </Badge>
                )}
              </div>
              {!th.isSystem && (
                <Button variant="ghost" size="sm" onClick={() => handleDelete(th.id)}>
                  <Trash2 size={14} className="text-gray-400" />
                </Button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CreateThreatForm({
  t,
  onSuccess,
}: {
  t: ReturnType<typeof useTranslations>;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/v1/isms/threats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || undefined,
          threatCategory: category || undefined,
        }),
      });
      if (res.ok) {
        toast.success(t("created"));
        onSuccess();
      } else {
        toast.error(t("createError"));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t("titleField")}</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t("description")}</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t("category")}</label>
        <input
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="e.g. malware, social_engineering"
          className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <Button type="submit" className="w-full" disabled={saving}>
        {saving && <Loader2 size={14} className="mr-1 animate-spin" />}
        {t("createThreat")}
      </Button>
    </form>
  );
}
