"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  ChevronRight,
  ChevronDown,
  Building2,
  ArrowLeft,
  ChevronsDownUp,
  ChevronsUpDown,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

interface OrgNode {
  id: string;
  name: string;
  shortName: string | null;
  type: string;
  country: string;
  children: OrgNode[];
}

// ──────────────────────────────────────────────────────────────
// Country flag helper — maps ISO 3166-1 alpha-3 to flag emoji
// ──────────────────────────────────────────────────────────────

const COUNTRY_FLAGS: Record<string, string> = {
  DEU: "\u{1F1E9}\u{1F1EA}",
  AUT: "\u{1F1E6}\u{1F1F9}",
  CHE: "\u{1F1E8}\u{1F1ED}",
  GBR: "\u{1F1EC}\u{1F1E7}",
  FRA: "\u{1F1EB}\u{1F1F7}",
  ITA: "\u{1F1EE}\u{1F1F9}",
  ESP: "\u{1F1EA}\u{1F1F8}",
  NLD: "\u{1F1F3}\u{1F1F1}",
  BEL: "\u{1F1E7}\u{1F1EA}",
  POL: "\u{1F1F5}\u{1F1F1}",
  CZE: "\u{1F1E8}\u{1F1FF}",
  USA: "\u{1F1FA}\u{1F1F8}",
  LUX: "\u{1F1F1}\u{1F1FA}",
  SWE: "\u{1F1F8}\u{1F1EA}",
  DNK: "\u{1F1E9}\u{1F1F0}",
  NOR: "\u{1F1F3}\u{1F1F4}",
  FIN: "\u{1F1EB}\u{1F1EE}",
  IRL: "\u{1F1EE}\u{1F1EA}",
  PRT: "\u{1F1F5}\u{1F1F9}",
  HUN: "\u{1F1ED}\u{1F1FA}",
  ROU: "\u{1F1F7}\u{1F1F4}",
  BGR: "\u{1F1E7}\u{1F1EC}",
  HRV: "\u{1F1ED}\u{1F1F7}",
  SVK: "\u{1F1F8}\u{1F1F0}",
  SVN: "\u{1F1F8}\u{1F1EE}",
  GRC: "\u{1F1EC}\u{1F1F7}",
};

function countryDisplay(code: string): string {
  return COUNTRY_FLAGS[code] ?? code;
}

// ──────────────────────────────────────────────────────────────
// Type badge variant helper
// ──────────────────────────────────────────────────────────────

function typeBadgeVariant(
  orgType: string,
): "default" | "secondary" | "outline" {
  switch (orgType) {
    case "holding":
      return "default";
    case "subsidiary":
      return "secondary";
    case "joint_venture":
      return "outline";
    case "branch":
      return "secondary";
    default:
      return "secondary";
  }
}

// ──────────────────────────────────────────────────────────────
// Collect all node IDs for expand/collapse all
// ──────────────────────────────────────────────────────────────

function collectIds(nodes: OrgNode[]): Set<string> {
  const ids = new Set<string>();
  function walk(list: OrgNode[]) {
    for (const node of list) {
      if (node.children.length > 0) {
        ids.add(node.id);
        walk(node.children);
      }
    }
  }
  walk(nodes);
  return ids;
}

// ──────────────────────────────────────────────────────────────
// Recursive TreeNode component
// ──────────────────────────────────────────────────────────────

function TreeNode({
  node,
  level,
  expanded,
  onToggle,
  t,
}: {
  node: OrgNode;
  level: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const isExpanded = expanded.has(node.id);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-gray-50 transition-colors group"
        style={{ paddingLeft: `${level * 24 + 8}px` }}
      >
        {/* Expand / collapse toggle */}
        {hasChildren ? (
          <button
            onClick={() => onToggle(node.id)}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-gray-200 transition-colors"
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? (
              <ChevronDown size={14} className="text-gray-500" />
            ) : (
              <ChevronRight size={14} className="text-gray-500" />
            )}
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}

        {/* Org icon */}
        <Building2 size={16} className="shrink-0 text-gray-400" />

        {/* Org name — link to list */}
        <Link
          href="/organizations"
          className="text-sm font-medium text-gray-900 hover:text-blue-600 hover:underline transition-colors"
        >
          {node.name}
        </Link>

        {/* Short name */}
        {node.shortName && (
          <span className="text-xs text-gray-400">({node.shortName})</span>
        )}

        {/* Type badge */}
        <Badge
          variant={typeBadgeVariant(node.type)}
          className="text-[10px] px-1.5 py-0"
        >
          {t(
            `types.${node.type as "subsidiary" | "holding" | "joint_venture" | "branch"}`,
          )}
        </Badge>

        {/* Country flag */}
        <span className="text-sm" title={node.country}>
          {countryDisplay(node.country)}
        </span>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              expanded={expanded}
              onToggle={onToggle}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────────────────────

export default function OrganizationTreePage() {
  const t = useTranslations("organizations");
  const tCommon = useTranslations("common");

  // [OP-245 · Gestalt A] Abruf beim Einhängen über `@tanstack/react-query`
  // statt Effekt plus gespiegeltem Lade- und Datenzustand (Muster aus
  // Welle 7b, `catalogs/objects/page.tsx`). Eine nicht-ok-Antwort liefert wie
  // vorher einen leeren Baum; ein Netzfehler wird nicht mehr verschluckt,
  // sondern landet im Fehlerzustand der Abfrage.
  const { data: tree = [], isPending: loading } = useQuery<OrgNode[]>({
    queryKey: ["organizations", "tree"],
    queryFn: async () => {
      const res = await fetch("/api/v1/organizations/tree");
      if (!res.ok) return [];
      const json = (await res.json()) as { data: OrgNode[] };
      return json.data;
    },
  });

  // Auto-expand the first level. Vorher setzte der Abruf `expanded` nach dem
  // Laden einmal auf die erste Ebene; jetzt ist die erste Ebene der
  // ABGELEITETE Vorgabewert, solange der Nutzer noch nichts auf- oder
  // zugeklappt hat (`null`). Ab dem ersten Klick gilt sein Zustand.
  const [expandedOverride, setExpandedOverride] = useState<Set<string> | null>(
    null,
  );
  const expanded = useMemo(
    () =>
      expandedOverride ??
      new Set(tree.filter((n) => n.children.length > 0).map((n) => n.id)),
    [expandedOverride, tree],
  );

  const toggleNode = (id: string) => {
    setExpandedOverride((prev) => {
      const next = new Set(prev ?? expanded);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedOverride(collectIds(tree));
  };

  const collapseAll = () => {
    setExpandedOverride(new Set());
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("tree")}</h1>
          <p className="mt-1 text-sm text-gray-500">{t("treeDescription")}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <Link href="/organizations">
          <Button variant="outline" size="sm">
            <ArrowLeft size={16} />
            {t("backToList")}
          </Button>
        </Link>
        <Button variant="outline" size="sm" onClick={expandAll}>
          <ChevronsUpDown size={16} />
          {t("expandAll")}
        </Button>
        <Button variant="outline" size="sm" onClick={collapseAll}>
          <ChevronsDownUp size={16} />
          {t("collapseAll")}
        </Button>
      </div>

      {/* Tree */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-sm text-gray-500">{tCommon("loading")}</p>
          </div>
        ) : tree.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-sm text-gray-400">{t("noOrganizations")}</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {tree.map((node) => (
              <TreeNode
                key={node.id}
                node={node}
                level={0}
                expanded={expanded}
                onToggle={toggleNode}
                t={t}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
