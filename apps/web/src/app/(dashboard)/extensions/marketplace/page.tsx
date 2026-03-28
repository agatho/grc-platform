"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Store,
  Search,
  Puzzle,
  Download,
  CheckCircle2,
  Loader2,
  Star,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface MarketplaceItem {
  listing: {
    id: string;
    title: string;
    shortDescription: string;
    pricingModel: string;
    downloadCount: number;
    rating: number | null;
    isFeatured: boolean;
  };
  plugin: {
    id: string;
    key: string;
    name: string;
    version: string;
    category: string;
    author: string | null;
    iconUrl: string | null;
    isVerified: boolean;
  };
}

export default function MarketplacePage() {
  const t = useTranslations("extensions");
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pricingFilter, setPricingFilter] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (pricingFilter) params.set("pricingModel", pricingFilter);
      const res = await fetch(`/api/v1/plugins/marketplace?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [pricingFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleInstall = async (pluginId: string) => {
    await fetch("/api/v1/plugins/installations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pluginId }),
    });
    fetchData();
  };

  const filteredItems = items.filter(
    (item) =>
      !search ||
      item.listing.title.toLowerCase().includes(search.toLowerCase()) ||
      item.plugin.author?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("marketplace")}</h1>
        <p className="text-muted-foreground">{t("marketplaceSubtitle")}</p>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <input
            className="w-full rounded-md border px-9 py-2 text-sm"
            placeholder={t("marketplaceSearch")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="rounded-md border px-3 py-2 text-sm"
          value={pricingFilter}
          onChange={(e) => setPricingFilter(e.target.value)}
        >
          <option value="">{t("allPricing")}</option>
          <option value="free">{t("pricing.free")}</option>
          <option value="freemium">{t("pricing.freemium")}</option>
          <option value="paid">{t("pricing.paid")}</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {filteredItems.map(({ listing, plugin: p }) => (
            <Card key={listing.id}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Puzzle className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{listing.title}</CardTitle>
                      {p.isVerified && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    </div>
                    <CardDescription>{p.author ?? t("featured.unknown")}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{listing.shortDescription}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Download className="h-3 w-3" />
                      {listing.downloadCount}
                    </span>
                    <Badge variant="outline" className="text-xs">{listing.pricingModel}</Badge>
                  </div>
                  <Button size="sm" onClick={() => handleInstall(p.id)}>
                    {t("install")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
