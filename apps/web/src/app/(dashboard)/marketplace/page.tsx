"use client";

import { useCallback, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  RefreshCcw,
  Search,
  Star,
  Download,
  ShieldCheck,
  Package,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface MarketplaceListing {
  id: string;
  name: string;
  slug: string;
  summary: string;
  iconUrl: string | null;
  status: string;
  isFeatured: boolean;
  isVerified: boolean;
  priceType: string;
  installCount: number;
  avgRating: string;
  reviewCount: number;
  categoryId: string;
}

interface MarketplaceCategory {
  id: string;
  name: string;
  slug: string;
  categoryType: string;
}

export default function MarketplacePage() {
  return (
    <ModuleGate moduleKey="marketplace">
      <MarketplaceBrowse />
    </ModuleGate>
  );
}

function MarketplaceBrowse() {
  const t = useTranslations("marketplace");
  const _router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");

  // [OP-245 · Gestalt A] Fetch on mount via `@tanstack/react-query` instead
  // of an effect plus mirrored loading/data state (pattern from wave 7b,
  // `catalogs/objects/page.tsx`). Two queries: the listings depend on search
  // and category (both in the key; the previous page stays visible while a
  // new filter loads, as the old `loading && listings.length === 0` guard
  // did), the categories on nothing. Non-ok responses yield empty lists, as
  // before; the refresh button follows `isFetching` of both.
  const {
    data: listings = [],
    isPending: loading,
    isFetching: listingsFetching,
    refetch: refetchListings,
  } = useQuery<MarketplaceListing[]>({
    queryKey: ["marketplace", "listings", { search, selectedCategory }],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams({ status: "published", limit: "20" });
      if (search) params.set("search", search);
      if (selectedCategory) params.set("categoryId", selectedCategory);
      const res = await fetch(`/api/v1/marketplace/listings?${params}`);
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data ?? []) as MarketplaceListing[];
    },
  });

  const {
    data: categories = [],
    isFetching: categoriesFetching,
    refetch: refetchCategories,
  } = useQuery<MarketplaceCategory[]>({
    queryKey: ["marketplace", "categories", { isActive: true }],
    queryFn: async () => {
      const res = await fetch("/api/v1/marketplace/categories?isActive=true");
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data ?? []) as MarketplaceCategory[];
    },
  });

  const isFetching = listingsFetching || categoriesFetching;

  const fetchData = useCallback(async () => {
    await Promise.all([refetchListings(), refetchCategories()]);
  }, [refetchListings, refetchCategories]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("description")}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/marketplace/installed">
            <Button variant="outline" size="sm">
              <Package size={14} className="mr-1" />
              {t("installed")}
            </Button>
          </Link>
          <Link href="/marketplace/publishers">
            <Button variant="outline" size="sm">
              {t("publisherPortal")}
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={isFetching}
          >
            <RefreshCcw
              size={14}
              className={isFetching ? "animate-spin" : ""}
            />
          </Button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-4 text-sm"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
        >
          <option value="">{t("allCategories")}</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {/* Listings Grid */}
      {loading && listings.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-12 text-gray-400">{t("noListings")}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {listings.map((listing) => (
            <Link
              key={listing.id}
              href={`/marketplace/listings/${listing.id}`}
              className="rounded-lg border border-gray-200 bg-white p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                  {listing.iconUrl ? (
                    <img
                      src={listing.iconUrl}
                      alt=""
                      className="h-8 w-8 rounded"
                    />
                  ) : (
                    <Package size={20} className="text-gray-400" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900 truncate">
                      {listing.name}
                    </h3>
                    {listing.isVerified && (
                      <ShieldCheck
                        size={14}
                        className="text-blue-500 shrink-0"
                      />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                    {listing.summary}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Star size={12} className="text-yellow-500" />
                    {listing.avgRating} ({listing.reviewCount})
                  </span>
                  <span className="flex items-center gap-1">
                    <Download size={12} />
                    {listing.installCount}
                  </span>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {listing.priceType === "free" ? t("free") : listing.priceType}
                </Badge>
              </div>
              {listing.isFeatured && (
                <Badge className="mt-2 bg-yellow-100 text-yellow-800 text-[10px]">
                  {t("featured")}
                </Badge>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
