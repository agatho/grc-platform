"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import {
  Loader2,
  Star,
  Download,
  ShieldCheck,
  ArrowLeft,
  Package,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ListingDetail {
  id: string;
  name: string;
  summary: string;
  description: string | null;
  iconUrl: string | null;
  screenshotUrls: string[];
  tags: string[];
  status: string;
  isFeatured: boolean;
  isVerified: boolean;
  priceType: string;
  priceAmount: string | null;
  priceCurrency: string | null;
  installCount: number;
  avgRating: string;
  reviewCount: number;
  supportUrl: string | null;
  documentationUrl: string | null;
  publishedAt: string | null;
}

interface Version {
  id: string;
  version: string;
  releaseNotes: string | null;
  status: string;
  publishedAt: string | null;
}

interface Review {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  publisherResponse: string | null;
  createdAt: string;
}

export default function MarketplaceListingDetailPage() {
  return (
    <ModuleGate moduleKey="marketplace">
      <ListingDetail />
    </ModuleGate>
  );
}

function ListingDetail() {
  const t = useTranslations("marketplace");
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, verRes, revRes] = await Promise.all([
        fetch(`/api/v1/marketplace/listings/${id}`),
        fetch(`/api/v1/marketplace/versions?listingId=${id}`),
        fetch(`/api/v1/marketplace/reviews?listingId=${id}`),
      ]);
      if (listRes.ok) setListing((await listRes.json()).data);
      if (verRes.ok) setVersions((await verRes.json()).data ?? []);
      if (revRes.ok) setReviews((await revRes.json()).data ?? []);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleInstall = async () => {
    const latestVersion = versions.find((v) => v.status === "approved");
    if (!latestVersion) return;
    const res = await fetch("/api/v1/marketplace/installations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId: id, versionId: latestVersion.id }),
    });
    if (res.ok) {
      router.push("/marketplace/installed");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="text-center py-12 text-gray-400">{t("notFound")}</div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={14} /> {t("backToMarketplace")}
      </button>

      <div className="flex items-start gap-6">
        <div className="h-20 w-20 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
          {listing.iconUrl ? (
            <img
              src={listing.iconUrl}
              alt=""
              className="h-16 w-16 rounded-lg"
            />
          ) : (
            <Package size={32} className="text-gray-400" />
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">{listing.name}</h1>
            {listing.isVerified && (
              <ShieldCheck size={18} className="text-blue-500" />
            )}
            {listing.isFeatured && (
              <Badge className="bg-yellow-100 text-yellow-800">
                {t("featured")}
              </Badge>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">{listing.summary}</p>
          <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Star size={14} className="text-yellow-500" />
              {listing.avgRating} ({listing.reviewCount} {t("reviews")})
            </span>
            <span className="flex items-center gap-1">
              <Download size={14} /> {listing.installCount} {t("installs")}
            </span>
          </div>
        </div>
        <Button onClick={handleInstall} disabled={versions.length === 0}>
          <Download size={14} className="mr-1" /> {t("install")}
        </Button>
      </div>

      {/* Description */}
      {listing.description && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold mb-3">
            {t("detailDescription")}
          </h2>
          <div className="prose prose-sm max-w-none text-gray-700">
            {listing.description}
          </div>
        </div>
      )}

      {/* Versions */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold mb-3">{t("versions")}</h2>
        {versions.length === 0 ? (
          <p className="text-sm text-gray-400">{t("noVersions")}</p>
        ) : (
          <div className="space-y-2">
            {versions.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between rounded border border-gray-100 p-3"
              >
                <div>
                  <span className="text-sm font-medium">{v.version}</span>
                  <Badge variant="outline" className="ml-2 text-[10px]">
                    {v.status}
                  </Badge>
                </div>
                {v.publishedAt && (
                  <span className="text-xs text-gray-400">
                    {new Date(v.publishedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reviews */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold mb-3">
          {t("reviews")} ({reviews.length})
        </h2>
        {reviews.length === 0 ? (
          <p className="text-sm text-gray-400">{t("noReviews")}</p>
        ) : (
          <div className="space-y-4">
            {reviews.map((r) => (
              <div
                key={r.id}
                className="border-b border-gray-100 pb-4 last:border-0"
              >
                <div className="flex items-center gap-2">
                  <div className="flex">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        size={12}
                        className={
                          i < r.rating
                            ? "text-yellow-500 fill-yellow-500"
                            : "text-gray-400"
                        }
                      />
                    ))}
                  </div>
                  {r.title && (
                    <span className="text-sm font-medium">{r.title}</span>
                  )}
                </div>
                {r.body && (
                  <p className="text-sm text-gray-600 mt-1">{r.body}</p>
                )}
                {r.publisherResponse && (
                  <div className="mt-2 ml-4 p-2 bg-blue-50 rounded text-sm text-blue-800">
                    <span className="font-medium">
                      {t("publisherResponse")}:
                    </span>{" "}
                    {r.publisherResponse}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
