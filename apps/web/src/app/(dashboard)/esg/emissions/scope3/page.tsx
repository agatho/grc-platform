"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Truck, ShoppingBag, Plane, Users, Building2, Recycle,
  Factory, Zap, Package, ArrowUpDown, Fuel, Globe, DollarSign,
  ArrowLeft, BarChart3,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SCOPE3_CATEGORIES = [
  { num: 1, key: "purchased_goods", icon: ShoppingBag, label: "Eingekaufte Güter und Dienstleistungen", labelEn: "Purchased Goods & Services", upstream: true },
  { num: 2, key: "capital_goods", icon: Building2, label: "Kapitalgüter", labelEn: "Capital Goods", upstream: true },
  { num: 3, key: "fuel_energy", icon: Fuel, label: "Brennstoff- und energiebezogene Emissionen", labelEn: "Fuel & Energy Activities", upstream: true },
  { num: 4, key: "upstream_transport", icon: Truck, label: "Vorgelagerter Transport und Distribution", labelEn: "Upstream Transport & Distribution", upstream: true },
  { num: 5, key: "waste", icon: Recycle, label: "Abfallentsorgung im Betrieb", labelEn: "Waste Generated in Operations", upstream: true },
  { num: 6, key: "business_travel", icon: Plane, label: "Geschäftsreisen", labelEn: "Business Travel", upstream: true },
  { num: 7, key: "commuting", icon: Users, label: "Pendlerverkehr der Mitarbeiter", labelEn: "Employee Commuting", upstream: true },
  { num: 8, key: "upstream_leased", icon: Building2, label: "Vorgelagerte geleaste Vermögenswerte", labelEn: "Upstream Leased Assets", upstream: true },
  { num: 9, key: "downstream_transport", icon: Truck, label: "Nachgelagerter Transport und Distribution", labelEn: "Downstream Transport & Distribution", upstream: false },
  { num: 10, key: "processing", icon: Factory, label: "Verarbeitung verkaufter Produkte", labelEn: "Processing of Sold Products", upstream: false },
  { num: 11, key: "use_of_products", icon: Zap, label: "Nutzung verkaufter Produkte", labelEn: "Use of Sold Products", upstream: false },
  { num: 12, key: "end_of_life", icon: Recycle, label: "End-of-Life-Behandlung verkaufter Produkte", labelEn: "End-of-Life Treatment", upstream: false },
  { num: 13, key: "downstream_leased", icon: Building2, label: "Nachgelagerte geleaste Vermögenswerte", labelEn: "Downstream Leased Assets", upstream: false },
  { num: 14, key: "franchises", icon: Globe, label: "Franchises", labelEn: "Franchises", upstream: false },
  { num: 15, key: "investments", icon: DollarSign, label: "Investitionen", labelEn: "Investments", upstream: false },
];

export default function Scope3CategoriesPage() {
  const [filter, setFilter] = useState<"all" | "upstream" | "downstream">("all");

  const filtered = SCOPE3_CATEGORIES.filter((c) =>
    filter === "all" ? true : filter === "upstream" ? c.upstream : !c.upstream
  );

  const upstreamCount = SCOPE3_CATEGORIES.filter((c) => c.upstream).length;
  const downstreamCount = SCOPE3_CATEGORIES.filter((c) => !c.upstream).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/esg/emissions">
          <ArrowLeft size={18} className="text-gray-500 hover:text-gray-700" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Scope 3 — Alle 15 Kategorien</h1>
          <p className="text-sm text-gray-500 mt-1">
            GHG Protocol Scope 3: Vorgelagerte und nachgelagerte Wertschöpfungskette
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        {[
          { key: "all" as const, label: `Alle (${SCOPE3_CATEGORIES.length})` },
          { key: "upstream" as const, label: `Vorgelagert (${upstreamCount})` },
          { key: "downstream" as const, label: `Nachgelagert (${downstreamCount})` },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === f.key
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Category Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((cat) => {
          const Icon = cat.icon;
          return (
            <Card key={cat.num} className="hover:border-blue-300 transition-colors cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg shrink-0 ${
                    cat.upstream ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"
                  }`}>
                    <Icon size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] font-mono">
                        Kat. {cat.num}
                      </Badge>
                      <Badge variant="outline" className={`text-[10px] ${
                        cat.upstream
                          ? "bg-blue-50 text-blue-900 border-blue-200"
                          : "bg-orange-50 text-orange-900 border-orange-200"
                      }`}>
                        {cat.upstream ? "Vorgelagert" : "Nachgelagert"}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium text-gray-900 mt-1">{cat.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{cat.labelEn}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
