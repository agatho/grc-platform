"use client";
import { useTheme } from "next-themes";
import { Sun, Moon, Eye, LayoutGrid, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useLayout } from "@/hooks/use-layout-preference";

const themes = [
  { key: "arctic", label: "Arctic", labelDe: "Arktis", icon: Sun },
  { key: "dark", label: "Obsidian", labelDe: "Obsidian", icon: Moon },
  { key: "high-contrast", label: "Polar", labelDe: "Polar", icon: Eye },
];

const layoutOptions = [
  { key: "classic" as const, label: "Classic", icon: LayoutGrid },
  { key: "modern" as const, label: "Modern", icon: Sparkles },
];

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const { layout, setLayout } = useLayout();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <div className="px-1 py-1">
      <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-gray-400">
        Theme
      </p>
      {themes.map((t) => {
        const Icon = t.icon;
        const isActive = theme === t.key;
        return (
          <button
            key={t.key}
            onClick={() => setTheme(t.key)}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
              isActive
                ? "bg-blue-50 text-blue-700 font-medium"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Icon className="h-4 w-4" />
            {t.label}
          </button>
        );
      })}

      <div className="mx-2 my-2 border-t border-gray-100" />

      <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-gray-400">
        Layout
      </p>
      {layoutOptions.map((opt) => {
        const Icon = opt.icon;
        const isActive = layout === opt.key;
        return (
          <button
            key={opt.key}
            onClick={() => setLayout(opt.key)}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
              isActive
                ? "bg-blue-50 text-blue-700 font-medium"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Icon className="h-4 w-4" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
