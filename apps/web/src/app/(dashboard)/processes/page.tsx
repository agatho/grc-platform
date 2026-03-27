"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  ChevronRight,
  ChevronDown,
  FolderOpen,
  FolderClosed,
  FileText,
  Search,
  Plus,
  Loader2,
  Workflow,
  User,
  Eye,
  LayoutGrid,
  List,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import {
  ProcessStatusBadge,
  ProcessStatusDot,
} from "@/components/process/process-status-badge";
import { ProcessGalleryCard } from "@/components/process/process-gallery-card";
import { ProcessBulkActions } from "@/components/process/process-bulk-actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@grc/ui";
import type { Process, ProcessStatus } from "@grc/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TreeNode {
  id: string;
  name: string;
  status: ProcessStatus;
  level: number;
  description?: string;
  processOwnerId?: string;
  ownerName?: string;
  reviewerName?: string;
  currentVersion: number;
  updatedAt?: string;
  children: TreeNode[];
}

type ViewMode = "list" | "gallery";

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ProcessesPage() {
  return (
    <ModuleGate moduleKey="bpm">
      <ProcessLandscape />
    </ModuleGate>
  );
}

function ProcessLandscape() {
  const t = useTranslations("process");
  const tGov = useTranslations("processGovernance");
  const tActions = useTranslations("actions");
  const router = useRouter();

  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Fetch tree data
  const fetchTree = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/processes/tree");
      if (!res.ok) throw new Error("Failed to load processes");
      const json = await res.json();
      setTreeData(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setTreeData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTree();
  }, [fetchTree]);

  // Flatten for filtering
  const flattenTree = useCallback(
    (nodes: TreeNode[]): TreeNode[] => {
      const result: TreeNode[] = [];
      for (const node of nodes) {
        result.push(node);
        if (node.children?.length) {
          result.push(...flattenTree(node.children));
        }
      }
      return result;
    },
    [],
  );

  const allNodes = useMemo(() => flattenTree(treeData), [treeData, flattenTree]);

  // Compute total and published counts
  const totalCount = allNodes.length;
  const publishedCount = allNodes.filter((n) => n.status === "published").length;

  // Selected process
  const selectedProcess = useMemo(
    () => allNodes.find((n) => n.id === selectedId) ?? null,
    [allNodes, selectedId],
  );

  // Filter logic
  const matchesFilters = useCallback(
    (node: TreeNode): boolean => {
      if (statusFilter !== "all" && node.status !== statusFilter) return false;
      if (levelFilter !== "all" && node.level !== Number(levelFilter)) return false;
      if (
        searchQuery.length >= 2 &&
        !node.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
        return false;
      return true;
    },
    [statusFilter, levelFilter, searchQuery],
  );

  // Filter tree preserving hierarchy
  const filterTree = useCallback(
    (nodes: TreeNode[]): TreeNode[] => {
      return nodes
        .map((node) => {
          const filteredChildren = filterTree(node.children ?? []);
          const selfMatches = matchesFilters(node);
          if (selfMatches || filteredChildren.length > 0) {
            return { ...node, children: filteredChildren };
          }
          return null;
        })
        .filter(Boolean) as TreeNode[];
    },
    [matchesFilters],
  );

  const filteredTree = useMemo(() => filterTree(treeData), [filterTree, treeData]);

  // Filtered flat nodes for gallery view
  const filteredFlatNodes = useMemo(
    () => allNodes.filter(matchesFilters),
    [allNodes, matchesFilters],
  );

  // Toggle expand
  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Auto-expand root nodes on load
  useEffect(() => {
    if (treeData.length > 0 && expandedIds.size === 0) {
      setExpandedIds(new Set(treeData.map((n) => n.id)));
    }
  }, [treeData]);

  // Bulk selection
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const STATUSES: ProcessStatus[] = [
    "draft",
    "in_review",
    "approved",
    "published",
    "archived",
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {totalCount > 0
              ? `${totalCount} ${t("processCount", { count: totalCount })} · ${publishedCount} ${t("publishedCount", { count: publishedCount })}`
              : t("subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-gray-200 p-0.5">
            <button
              className={cn(
                "p-1.5 rounded-md transition-colors",
                viewMode === "list"
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-400 hover:text-gray-600",
              )}
              onClick={() => setViewMode("list")}
              title={tGov("gallery.listView")}
            >
              <List size={16} />
            </button>
            <button
              className={cn(
                "p-1.5 rounded-md transition-colors",
                viewMode === "gallery"
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-400 hover:text-gray-600",
              )}
              onClick={() => setViewMode("gallery")}
              title={tGov("gallery.galleryView")}
            >
              <LayoutGrid size={16} />
            </button>
          </div>

          <Link href="/processes/governance">
            <Button variant="outline" size="sm">
              {tGov("governance.title")}
            </Button>
          </Link>
          <Link href="/processes/new">
            <Button>
              <Plus size={16} />
              {t("create")}
            </Button>
          </Link>
        </div>
      </div>

      {viewMode === "gallery" ? (
        /* Gallery View */
        <div>
          {/* Search + filters */}
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("tree.search")}
                className="w-full rounded-md border border-gray-300 py-2 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("tree.allStatuses")}</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`status.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : filteredFlatNodes.length === 0 ? (
            <div className="text-center py-12">
              <Workflow className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-3 text-sm text-gray-500">{t("empty.title")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredFlatNodes.map((node) => (
                <div key={node.id} className="relative">
                  {/* Bulk checkbox */}
                  <input
                    type="checkbox"
                    checked={selectedIds.has(node.id)}
                    onChange={() => toggleSelection(node.id)}
                    className="absolute top-2 left-2 z-10 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <ProcessGalleryCard
                    id={node.id}
                    name={node.name}
                    status={node.status}
                    level={node.level}
                    ownerName={node.ownerName}
                    updatedAt={node.updatedAt ?? new Date().toISOString()}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* List View (Tree) */
        <div className="flex gap-4" style={{ minHeight: "calc(100vh - 220px)" }}>
          {/* Left panel: Process Tree */}
          <div className="w-[280px] flex-shrink-0 rounded-lg border border-gray-200 bg-white">
            {/* Search */}
            <div className="p-3 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("tree.search")}
                  className="w-full rounded-md border border-gray-300 py-2 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Tree */}
            <div className="overflow-y-auto p-2" style={{ maxHeight: "calc(100vh - 400px)" }}>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                </div>
              ) : error ? (
                <div className="p-4 text-center text-sm text-red-500">{error}</div>
              ) : filteredTree.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-500">
                  {searchQuery || statusFilter !== "all" || levelFilter !== "all"
                    ? t("empty.noResults")
                    : t("empty.title")}
                </div>
              ) : (
                filteredTree.map((node) => (
                  <TreeNodeItem
                    key={node.id}
                    node={node}
                    depth={0}
                    selectedId={selectedId}
                    expandedIds={expandedIds}
                    selectedIds={selectedIds}
                    onSelect={setSelectedId}
                    onToggle={toggleExpand}
                    onToggleSelection={toggleSelection}
                  />
                ))
              )}
            </div>

            {/* Filters */}
            <div className="border-t border-gray-100 p-3 space-y-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 uppercase">
                  {t("tree.filterStatus")}
                </label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("tree.allStatuses")}</SelectItem>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {t(`status.${s}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 uppercase">
                  {t("tree.filterLevel")}
                </label>
                <Select value={levelFilter} onValueChange={setLevelFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("tree.allLevels")}</SelectItem>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((l) => (
                      <SelectItem key={l} value={String(l)}>
                        {t(`levels.${l}` as Parameters<typeof t>[0])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Right panel: Content area */}
          <div className="flex-1 rounded-lg border border-gray-200 bg-white">
            {selectedProcess ? (
              <div className="p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-semibold text-gray-900">
                        {selectedProcess.name}
                      </h2>
                      <ProcessStatusBadge status={selectedProcess.status} />
                    </div>
                    {selectedProcess.description && (
                      <p className="text-sm text-gray-600 max-w-prose">
                        {selectedProcess.description.length > 200
                          ? `${selectedProcess.description.slice(0, 200)}...`
                          : selectedProcess.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <span className="text-gray-500">{t("detail.level")}</span>
                    <p className="font-medium">
                      {t(`levels.${selectedProcess.level}` as Parameters<typeof t>[0])}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-gray-500">{t("detail.version")}</span>
                    <p className="font-medium">v{selectedProcess.currentVersion}</p>
                  </div>
                  {selectedProcess.ownerName && (
                    <div className="space-y-1">
                      <span className="text-gray-500">{t("detail.owner")}</span>
                      <p className="font-medium flex items-center gap-1">
                        <User size={14} className="text-gray-400" />
                        {selectedProcess.ownerName}
                      </p>
                    </div>
                  )}
                  {selectedProcess.reviewerName && (
                    <div className="space-y-1">
                      <span className="text-gray-500">{t("detail.reviewer")}</span>
                      <p className="font-medium flex items-center gap-1">
                        <User size={14} className="text-gray-400" />
                        {selectedProcess.reviewerName}
                      </p>
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <Link href={`/processes/${selectedProcess.id}`}>
                    <Button>
                      <Eye size={16} />
                      {t("detail.title")}
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center p-12">
                <div className="text-center space-y-3">
                  <Workflow className="mx-auto h-12 w-12 text-gray-300" />
                  <p className="text-sm text-gray-500">{t("empty.selectProcess")}</p>
                  {totalCount === 0 && (
                    <Link href="/processes/new">
                      <Button variant="outline" className="mt-2">
                        <Plus size={16} />
                        {t("empty.createFirst")}
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <ProcessBulkActions
          selectedIds={Array.from(selectedIds)}
          onClearSelection={clearSelection}
          onActionComplete={() => void fetchTree()}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tree Node Component
// ---------------------------------------------------------------------------

function TreeNodeItem({
  node,
  depth,
  selectedId,
  expandedIds,
  selectedIds,
  onSelect,
  onToggle,
  onToggleSelection,
}: {
  node: TreeNode;
  depth: number;
  selectedId: string | null;
  expandedIds: Set<string>;
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onToggleSelection: (id: string) => void;
}) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;
  const isChecked = selectedIds.has(node.id);

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 rounded-md px-2 py-1.5 cursor-pointer transition-colors text-sm",
          isSelected
            ? "bg-indigo-50 text-indigo-900"
            : "hover:bg-gray-50 text-gray-700",
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onSelect(node.id)}
      >
        {/* Bulk selection checkbox */}
        <input
          type="checkbox"
          checked={isChecked}
          onChange={(e) => {
            e.stopPropagation();
            onToggleSelection(node.id);
          }}
          onClick={(e) => e.stopPropagation()}
          className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 flex-shrink-0"
        />

        {/* Expand/collapse */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.id);
            }}
            className="p-0.5 rounded hover:bg-gray-200 flex-shrink-0"
          >
            {isExpanded ? (
              <ChevronDown size={14} className="text-gray-400" />
            ) : (
              <ChevronRight size={14} className="text-gray-400" />
            )}
          </button>
        ) : (
          <span className="w-5 flex-shrink-0" />
        )}

        {/* Icon */}
        {hasChildren ? (
          isExpanded ? (
            <FolderOpen size={14} className="text-indigo-400 flex-shrink-0" />
          ) : (
            <FolderClosed size={14} className="text-indigo-400 flex-shrink-0" />
          )
        ) : (
          <FileText size={14} className="text-gray-400 flex-shrink-0" />
        )}

        {/* Name */}
        <span className="truncate flex-1 ml-1" title={node.name}>
          {node.name}
        </span>

        {/* Status dot */}
        <ProcessStatusDot status={node.status} className="flex-shrink-0" />
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              expandedIds={expandedIds}
              selectedIds={selectedIds}
              onSelect={onSelect}
              onToggle={onToggle}
              onToggleSelection={onToggleSelection}
            />
          ))}
        </div>
      )}
    </div>
  );
}
