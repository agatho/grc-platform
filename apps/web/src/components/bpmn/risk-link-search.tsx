"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RiskSearchResult {
  id: string;
  title: string;
  elementId?: string;
  riskScoreInherent?: number;
  status?: string;
}

interface RiskLinkSearchProps {
  /** Process ID */
  processId: string;
  /** Process step ID for step-level risk linking */
  processStepId?: string;
  /** Callback when a risk is linked */
  onRiskLinked: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getScoreBadgeColor(score?: number): string {
  if (!score) return "bg-gray-100 text-gray-600";
  if (score <= 8) return "bg-green-100 text-green-800";
  if (score <= 15) return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RiskLinkSearch({
  processId,
  processStepId,
  onRiskLinked,
}: RiskLinkSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RiskSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Debounced search (300ms)
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/v1/risks?search=${encodeURIComponent(query)}&limit=10`,
        );
        if (res.ok) {
          const json = await res.json();
          const data = (json.data ?? []).map(
            (r: Record<string, unknown>) => ({
              id: r.id as string,
              title: r.title as string,
              elementId: r.elementId as string | undefined,
              riskScoreInherent: r.riskScoreInherent as number | undefined,
              status: r.status as string | undefined,
            }),
          );
          setResults(data);
          setShowDropdown(true);
        }
      } catch {
        // Search failed — silently ignore
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Link risk
  const handleLink = useCallback(
    async (riskId: string) => {
      setLinking(riskId);
      try {
        const body: Record<string, unknown> = { riskId };
        if (processStepId) {
          body.processStepId = processStepId;
        }
        const res = await fetch(`/api/v1/processes/${processId}/risks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(
            (err as Record<string, string>).error ?? "Link failed",
          );
        }
        toast.success("Risk linked");
        setQuery("");
        setResults([]);
        setShowDropdown(false);
        onRiskLinked();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to link risk",
        );
      } finally {
        setLinking(null);
      }
    },
    [processId, processStepId, onRiskLinked],
  );

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setShowDropdown(true);
          }}
          placeholder="Search risks..."
          className="w-full rounded-md border border-gray-200 pl-9 pr-3 py-1.5 text-sm bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {searching && (
          <Loader2
            size={14}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin"
          />
        )}
      </div>

      {/* Dropdown results */}
      {showDropdown && results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full max-h-60 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
          {results.map((risk) => (
            <button
              key={risk.id}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50 border-b border-gray-100 last:border-b-0 disabled:opacity-50"
              onClick={() => handleLink(risk.id)}
              disabled={linking === risk.id}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {risk.elementId && (
                    <span className="text-xs font-mono text-indigo-600">
                      {risk.elementId}
                    </span>
                  )}
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {risk.title}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                {risk.riskScoreInherent != null && (
                  <span
                    className={`text-xs font-medium px-1.5 py-0.5 rounded ${getScoreBadgeColor(risk.riskScoreInherent)}`}
                  >
                    {risk.riskScoreInherent}
                  </span>
                )}
                {linking === risk.id ? (
                  <Loader2 size={14} className="animate-spin text-gray-400" />
                ) : (
                  <Plus size={14} className="text-gray-400" />
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No results */}
      {showDropdown &&
        query.length >= 2 &&
        !searching &&
        results.length === 0 && (
          <div className="absolute z-20 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg p-3 text-center text-sm text-gray-400">
            No risks found
          </div>
        )}
    </div>
  );
}
