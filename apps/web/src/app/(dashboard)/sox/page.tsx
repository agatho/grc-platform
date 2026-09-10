"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2,
  Plus,
  ShieldCheck,
  Percent,
  Calendar,
  DollarSign,
  ChevronDown,
  ChevronRight,
  MapPin,
  BookOpen,
  ClipboardCheck,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SoxScopingData {
  inScopeControls: number;
  coveragePercent: number;
  fiscalYear: string;
  materialityThreshold: string;
  locations: ScopingItem[];
  accounts: ScopingItem[];
  assertions: ScopingItem[];
}

interface ScopingItem {
  id: string;
  name: string;
  status: "in_scope" | "out_of_scope" | "pending";
  riskLevel?: "high" | "medium" | "low";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SoxCompliancePage() {
  return (
    <ModuleGate moduleKey="ics">
      <SoxComplianceInner />
    </ModuleGate>
  );
}

function SoxComplianceInner() {
  // [OP-245 · Gestalt A] Abruf beim Einhängen über `@tanstack/react-query`
  // statt Effekt plus gespiegeltem Lade- und Datenzustand (Muster aus
  // Welle 7b, `catalogs/objects/page.tsx`). Eine nicht-ok-Antwort liefert wie
  // vorher `null`.
  const { data = null, isPending: loading } = useQuery<SoxScopingData | null>({
    queryKey: ["sox", "scoping"],
    queryFn: async () => {
      const res = await fetch("/api/v1/sox/scoping");
      if (!res.ok) return null;
      const json = await res.json();
      return (json.data ?? null) as SoxScopingData | null;
    },
  });

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">SOX Compliance</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Scoping, Kontrollen und Abdeckung f\u00fcr SOX-Anforderungen
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Scoping starten
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-600" />
              In-Scope-Kontrollen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {data?.inScopeControls ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Percent className="h-4 w-4 text-green-600" />
              Abdeckung
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {data?.coveragePercent != null
                ? `${data.coveragePercent}%`
                : "0%"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-600" />
              Gesch\u00e4ftsjahr
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.fiscalYear ?? "--"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-yellow-600" />
              Wesentlichkeitsschwelle
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {data?.materialityThreshold ?? "--"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scoping Sections */}
      <CollapsibleSection
        title="Standorte"
        icon={<MapPin className="h-4 w-4" />}
        items={data?.locations ?? []}
      />
      <CollapsibleSection
        title="Konten"
        icon={<BookOpen className="h-4 w-4" />}
        items={data?.accounts ?? []}
      />
      <CollapsibleSection
        title="Assertions"
        icon={<ClipboardCheck className="h-4 w-4" />}
        items={data?.assertions ?? []}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collapsible Section
// ---------------------------------------------------------------------------

function CollapsibleSection({
  title,
  icon,
  items,
}: {
  title: string;
  icon: React.ReactNode;
  items: ScopingItem[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setOpen(!open)}
      >
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            {icon}
            {title}
            <Badge variant="outline" className="ml-2">
              {items.length}
            </Badge>
          </span>
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </CardTitle>
      </CardHeader>
      {open && (
        <CardContent>
          {items.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Keine Eintr\u00e4ge vorhanden.
            </p>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <span className="font-medium text-sm">{item.name}</span>
                  <div className="flex items-center gap-2">
                    {item.riskLevel && (
                      <Badge
                        variant={
                          item.riskLevel === "high"
                            ? "destructive"
                            : item.riskLevel === "medium"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {item.riskLevel === "high"
                          ? "Hoch"
                          : item.riskLevel === "medium"
                            ? "Mittel"
                            : "Niedrig"}
                      </Badge>
                    )}
                    <ScopeBadge status={item.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function ScopeBadge({ status }: { status: string }) {
  switch (status) {
    case "in_scope":
      return (
        <Badge
          variant="default"
          className="bg-green-100 text-green-800 border-green-300"
        >
          In Scope
        </Badge>
      );
    case "out_of_scope":
      return <Badge variant="outline">Out of Scope</Badge>;
    case "pending":
      return <Badge variant="secondary">Ausstehend</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}
