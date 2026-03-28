"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  Puzzle,
  Plus,
  Store,
  Settings,
  Loader2,
  Download,
  Star,
  CheckCircle2,
  XCircle,
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

interface InstalledPlugin {
  installation: {
    id: string;
    status: string;
    installedAt: string;
  };
  plugin: {
    id: string;
    key: string;
    name: string;
    version: string;
    category: string;
    iconUrl: string | null;
  };
}

interface MarketplaceListing {
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

export default function ExtensionsPage() {
  const t = useTranslations("extensions");
  const [installed, setInstalled] = useState<InstalledPlugin[]>([]);
  const [featured, setFeatured] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [instRes, mktRes] = await Promise.all([
        fetch("/api/v1/plugins/installations"),
        fetch("/api/v1/plugins/marketplace?featured=true&limit=6"),
      ]);
      if (instRes.ok) {
        const data = await instRes.json();
        setInstalled(data.data ?? []);
      }
      if (mktRes.ok) {
        const data = await mktRes.json();
        setFeatured(data.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/extensions/marketplace">
            <Button variant="outline">
              <Store className="mr-2 h-4 w-4" />
              {t("marketplace")}
            </Button>
          </Link>
        </div>
      </div>

      {/* Installed Plugins */}
      <div>
        <h2 className="text-xl font-semibold mb-4">{t("installed.title")}</h2>
        {installed.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Puzzle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t("installed.empty")}</p>
              <Link href="/extensions/marketplace">
                <Button variant="outline" className="mt-4">
                  <Store className="mr-2 h-4 w-4" />
                  {t("installed.browseMarketplace")}
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {installed.map(({ installation, plugin: p }) => (
              <Card key={installation.id}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Puzzle className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{p.name}</CardTitle>
                      <CardDescription>v{p.version}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <Badge variant={installation.status === "active" ? "default" : "secondary"}>
                      {installation.status}
                    </Badge>
                    <Link href={`/extensions/installed/${installation.id}`}>
                      <Button variant="ghost" size="sm">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Featured Extensions */}
      {featured.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">{t("featured.title")}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {featured.map(({ listing, plugin: p }) => (
              <Card key={listing.id} className="cursor-pointer hover:border-primary transition-colors">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Puzzle className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">{listing.title}</CardTitle>
                        {p.isVerified && (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        )}
                      </div>
                      <CardDescription>{p.author ?? t("featured.unknown")}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    {listing.shortDescription}
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Download className="h-3 w-3" />
                      {listing.downloadCount}
                    </span>
                    <Badge variant="outline">{listing.pricingModel}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
