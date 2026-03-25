"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type ColumnDef } from "@tanstack/react-table";
import {
  ArrowLeft,
  Loader2,
  Link2,
  Plus,
  History,
  Search,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import type { WorkItem, WorkItemLink } from "@grc/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, SortableHeader } from "@/components/ui/data-table";
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
import { getLucideIcon } from "@/components/module/icon-map";
import { useTabNavigation } from "@/hooks/use-tab-navigation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkItemDetail extends WorkItem {
  typeDisplayName?: string;
  typeIcon?: string;
  typeColorClass?: string;
  responsibleName?: string;
  reviewerName?: string;
  description?: string;
}

interface LinkedWorkItem {
  id: string;
  linkId: string;
  linkType: string;
  direction: "outgoing" | "incoming";
  elementId: string | null;
  name: string;
  typeKey: string;
  typeDisplayName: string;
  status: string;
}

interface AuditEntry {
  id: string;
  action: string;
  userId: string;
  userName?: string;
  timestamp: string;
  changes: Record<string, { old: unknown; new: unknown }>;
}

interface SearchResult {
  id: string;
  elementId: string | null;
  name: string;
  typeKey: string;
}

// ---------------------------------------------------------------------------
// Status utilities
// ---------------------------------------------------------------------------

function statusColor(status: string): string {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-800";
    case "draft":
      return "bg-gray-100 text-gray-800";
    case "completed":
      return "bg-blue-100 text-blue-800";
    case "in_review":
    case "in_evaluation":
      return "bg-yellow-100 text-yellow-800";
    case "in_approval":
      return "bg-purple-100 text-purple-800";
    case "management_approved":
      return "bg-indigo-100 text-indigo-800";
    case "in_treatment":
      return "bg-orange-100 text-orange-800";
    case "cancelled":
    case "obsolete":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

// Status transition map — determines valid next statuses
const STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ["in_evaluation", "cancelled"],
  in_evaluation: ["in_review", "draft", "cancelled"],
  in_review: ["in_approval", "in_evaluation", "cancelled"],
  in_approval: ["management_approved", "in_review", "cancelled"],
  management_approved: ["active", "in_approval"],
  active: ["in_treatment", "completed", "obsolete"],
  in_treatment: ["active", "completed"],
  completed: ["obsolete"],
  obsolete: [],
  cancelled: ["draft"],
};

// ---------------------------------------------------------------------------
// Link types
// ---------------------------------------------------------------------------

const LINK_TYPES = [
  "caused_by",
  "results_in",
  "mitigated_by",
  "evidence_for",
  "related",
] as const;

// ---------------------------------------------------------------------------
// Details Tab
// ---------------------------------------------------------------------------

function DetailsTab({
  item,
  t,
}: {
  item: WorkItemDetail;
  t: ReturnType<typeof useTranslations>;
}) {
  const fields = [
    { label: t("name"), value: item.name },
    { label: t("type"), value: item.typeDisplayName ?? item.typeKey },
    { label: t("elementId"), value: item.elementId ?? "-" },
    { label: t("description"), value: item.description ?? "-" },
    { label: t("responsible"), value: item.responsibleName ?? "-" },
    { label: t("reviewer"), value: item.reviewerName ?? "-" },
    { label: t("dueDate"), value: item.dueDate ? new Date(item.dueDate).toLocaleDateString() : "-" },
    { label: t("completedAt"), value: item.completedAt ? new Date(item.completedAt).toLocaleDateString() : "-" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("details")}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.label} className="space-y-1">
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                {field.label}
              </dt>
              <dd className="text-sm text-gray-900 whitespace-pre-wrap">{field.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Add Link Dialog
// ---------------------------------------------------------------------------

function AddLinkDialog({
  open,
  onOpenChange,
  sourceId,
  onLinkAdded,
  t,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceId: string;
  onLinkAdded: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const tActions = useTranslations("actions");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<string>("");
  const [linkType, setLinkType] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const doSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/v1/work-items?search=${encodeURIComponent(query)}&limit=10`);
      if (!res.ok) throw new Error("Failed");
      const json = (await res.json()) as { data: SearchResult[] };
      // Exclude self
      setSearchResults(json.data.filter((r) => r.id !== sourceId));
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [sourceId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void doSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, doSearch]);

  const handleSubmit = async () => {
    if (!selectedTarget || !linkType) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/work-items/${sourceId}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetId: selectedTarget,
          linkType,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(t("linkAdded"));
      setSearchQuery("");
      setSelectedTarget("");
      setLinkType("");
      setSearchResults([]);
      onOpenChange(false);
      onLinkAdded();
    } catch {
      toast.error(t("linkError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("addLink")}</DialogTitle>
          <DialogDescription>{t("addLinkDescription")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Search target */}
          <div className="space-y-2">
            <Label>{t("linkTarget")}</Label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("searchTarget")}
                className="pl-9"
              />
            </div>
            {(searchResults.length > 0 || searching) && (
              <div className="max-h-40 overflow-y-auto rounded-md border border-gray-200 bg-white">
                {searching && (
                  <div className="flex items-center justify-center py-3">
                    <Loader2 size={14} className="animate-spin text-gray-400" />
                  </div>
                )}
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => {
                      setSelectedTarget(result.id);
                      setSearchQuery(
                        result.elementId
                          ? `${result.elementId} - ${result.name}`
                          : result.name,
                      );
                      setSearchResults([]);
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors ${
                      selectedTarget === result.id ? "bg-blue-50" : ""
                    }`}
                  >
                    {result.elementId && (
                      <code className="text-xs font-mono text-gray-500">
                        {result.elementId}
                      </code>
                    )}
                    <span className="truncate">{result.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Link type */}
          <div className="space-y-2">
            <Label>{t("linkType")}</Label>
            <Select value={linkType} onValueChange={setLinkType}>
              <SelectTrigger>
                <SelectValue placeholder={t("linkType")} />
              </SelectTrigger>
              <SelectContent>
                {LINK_TYPES.map((lt) => (
                  <SelectItem key={lt} value={lt}>
                    {t(`linkTypes.${lt}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tActions("cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={!selectedTarget || !linkType || submitting}>
            {submitting && <Loader2 size={16} className="animate-spin" />}
            {t("addLink")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Links Tab
// ---------------------------------------------------------------------------

function LinksTab({
  itemId,
  t,
}: {
  itemId: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const router = useRouter();
  const [links, setLinks] = useState<LinkedWorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchLinks = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/work-items/${itemId}/links`);
      if (!res.ok) throw new Error("Failed");
      const json = (await res.json()) as { data: LinkedWorkItem[] };
      setLinks(json.data);
    } catch {
      // empty
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    void fetchLinks();
  }, [fetchLinks]);

  const outgoing = links.filter((l) => l.direction === "outgoing");
  const incoming = links.filter((l) => l.direction === "incoming");

  const linkColumns: ColumnDef<LinkedWorkItem, unknown>[] = [
    {
      accessorKey: "linkType",
      header: t("linkType"),
      cell: ({ row }) => (
        <Badge variant="outline" className="text-xs">
          {t(`linkTypes.${row.original.linkType as "caused_by" | "results_in" | "mitigated_by" | "evidence_for" | "related"}`)}
        </Badge>
      ),
    },
    {
      accessorKey: "elementId",
      header: t("elementId"),
      cell: ({ row }) => (
        <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono text-gray-700">
          {row.original.elementId ?? "-"}
        </code>
      ),
    },
    {
      accessorKey: "name",
      header: t("name"),
      cell: ({ row }) => (
        <button
          onClick={() => router.push(`/work-items/${row.original.id}`)}
          className="text-sm font-medium text-blue-600 hover:underline text-left"
        >
          {row.original.name}
        </button>
      ),
    },
    {
      accessorKey: "status",
      header: t("status"),
      cell: ({ row }) => (
        <Badge className={`border-0 text-xs ${statusColor(row.original.status)}`}>
          {t(`statuses.${row.original.status as "draft" | "active"}`)}
        </Badge>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">{t("links")}</h3>
        <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
          <Plus size={14} />
          {t("addLink")}
        </Button>
      </div>

      {links.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center h-24 pt-6">
            <div className="text-center">
              <Link2 size={24} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">{t("noLinks")}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Outgoing links */}
          {outgoing.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {t("outgoing")} ({outgoing.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable columns={linkColumns} data={outgoing} pageSize={5} />
              </CardContent>
            </Card>
          )}

          {/* Incoming links */}
          {incoming.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {t("incoming")} ({incoming.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable columns={linkColumns} data={incoming} pageSize={5} />
              </CardContent>
            </Card>
          )}
        </>
      )}

      <AddLinkDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        sourceId={itemId}
        onLinkAdded={() => {
          setLoading(true);
          void fetchLinks();
        }}
        t={t}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// History Tab
// ---------------------------------------------------------------------------

function HistoryTab({
  itemId,
  t,
}: {
  itemId: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const tAudit = useTranslations("auditLog");
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const res = await fetch(`/api/v1/work-items/${itemId}/history`);
        if (!res.ok) throw new Error("Failed");
        const json = (await res.json()) as { data: AuditEntry[] };
        setEntries(json.data);
      } catch {
        // empty
      } finally {
        setLoading(false);
      }
    }
    void fetchHistory();
  }, [itemId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-24 pt-6">
          <div className="text-center">
            <History size={24} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-400">{t("noHistory")}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("history")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200">
                <History size={14} className="text-gray-500" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-gray-900">
                    {entry.userName ?? entry.userId}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {entry.action}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {new Date(entry.timestamp).toLocaleString()}
                </p>
                {Object.keys(entry.changes).length > 0 && (
                  <div className="mt-2 space-y-1">
                    {Object.entries(entry.changes).map(([field, change]) => (
                      <div key={field} className="text-xs text-gray-600">
                        <span className="font-medium">{field}:</span>{" "}
                        <span className="text-red-600 line-through">
                          {String(change.old ?? "-")}
                        </span>{" "}
                        <span className="text-green-600">
                          {String(change.new ?? "-")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function WorkItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const itemId = params.id as string;

  const t = useTranslations("workItems");
  const tCommon = useTranslations("common");
  const { openTab } = useTabNavigation();

  const [item, setItem] = useState<WorkItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [transitioning, setTransitioning] = useState(false);

  const fetchItem = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/work-items/${itemId}`);
      if (!res.ok) throw new Error("Not found");
      const json = (await res.json()) as { data: WorkItemDetail };
      setItem(json.data);
    } catch {
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    void fetchItem();
  }, [fetchItem]);

  // Register tab when item loads
  useEffect(() => {
    if (item) {
      const IconComp = item.typeIcon ? getLucideIcon(item.typeIcon) : null;
      openTab({
        id: `wi-${itemId}`,
        label: item.elementId ? `${item.elementId} - ${item.name}` : item.name,
        href: `/work-items/${itemId}`,
        icon: item.typeIcon,
      });
    }
  }, [item]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTransition = async (newStatus: string) => {
    setTransitioning(true);
    try {
      const res = await fetch(`/api/v1/work-items/${itemId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(t("transitioned"));
      void fetchItem();
    } catch {
      toast.error(t("transitionError"));
    } finally {
      setTransitioning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400 mr-2" />
        <p className="text-sm text-gray-500">{tCommon("loading")}</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="space-y-4">
        <p className="text-gray-500">{t("notFound")}</p>
        <Link href="/work-items">
          <Button variant="outline">
            <ArrowLeft size={16} />
            {t("backToList")}
          </Button>
        </Link>
      </div>
    );
  }

  const IconComp = item.typeIcon ? getLucideIcon(item.typeIcon) : null;
  const validTransitions = STATUS_TRANSITIONS[item.status] ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          {IconComp && (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
              <IconComp size={20} className="text-gray-600" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              {item.elementId && (
                <code className="rounded bg-gray-100 px-2 py-0.5 text-sm font-mono text-gray-600">
                  {item.elementId}
                </code>
              )}
              <h1 className="text-2xl font-bold text-gray-900">{item.name}</h1>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {item.typeDisplayName ?? item.typeKey}
              </Badge>
              <Badge className={`border-0 text-xs ${statusColor(item.status)}`}>
                {t(`statuses.${item.status as "draft" | "active"}`)}
              </Badge>
            </div>
          </div>
        </div>
        <Link href="/work-items">
          <Button variant="outline" size="sm">
            <ArrowLeft size={16} />
            {t("backToList")}
          </Button>
        </Link>
      </div>

      {/* Status transitions */}
      {validTransitions.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-3">
          <span className="text-sm font-medium text-gray-600 mr-2">
            {t("transitionTo")}:
          </span>
          {validTransitions.map((nextStatus) => (
            <Button
              key={nextStatus}
              variant="outline"
              size="sm"
              onClick={() => handleTransition(nextStatus)}
              disabled={transitioning}
              className="text-xs"
            >
              {transitioning && <Loader2 size={12} className="animate-spin" />}
              {t(`statuses.${nextStatus as "draft" | "active"}`)}
            </Button>
          ))}
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">{t("details")}</TabsTrigger>
          <TabsTrigger value="links">{t("links")}</TabsTrigger>
          <TabsTrigger value="history">{t("history")}</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <DetailsTab item={item} t={t} />
        </TabsContent>

        <TabsContent value="links">
          <LinksTab itemId={itemId} t={t} />
        </TabsContent>

        <TabsContent value="history">
          <HistoryTab itemId={itemId} t={t} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
