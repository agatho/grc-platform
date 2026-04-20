"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Plus, Tag } from "lucide-react";
import { Badge } from "./badge";

interface TagSuggestion {
  id: string;
  name: string;
  color: string;
  category: string | null;
  usageCount: number;
}

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
  disabled?: boolean;
  /** Pre-defined tag suggestions (optional — fetches from API if not provided) */
  suggestions?: string[];
}

const TAG_COLORS: Record<string, string> = {
  "#EF4444": "bg-red-100 text-red-900 border-red-300",
  "#F59E0B": "bg-amber-100 text-amber-900 border-amber-300",
  "#10B981": "bg-emerald-100 text-emerald-900 border-emerald-300",
  "#3B82F6": "bg-blue-100 text-blue-900 border-blue-300",
  "#8B5CF6": "bg-violet-100 text-violet-900 border-violet-300",
  "#EC4899": "bg-pink-100 text-pink-900 border-pink-300",
  "#6B7280": "bg-gray-100 text-gray-900 border-gray-300",
};

function tagColorClass(color?: string): string {
  return TAG_COLORS[color ?? ""] ?? "bg-gray-100 text-gray-900 border-gray-300";
}

export function TagInput({
  value,
  onChange,
  placeholder = "Tag hinzufügen...",
  maxTags = 20,
  disabled = false,
}: TagInputProps) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch suggestions from API
  const fetchSuggestions = useCallback(async (search: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "15" });
      if (search) params.set("search", search);
      const res = await fetch(`/api/v1/tags?${params}`);
      if (res.ok) {
        const json = await res.json();
        setSuggestions(
          (json.data ?? []).map((t: any) => ({
            id: t.id,
            name: t.name,
            color: t.color ?? "#6B7280",
            category: t.category,
            usageCount: t.usage_count ?? 0,
          })),
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount + when input changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (showSuggestions) fetchSuggestions(input);
    }, 200);
    return () => clearTimeout(timer);
  }, [input, showSuggestions, fetchSuggestions]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const addTag = useCallback(
    (tag: string) => {
      const trimmed = tag.trim().toLowerCase();
      if (!trimmed || value.includes(trimmed) || value.length >= maxTags)
        return;
      onChange([...value, trimmed]);
      setInput("");

      // Auto-create tag definition if it's new
      fetch("/api/v1/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      }).catch(() => {});
    },
    [value, onChange, maxTags],
  );

  const removeTag = useCallback(
    (tag: string) => {
      onChange(value.filter((t) => t !== tag));
    },
    [value, onChange],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (input.trim()) addTag(input);
    } else if (e.key === "Backspace" && !input && value.length > 0) {
      removeTag(value[value.length - 1]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  const filteredSuggestions = suggestions.filter(
    (s) => !value.includes(s.name.toLowerCase()),
  );

  return (
    <div ref={containerRef} className="relative">
      {/* Tag display + input */}
      <div
        className={`flex flex-wrap items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2 py-1.5 min-h-[38px] ${
          disabled
            ? "opacity-50 cursor-not-allowed"
            : "cursor-text focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500"
        }`}
        onClick={() => !disabled && inputRef.current?.focus()}
      >
        {value.map((tag) => {
          const suggestion = suggestions.find(
            (s) => s.name.toLowerCase() === tag,
          );
          return (
            <Badge
              key={tag}
              variant="outline"
              className={`text-xs gap-1 pr-1 ${tagColorClass(suggestion?.color)}`}
            >
              <Tag size={10} className="shrink-0" />
              {tag}
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTag(tag);
                  }}
                  className="ml-0.5 rounded-full hover:bg-black/10 p-0.5"
                >
                  <X size={10} />
                </button>
              )}
            </Badge>
          );
        })}

        {value.length < maxTags && !disabled && (
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={handleKeyDown}
            placeholder={value.length === 0 ? placeholder : ""}
            className="flex-1 min-w-[100px] border-0 bg-transparent p-0 text-sm focus:outline-none focus:ring-0 placeholder:text-gray-400"
            disabled={disabled}
          />
        )}
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && !disabled && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg max-h-48 overflow-y-auto">
          {loading ? (
            <p className="px-3 py-2 text-xs text-gray-400">Laden...</p>
          ) : filteredSuggestions.length === 0 ? (
            <div className="px-3 py-2">
              {input.trim() ? (
                <button
                  type="button"
                  onClick={() => addTag(input)}
                  className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 w-full text-left"
                >
                  <Plus size={14} />
                  &quot;{input.trim()}&quot; als neues Tag erstellen
                </button>
              ) : (
                <p className="text-xs text-gray-400">
                  Tippen Sie um Tags zu suchen oder zu erstellen
                </p>
              )}
            </div>
          ) : (
            <>
              {filteredSuggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => addTag(s.name)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="flex-1 text-gray-900">{s.name}</span>
                  {s.category && (
                    <span className="text-[10px] text-gray-400">
                      {s.category}
                    </span>
                  )}
                  <span className="text-[10px] text-gray-300">
                    {s.usageCount}×
                  </span>
                </button>
              ))}
              {input.trim() &&
                !filteredSuggestions.some(
                  (s) => s.name.toLowerCase() === input.trim().toLowerCase(),
                ) && (
                  <button
                    type="button"
                    onClick={() => addTag(input)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left border-t border-gray-100 text-blue-600 hover:bg-blue-50"
                  >
                    <Plus size={14} />
                    &quot;{input.trim()}&quot; erstellen
                  </button>
                )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
