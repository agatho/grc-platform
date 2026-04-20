"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Globe,
  TrendingUp,
  AlertTriangle,
  Truck,
  Factory,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ModuleTabNav } from "@/components/layout/module-tab-nav";

interface HotspotRegion {
  region: string;
  emissions: number;
  vendorCount: number;
  riskLevel: "low" | "medium" | "high" | "critical";
}

interface HotspotCategory {
  category: string;
  emissions: number;
  percentage: number;
}

// Demo data — would come from API in production
const DEMO_REGIONS: HotspotRegion[] = [
  {
    region: "Asien-Pazifik",
    emissions: 12500,
    vendorCount: 23,
    riskLevel: "high",
  },
  {
    region: "Europa (EU)",
    emissions: 8200,
    vendorCount: 45,
    riskLevel: "medium",
  },
  { region: "Nordamerika", emissions: 5100, vendorCount: 12, riskLevel: "low" },
  {
    region: "Südamerika",
    emissions: 3200,
    vendorCount: 8,
    riskLevel: "medium",
  },
  { region: "Afrika", emissions: 1800, vendorCount: 5, riskLevel: "high" },
];

const DEMO_CATEGORIES: HotspotCategory[] = [
  { category: "Rohstoffe & Vorprodukte", emissions: 15200, percentage: 49 },
  { category: "Transport & Logistik", emissions: 8100, percentage: 26 },
  { category: "Verpackung", emissions: 3500, percentage: 11 },
  { category: "IT & Dienstleistungen", emissions: 2400, percentage: 8 },
  { category: "Sonstige", emissions: 1600, percentage: 5 },
];

const riskColors: Record<string, string> = {
  low: "bg-green-100 text-green-900 border-green-300",
  medium: "bg-yellow-100 text-yellow-900 border-yellow-300",
  high: "bg-orange-100 text-orange-900 border-orange-300",
  critical: "bg-red-100 text-red-900 border-red-300",
};

export default function SupplyChainEmissionsPage() {
  const totalEmissions = DEMO_REGIONS.reduce((sum, r) => sum + r.emissions, 0);

  return (
    <div className="space-y-6">
      <ModuleTabNav />
      <div className="flex items-center gap-4">
        <Link href="/esg/emissions">
          <ArrowLeft size={18} className="text-gray-500 hover:text-gray-700" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Lieferketten-Emissions-Hotspots
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Scope 3 Emissionen nach Region und Kategorie — Identifikation der
            Haupttreiber
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Globe size={20} className="text-blue-600" />
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {DEMO_REGIONS.length}
              </p>
              <p className="text-xs text-gray-500">Regionen</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Truck size={20} className="text-indigo-600" />
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {DEMO_REGIONS.reduce((s, r) => s + r.vendorCount, 0)}
              </p>
              <p className="text-xs text-gray-500">Lieferanten</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp size={20} className="text-orange-600" />
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {(totalEmissions / 1000).toFixed(1)}k
              </p>
              <p className="text-xs text-gray-500">tCO₂e gesamt</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle size={20} className="text-red-600" />
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {
                  DEMO_REGIONS.filter(
                    (r) => r.riskLevel === "high" || r.riskLevel === "critical",
                  ).length
                }
              </p>
              <p className="text-xs text-gray-500">Hochrisiko-Regionen</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Region */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Globe size={16} className="text-blue-600" />
              Emissionen nach Region
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {DEMO_REGIONS.sort((a, b) => b.emissions - a.emissions).map(
              (region) => {
                const pct = Math.round(
                  (region.emissions / totalEmissions) * 100,
                );
                return (
                  <div key={region.region} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {region.region}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${riskColors[region.riskLevel]}`}
                        >
                          {region.riskLevel}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span>{region.vendorCount} Lieferanten</span>
                        <span className="font-mono font-medium text-gray-900">
                          {region.emissions.toLocaleString("de-DE")} tCO₂e
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          region.riskLevel === "critical" ||
                          region.riskLevel === "high"
                            ? "bg-orange-500"
                            : "bg-blue-500"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              },
            )}
          </CardContent>
        </Card>

        {/* By Category */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Factory size={16} className="text-indigo-600" />
              Emissionen nach Beschaffungskategorie
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {DEMO_CATEGORIES.map((cat) => (
              <div key={cat.category} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-900">
                    {cat.category}
                  </span>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-gray-500">{cat.percentage}%</span>
                    <span className="font-mono font-medium text-gray-900">
                      {cat.emissions.toLocaleString("de-DE")} tCO₂e
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-indigo-500"
                    style={{ width: `${cat.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
