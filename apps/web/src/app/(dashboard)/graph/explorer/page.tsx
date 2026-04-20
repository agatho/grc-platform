"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Network,
  Search,
  Loader2,
  RefreshCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Filter,
  Target,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type {
  SubgraphResponse,
  GraphNodeData,
  GraphLayout,
  ImpactAnalysisResponse,
  EntitySearchResult,
  AffectedEntityData,
} from "@grc/shared";
import {
  GRAPH_ENTITY_COLORS,
  GRAPH_ENTITY_TYPES,
  GRAPH_RELATIONSHIP_TYPES,
} from "@grc/shared";

// ─── D3 Graph Canvas Component ─────────────────────────────

interface GraphCanvasProps {
  nodes: GraphNodeData[];
  edges: SubgraphResponse["edges"];
  layout: GraphLayout;
  selectedNodeId: string | null;
  blastRadiusNodeId: string | null;
  impactData: ImpactAnalysisResponse | null;
  onNodeClick: (node: GraphNodeData) => void;
  onNodeDoubleClick: (node: GraphNodeData) => void;
  onNodeRightClick: (node: GraphNodeData, event: React.MouseEvent) => void;
  svgRef: React.RefObject<SVGSVGElement | null>;
}

function GraphCanvas({
  nodes,
  edges,
  layout: _layout,
  selectedNodeId,
  blastRadiusNodeId,
  impactData,
  onNodeClick,
  onNodeDoubleClick,
  onNodeRightClick,
  svgRef,
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<unknown>(null);
  const [positions, setPositions] = useState<
    Map<string, { x: number; y: number }>
  >(new Map());
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const t = useTranslations("graph");

  // Build impact score map for blast radius visualization
  const impactScoreMap = new Map<string, number>();
  if (impactData && blastRadiusNodeId) {
    for (const entity of impactData.affectedEntities) {
      impactScoreMap.set(entity.entityId, entity.impactScore);
    }
  }

  // Initialize force simulation
  useEffect(() => {
    if (nodes.length === 0) return;

    const width = containerRef.current?.clientWidth ?? 800;
    const height = containerRef.current?.clientHeight ?? 600;

    // Simple force simulation without D3 dependency (pure JS)
    const nodePositions = new Map<
      string,
      { x: number; y: number; vx: number; vy: number }
    >();

    // Initialize positions
    nodes.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / nodes.length;
      const radius = Math.min(width, height) * 0.3;
      nodePositions.set(node.id, {
        x: width / 2 + radius * Math.cos(angle),
        y: height / 2 + radius * Math.sin(angle),
        vx: 0,
        vy: 0,
      });
    });

    // Build adjacency for edge force
    const edgeSet = new Set(edges.map((e) => `${e.sourceId}:${e.targetId}`));

    // Run simulation iterations
    let iteration = 0;
    const maxIterations = 200;
    const alpha = 0.3;

    const tick = () => {
      if (iteration >= maxIterations) {
        setPositions(
          new Map(
            Array.from(nodePositions.entries()).map(([id, p]) => [
              id,
              { x: p.x, y: p.y },
            ]),
          ),
        );
        return;
      }

      const currentAlpha = alpha * (1 - iteration / maxIterations);

      // Repulsion between all nodes
      const nodeArr = Array.from(nodePositions.entries());
      for (let i = 0; i < nodeArr.length; i++) {
        for (let j = i + 1; j < nodeArr.length; j++) {
          const [, a] = nodeArr[i];
          const [, b] = nodeArr[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = (150 * currentAlpha) / dist;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          a.vx -= fx;
          a.vy -= fy;
          b.vx += fx;
          b.vy += fy;
        }
      }

      // Attraction along edges
      for (const edge of edges) {
        const a = nodePositions.get(edge.sourceId);
        const b = nodePositions.get(edge.targetId);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - 100) * 0.05 * currentAlpha;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }

      // Center gravity
      for (const [, pos] of nodePositions) {
        pos.vx += (width / 2 - pos.x) * 0.01 * currentAlpha;
        pos.vy += (height / 2 - pos.y) * 0.01 * currentAlpha;
      }

      // Apply velocities with damping
      for (const [, pos] of nodePositions) {
        pos.vx *= 0.8;
        pos.vy *= 0.8;
        pos.x += pos.vx;
        pos.y += pos.vy;
        // Keep within bounds
        pos.x = Math.max(40, Math.min(width - 40, pos.x));
        pos.y = Math.max(40, Math.min(height - 40, pos.y));
      }

      iteration++;

      if (iteration % 10 === 0 || iteration >= maxIterations) {
        setPositions(
          new Map(
            Array.from(nodePositions.entries()).map(([id, p]) => [
              id,
              { x: p.x, y: p.y },
            ]),
          ),
        );
      }

      if (iteration < maxIterations) {
        requestAnimationFrame(tick);
      }
    };

    requestAnimationFrame(tick);

    return () => {
      iteration = maxIterations; // stop simulation
    };
  }, [nodes, edges]);

  // Get node radius based on connection count
  const getNodeRadius = (node: GraphNodeData): number => {
    return Math.max(8, Math.min(24, 8 + node.connectionCount * 2));
  };

  // Get blast radius opacity
  const getBlastRadiusOpacity = (nodeId: string): number => {
    if (!blastRadiusNodeId || !impactData) return 1;
    if (nodeId === blastRadiusNodeId) return 1;
    const score = impactScoreMap.get(nodeId);
    if (score === undefined) return 0.15;
    return Math.max(0.2, score / 100);
  };

  // Get blast radius stroke color
  const getBlastRadiusStroke = (nodeId: string): string => {
    if (!blastRadiusNodeId || !impactData) return "transparent";
    if (nodeId === blastRadiusNodeId) return "#ef4444";
    const score = impactScoreMap.get(nodeId);
    if (score === undefined) return "transparent";
    if (score >= 70) return "#ef4444";
    if (score >= 40) return "#f97316";
    return "#eab308";
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && !dragging) {
      setPanning(true);
      setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (panning) {
      setTransform((prev) => ({
        ...prev,
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      }));
    }
    if (dragging) {
      const svgRect = svgRef.current?.getBoundingClientRect();
      if (!svgRect) return;
      const x = (e.clientX - svgRect.left - transform.x) / transform.k;
      const y = (e.clientY - svgRect.top - transform.y) / transform.k;
      setPositions((prev) => {
        const next = new Map(prev);
        next.set(dragging, { x, y });
        return next;
      });
    }
  };

  const handleMouseUp = () => {
    setPanning(false);
    setDragging(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform((prev) => ({
      ...prev,
      k: Math.max(0.1, Math.min(4, prev.k * delta)),
    }));
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-gray-50 dark:bg-gray-900 overflow-hidden"
    >
      <svg
        ref={svgRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <g
          transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}
        >
          {/* Edges */}
          {edges.map((edge) => {
            const source = positions.get(edge.sourceId);
            const target = positions.get(edge.targetId);
            if (!source || !target) return null;
            const opacity = blastRadiusNodeId
              ? Math.min(
                  getBlastRadiusOpacity(edge.sourceId),
                  getBlastRadiusOpacity(edge.targetId),
                )
              : 0.4;
            return (
              <g key={edge.id}>
                <line
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke="#94a3b8"
                  strokeWidth={Math.max(1, edge.weight / 30)}
                  strokeOpacity={opacity}
                />
                {/* Edge label */}
                {transform.k > 0.6 && (
                  <text
                    x={(source.x + target.x) / 2}
                    y={(source.y + target.y) / 2 - 4}
                    textAnchor="middle"
                    fontSize={9}
                    fill="#64748b"
                    opacity={opacity}
                  >
                    {edge.relationship}
                  </text>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const pos = positions.get(node.id);
            if (!pos) return null;
            const radius = getNodeRadius(node);
            const color = GRAPH_ENTITY_COLORS[node.type] ?? "#6b7280";
            const opacity = getBlastRadiusOpacity(node.id);
            const strokeColor = getBlastRadiusStroke(node.id);
            const isSelected = node.id === selectedNodeId;

            return (
              <g
                key={node.id}
                transform={`translate(${pos.x},${pos.y})`}
                opacity={opacity}
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onNodeClick(node);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onNodeDoubleClick(node);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onNodeRightClick(node, e);
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setDragging(node.id);
                }}
              >
                {/* Blast radius glow */}
                {strokeColor !== "transparent" && (
                  <circle
                    r={radius + 4}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={3}
                    strokeOpacity={0.5}
                  />
                )}
                {/* Selection ring */}
                {isSelected && (
                  <circle
                    r={radius + 3}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    strokeDasharray="4 2"
                  />
                )}
                {/* Node circle */}
                <circle r={radius} fill={color} stroke="#fff" strokeWidth={2} />
                {/* Node label */}
                {transform.k > 0.4 && (
                  <text
                    y={radius + 14}
                    textAnchor="middle"
                    fontSize={10}
                    fill="#334155"
                    fontWeight={isSelected ? 600 : 400}
                  >
                    {node.name.length > 20
                      ? node.name.slice(0, 18) + "..."
                      : node.name}
                  </text>
                )}
                {/* Type badge */}
                {transform.k > 0.7 && (
                  <text
                    y={-radius - 4}
                    textAnchor="middle"
                    fontSize={8}
                    fill="#64748b"
                  >
                    {node.type}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Node/Edge counts */}
      <div className="absolute bottom-4 left-4 text-xs text-muted-foreground bg-white/80 dark:bg-gray-800/80 px-2 py-1 rounded">
        {t("explorer.nodeCount", { count: nodes.length })} |{" "}
        {t("explorer.edgeCount", { count: edges.length })}
      </div>
    </div>
  );
}

// ─── Impact Panel Component ────────────────────────────────

function ImpactPanel({
  impactData,
  loading,
  onClose,
}: {
  impactData: ImpactAnalysisResponse | null;
  loading: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("graph");

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!impactData) return null;

  const getSeverityLabel = (score: number): string => {
    if (score >= 70) return t("impact.severity.critical");
    if (score >= 50) return t("impact.severity.high");
    if (score >= 30) return t("impact.severity.medium");
    if (score >= 10) return t("impact.severity.low");
    return t("impact.severity.minimal");
  };

  const getSeverityColor = (score: number): string => {
    if (score >= 70)
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    if (score >= 50)
      return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
    if (score >= 30)
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
  };

  // Group by hop distance
  const byDistance = new Map<number, AffectedEntityData[]>();
  for (const entity of impactData.affectedEntities) {
    const list = byDistance.get(entity.hopDistance) ?? [];
    list.push(entity);
    byDistance.set(entity.hopDistance, list);
  }

  return (
    <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(100vh-200px)]">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">{t("impact.title")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("impact.subtitle", { name: impactData.sourceEntity.name })}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3">
          <div className="text-2xl font-bold">
            {impactData.affectedEntities.length}
          </div>
          <div className="text-xs text-muted-foreground">
            {t("impact.affectedEntities")}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-2xl font-bold">
            {impactData.totalImpactScore}
          </div>
          <div className="text-xs text-muted-foreground">
            {t("impact.totalImpactScore")}
          </div>
        </Card>
      </div>

      {/* Affected entities by distance ring */}
      {Array.from(byDistance.entries())
        .sort(([a], [b]) => a - b)
        .map(([distance, entities]) => (
          <div key={distance} className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {distance === 1
                  ? t("impact.direct")
                  : distance === 2
                    ? t("impact.indirect")
                    : t("impact.tertiary")}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {t("impact.hopDistance")}: {distance}
              </span>
            </div>
            {entities.map((entity) => (
              <Card key={entity.entityId} className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{
                        backgroundColor:
                          GRAPH_ENTITY_COLORS[entity.entityType] ?? "#6b7280",
                      }}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {entity.entityName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {entity.entityType}
                      </div>
                    </div>
                  </div>
                  <Badge className={getSeverityColor(entity.impactScore)}>
                    {entity.impactScore}
                  </Badge>
                </div>
                {entity.path.length > 1 && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
                    {entity.path.map((id, i) => (
                      <span key={i} className="flex items-center gap-1">
                        {i > 0 && <ChevronRight className="h-3 w-3" />}
                        <span className="truncate max-w-[80px]">
                          {id.slice(0, 8)}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        ))}

      {impactData.affectedEntities.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center">
          {t("impact.noAffected")}
        </p>
      )}

      {/* Critical paths */}
      {impactData.criticalPaths.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-sm">{t("impact.criticalPaths")}</h4>
          {impactData.criticalPaths.map((path, i) => (
            <Card key={i} className="p-2">
              <div className="flex items-center gap-1 text-xs flex-wrap">
                {path.map((id, j) => (
                  <span key={j} className="flex items-center gap-1">
                    {j > 0 && (
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    )}
                    <Badge variant="outline" className="text-xs">
                      {id.slice(0, 8)}
                    </Badge>
                  </span>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Explorer Page ────────────────────────────────────

export default function GraphExplorerPage() {
  const t = useTranslations("graph");
  const router = useRouter();
  const searchParams = useSearchParams();
  const svgRef = useRef<SVGSVGElement>(null);

  // State
  const [graphData, setGraphData] = useState<SubgraphResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<EntitySearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<GraphNodeData | null>(null);
  const [blastRadiusNode, setBlastRadiusNode] = useState<string | null>(null);
  const [impactData, setImpactData] = useState<ImpactAnalysisResponse | null>(
    null,
  );
  const [impactLoading, setImpactLoading] = useState(false);
  const [showImpactPanel, setShowImpactPanel] = useState(false);
  const [layout, setLayout] = useState<GraphLayout>("force");
  const [depth, setDepth] = useState(3);
  const [showFilter, setShowFilter] = useState(true);
  const [contextMenu, setContextMenu] = useState<{
    node: GraphNodeData;
    x: number;
    y: number;
  } | null>(null);

  // Filters
  const [selectedEntityTypes, setSelectedEntityTypes] = useState<Set<string>>(
    new Set(GRAPH_ENTITY_TYPES),
  );
  const [selectedRelationships, setSelectedRelationships] = useState<
    Set<string>
  >(new Set(GRAPH_RELATIONSHIP_TYPES));

  // Starting entity from URL params
  const startEntityId = searchParams.get("entityId");
  const startEntityType = searchParams.get("entityType");

  // Fetch subgraph
  const fetchGraph = useCallback(
    async (entityId: string, entityType: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          entityId,
          entityType,
          depth: depth.toString(),
        });

        if (selectedEntityTypes.size < GRAPH_ENTITY_TYPES.length) {
          params.set("entityTypes", Array.from(selectedEntityTypes).join(","));
        }
        if (selectedRelationships.size < GRAPH_RELATIONSHIP_TYPES.length) {
          params.set(
            "relationshipTypes",
            Array.from(selectedRelationships).join(","),
          );
        }

        const res = await fetch(`/api/v1/graph/subgraph?${params}`);
        if (!res.ok) throw new Error("Failed to fetch graph");
        const data = await res.json();
        setGraphData(data);
      } catch (err) {
        console.error("Failed to fetch graph:", err);
      } finally {
        setLoading(false);
      }
    },
    [depth, selectedEntityTypes, selectedRelationships],
  );

  // Load initial graph from URL params
  useEffect(() => {
    if (startEntityId && startEntityType) {
      fetchGraph(startEntityId, startEntityType);
    }
  }, [startEntityId, startEntityType, fetchGraph]);

  // Search entities
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(
          `/api/v1/graph/search?q=${encodeURIComponent(searchQuery)}&limit=10`,
        );
        if (res.ok) {
          const { data } = await res.json();
          setSearchResults(data);
        }
      } catch {
        // ignore
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Run impact analysis
  const runImpactAnalysis = useCallback(
    async (entityId: string, entityType: string) => {
      setImpactLoading(true);
      setShowImpactPanel(true);
      setBlastRadiusNode(entityId);
      try {
        const res = await fetch("/api/v1/graph/impact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entityId, entityType, maxDepth: depth }),
        });
        if (res.ok) {
          const data = await res.json();
          setImpactData(data);
        }
      } catch (err) {
        console.error("Impact analysis failed:", err);
      } finally {
        setImpactLoading(false);
      }
    },
    [depth],
  );

  // Handle node interactions
  const handleNodeClick = useCallback((node: GraphNodeData) => {
    setSelectedNode(node);
    setContextMenu(null);
  }, []);

  const handleNodeDoubleClick = useCallback(
    (node: GraphNodeData) => {
      fetchGraph(node.id, node.type);
    },
    [fetchGraph],
  );

  const handleNodeRightClick = useCallback(
    (node: GraphNodeData, event: React.MouseEvent) => {
      setContextMenu({ node, x: event.clientX, y: event.clientY });
    },
    [],
  );

  const handleSearchSelect = useCallback(
    (result: EntitySearchResult) => {
      setSearchQuery("");
      setSearchResults([]);
      fetchGraph(result.entityId, result.entityType);
    },
    [fetchGraph],
  );

  const toggleEntityType = (type: string) => {
    setSelectedEntityTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const toggleRelationship = (rel: string) => {
    setSelectedRelationships((prev) => {
      const next = new Set(prev);
      if (next.has(rel)) next.delete(rel);
      else next.add(rel);
      return next;
    });
  };

  const getEntityTypeUrl = (type: string): string => {
    const urlMap: Record<string, string> = {
      risk: "/risks",
      control: "/controls",
      asset: "/assets",
      process: "/processes",
      vendor: "/tprm",
      document: "/documents",
      finding: "/controls",
      incident: "/isms",
      audit: "/audit",
    };
    return urlMap[type] ?? "/";
  };

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Left Sidebar: Filters */}
      {showFilter && (
        <div className="w-72 border-r bg-background overflow-y-auto shrink-0">
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">{t("filter.title")}</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFilter(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("filter.search")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
              {searchResults.length > 0 && (
                <div className="absolute z-50 top-full mt-1 w-full bg-background border rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {searchResults.map((result) => (
                    <button
                      key={result.entityId}
                      onClick={() => handleSearchSelect(result)}
                      className="w-full text-left px-3 py-2 hover:bg-accent flex items-center gap-2"
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{
                          backgroundColor:
                            GRAPH_ENTITY_COLORS[result.entityType] ?? "#6b7280",
                        }}
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">
                          {result.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {result.entityType}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Depth slider */}
            <div>
              <Label className="text-xs">
                {t("filter.depthSlider")}: {depth}
              </Label>
              <input
                type="range"
                min={1}
                max={5}
                value={depth}
                onChange={(e) => setDepth(Number(e.target.value))}
                className="w-full mt-1"
              />
            </div>

            {/* Layout select */}
            <div>
              <Label className="text-xs">{t("explorer.layout")}</Label>
              <Select
                value={layout}
                onValueChange={(v) => setLayout(v as GraphLayout)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="force">
                    {t("explorer.layouts.force")}
                  </SelectItem>
                  <SelectItem value="hierarchical">
                    {t("explorer.layouts.hierarchical")}
                  </SelectItem>
                  <SelectItem value="radial">
                    {t("explorer.layouts.radial")}
                  </SelectItem>
                  <SelectItem value="circular">
                    {t("explorer.layouts.circular")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Entity type filters */}
            <div>
              <Label className="text-xs">{t("filter.entityTypes")}</Label>
              <div className="mt-2 space-y-1.5">
                {GRAPH_ENTITY_TYPES.map((type) => (
                  <div key={type} className="flex items-center gap-2">
                    <Checkbox
                      id={`type-${type}`}
                      checked={selectedEntityTypes.has(type)}
                      onCheckedChange={() => toggleEntityType(type)}
                    />
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{
                        backgroundColor: GRAPH_ENTITY_COLORS[type] ?? "#6b7280",
                      }}
                    />
                    <Label
                      htmlFor={`type-${type}`}
                      className="text-xs cursor-pointer"
                    >
                      {t(`entityTypes.${type}`)}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Relationship type filters */}
            <div>
              <Label className="text-xs">{t("filter.relationshipTypes")}</Label>
              <div className="mt-2 space-y-1.5">
                {GRAPH_RELATIONSHIP_TYPES.map((rel) => (
                  <div key={rel} className="flex items-center gap-2">
                    <Checkbox
                      id={`rel-${rel}`}
                      checked={selectedRelationships.has(rel)}
                      onCheckedChange={() => toggleRelationship(rel)}
                    />
                    <Label
                      htmlFor={`rel-${rel}`}
                      className="text-xs cursor-pointer"
                    >
                      {t(`relationships.${rel}`)}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Apply filters button */}
            {graphData && startEntityId && startEntityType && (
              <Button
                onClick={() => fetchGraph(startEntityId, startEntityType)}
                className="w-full"
                size="sm"
              >
                {t("filter.applyFilters")}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Main graph area */}
      <div className="flex-1 flex flex-col relative">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b px-4 py-2">
          <div className="flex items-center gap-2">
            {!showFilter && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFilter(true)}
              >
                <Filter className="h-4 w-4 mr-1" />
                {t("filter.title")}
              </Button>
            )}
            <Network className="h-5 w-5 text-muted-foreground" />
            <h1 className="font-semibold">{t("explorer.title")}</h1>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (startEntityId && startEntityType)
                  fetchGraph(startEntityId, startEntityType);
              }}
            >
              <RefreshCcw className="h-4 w-4" />
            </Button>
            <Link href="/graph/dependencies">
              <Button variant="ghost" size="sm">
                {t("dependencies.title")}
              </Button>
            </Link>
            <Link href="/graph/orphans">
              <Button variant="ghost" size="sm">
                {t("orphans.title")}
              </Button>
            </Link>
          </div>
        </div>

        {/* Graph canvas */}
        <div className="flex-1 relative">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">
                {t("explorer.loading")}
              </span>
            </div>
          ) : !graphData || graphData.nodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <Network className="h-16 w-16 mb-4 opacity-20" />
              <p className="text-lg font-medium">{t("explorer.title")}</p>
              <p className="text-sm mt-1">{t("explorer.empty")}</p>
              <p className="text-xs mt-4">{t("filter.search")}</p>
            </div>
          ) : (
            <GraphCanvas
              nodes={graphData.nodes}
              edges={graphData.edges}
              layout={layout}
              selectedNodeId={selectedNode?.id ?? null}
              blastRadiusNodeId={blastRadiusNode}
              impactData={impactData}
              onNodeClick={handleNodeClick}
              onNodeDoubleClick={handleNodeDoubleClick}
              onNodeRightClick={handleNodeRightClick}
              svgRef={svgRef}
            />
          )}
        </div>

        {/* Context menu */}
        {contextMenu && (
          <div
            className="absolute z-50 bg-background border rounded-lg shadow-lg py-1 min-w-48"
            style={{ left: contextMenu.x, top: contextMenu.y - 64 }}
          >
            <button
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent flex items-center gap-2"
              onClick={() => {
                runImpactAnalysis(contextMenu.node.id, contextMenu.node.type);
                setContextMenu(null);
              }}
            >
              <Target className="h-4 w-4" />
              {t("explorer.startImpactAnalysis")}
            </button>
            <button
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent flex items-center gap-2"
              onClick={() => {
                fetchGraph(contextMenu.node.id, contextMenu.node.type);
                setContextMenu(null);
              }}
            >
              <Network className="h-4 w-4" />
              {t("explorer.showNeighbors")}
            </button>
            <button
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent flex items-center gap-2"
              onClick={() => {
                router.push(
                  `${getEntityTypeUrl(contextMenu.node.type)}/${contextMenu.node.id}`,
                );
                setContextMenu(null);
              }}
            >
              <ExternalLink className="h-4 w-4" />
              {t("explorer.openEntity")}
            </button>
          </div>
        )}

        {/* Click outside to close context menu */}
        {contextMenu && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setContextMenu(null)}
          />
        )}
      </div>

      {/* Right sidebar: Node details + Impact */}
      {(selectedNode || showImpactPanel) && (
        <div className="w-80 border-l bg-background overflow-y-auto shrink-0">
          {/* Selected node info */}
          {selectedNode && !showImpactPanel && (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">{selectedNode.name}</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedNode(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{
                    backgroundColor:
                      GRAPH_ENTITY_COLORS[selectedNode.type] ?? "#6b7280",
                  }}
                />
                <span className="text-sm text-muted-foreground">
                  {t(`entityTypes.${selectedNode.type}`)}
                </span>
              </div>
              {selectedNode.status && (
                <Badge variant="outline">{selectedNode.status}</Badge>
              )}
              <div className="text-xs text-muted-foreground">
                {t("dependencies.connections", {
                  count: selectedNode.connectionCount,
                })}
              </div>
              <div className="space-y-2 pt-2">
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() =>
                    runImpactAnalysis(selectedNode.id, selectedNode.type)
                  }
                >
                  <Target className="h-4 w-4 mr-1" />
                  {t("explorer.startImpactAnalysis")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() =>
                    router.push(
                      `${getEntityTypeUrl(selectedNode.type)}/${selectedNode.id}`,
                    )
                  }
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  {t("explorer.openEntity")}
                </Button>
              </div>
            </div>
          )}

          {/* Impact analysis panel */}
          {showImpactPanel && (
            <ImpactPanel
              impactData={impactData}
              loading={impactLoading}
              onClose={() => {
                setShowImpactPanel(false);
                setBlastRadiusNode(null);
                setImpactData(null);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
