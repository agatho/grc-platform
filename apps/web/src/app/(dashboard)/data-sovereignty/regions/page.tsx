"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Globe, Plus, Loader2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface DataRegionRecord {
  id: string;
  code: string;
  name: string;
  location: string;
  provider: string;
  status: string;
  currentTenants: number;
  maxTenants: number | null;
  isDefault: boolean;
}

export default function DataRegionsPage() {
  const t = useTranslations("dataSovereignty");
  const [regions, setRegions] = useState<DataRegionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/data-sovereignty/regions?limit=50")
      .then((r) => r.json())
      .then((json) => setRegions(json.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  const statusColor = (s: string) => {
    switch (s) {
      case "active": return "default";
      case "provisioning": return "secondary";
      case "maintenance": return "outline";
      case "decommissioned": return "destructive";
      default: return "secondary";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("regionsTitle")}</h1>
          <p className="text-muted-foreground">{t("regionsDescription")}</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          {t("addRegion")}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("regionCode")}</TableHead>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("location")}</TableHead>
                <TableHead>{t("provider")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("tenants")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {regions.map((region) => (
                <TableRow key={region.id}>
                  <TableCell className="font-mono">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      {region.code}
                      {region.isDefault && <Badge variant="outline">{t("default")}</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>{region.name}</TableCell>
                  <TableCell>{region.location}</TableCell>
                  <TableCell>{region.provider}</TableCell>
                  <TableCell>
                    <Badge variant={statusColor(region.status) as "default" | "secondary" | "destructive" | "outline"}>
                      {region.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{region.currentTenants}{region.maxTenants ? `/${region.maxTenants}` : ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
